import { query } from "@anthropic-ai/claude-agent-sdk";

import { recipeSchema, type RecipeFormValue } from "../recipe-schema.ts";
import type { ExtractedPage } from "./extract.ts";
import { buildPrompt, SYSTEM_PROMPT, type TagOption } from "./prompt.ts";

/**
 * The model call (OR-42). Runs only on the laptop, through the Claude CLI's own
 * subscription auth — there is no API key in this repo or on Vercel, by design
 * (ADR-0002).
 *
 * The model is asked for JSON and the answer is then put through the same Zod
 * schema the editor and the Server Action use. Nothing downstream trusts it: an
 * answer that does not conform is handed back with its own errors and asked for
 * again, once, and a second failure is a failed Draft rather than a half-Recipe
 * in front of a reviewer.
 */

export type GenerateResult =
  | { ok: true; payload: RecipeFormValue; inferred: string[] }
  | { ok: false; reason: "no-answer" | "invalid-json" | "schema" };

/** No tools, one turn: this is a text transformation, not an agent doing work. */
const OPTIONS = {
  systemPrompt: SYSTEM_PROMPT,
  allowedTools: [] as string[],
  maxTurns: 1,
};

/**
 * Pull the JSON out of an answer. Models fence it despite being asked not to,
 * and a stray sentence before it is not worth a retry when the object is right
 * there — so this takes the outermost braces rather than demanding purity.
 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function ask(prompt: string): Promise<string> {
  let answer = "";

  for await (const message of query({ prompt, options: OPTIONS })) {
    if (message.type !== "assistant") continue;

    for (const block of message.message.content) {
      if (block.type === "text") answer += block.text;
    }
  }

  return answer.trim();
}

/**
 * Everything the model returned that is not part of a Recipe, kept apart from
 * the payload so `recipeSchema` stays the only definition of one.
 */
function splitInferred(value: unknown): { recipe: unknown; inferred: string[] } {
  if (!value || typeof value !== "object") return { recipe: value, inferred: [] };

  const { inferred, ...recipe } = value as Record<string, unknown>;

  return {
    recipe,
    inferred: Array.isArray(inferred)
      ? inferred.filter((field): field is string => typeof field === "string")
      : [],
  };
}

export function validate(
  value: unknown,
  allowedSlugs: Set<string>,
):
  | { ok: true; payload: RecipeFormValue; inferred: string[] }
  | { ok: false; errors: string[] } {
  const { recipe, inferred } = splitInferred(value);
  const parsed = recipeSchema.safeParse(recipe);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }

  /**
   * Tags are checked here rather than left to the foreign key. The model picking
   * a plausible-sounding slug that does not exist is the expected failure, and a
   * retry with the list repeated fixes it; a database error at approval time
   * would surface hours later, to somebody else.
   */
  const invented = parsed.data.tagSlugs.filter((slug) => !allowedSlugs.has(slug));
  if (invented.length > 0) {
    return {
      ok: false,
      errors: [`tagSlugs: nie ma takich tagów: ${invented.join(", ")}`],
    };
  }

  return {
    ok: true,
    payload: { ...parsed.data, sourceUrl: parsed.data.sourceUrl ?? null },
    inferred,
  };
}

export async function generateRecipe(
  page: ExtractedPage,
  sourceUrl: string,
  tags: TagOption[],
): Promise<GenerateResult> {
  const allowed = new Set(tags.map((tag) => tag.slug));
  const prompt = buildPrompt(page, sourceUrl, tags);

  let answer = await ask(prompt);
  if (!answer) return { ok: false, reason: "no-answer" };

  let parsed = extractJson(answer);
  if (parsed === null) return { ok: false, reason: "invalid-json" };

  let checked = validate(parsed, allowed);
  if (checked.ok) {
    return { ok: true, payload: withSource(checked.payload, sourceUrl), inferred: checked.inferred };
  }

  // One retry, with the model's own answer and what was wrong with it. Two
  // failures mean the page is the problem, not the phrasing.
  answer = await ask(
    `${prompt}\n\nYour previous answer was rejected:\n${checked.errors
      .map((error) => `- ${error}`)
      .join("\n")}\n\nHere it is again:\n${answer}\n\nReturn the corrected JSON object, nothing else.`,
  );

  parsed = extractJson(answer);
  if (parsed === null) return { ok: false, reason: "invalid-json" };

  checked = validate(parsed, allowed);
  if (!checked.ok) return { ok: false, reason: "schema" };

  return { ok: true, payload: withSource(checked.payload, sourceUrl), inferred: checked.inferred };
}

/** Provenance is ours to set, not the model's to echo back. */
const withSource = (payload: RecipeFormValue, sourceUrl: string) => ({
  ...payload,
  sourceUrl,
  // Images are OR-43; whatever the model says about one is ignored.
  imageUrl: null,
});
