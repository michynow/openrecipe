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
  /** `detail` is the SDK's own error message, when there was one — for the Draft's log. */
  | { ok: false; reason: "no-answer" | "invalid-json" | "schema"; detail?: string };

/**
 * No tools: this is a text transformation, not an agent doing work.
 *
 * `maxTurns: 1` was the obvious setting and was wrong — a long answer costs more
 * than one turn, and the SDK then ends the run with "Reached maximum number of
 * turns" instead of the JSON. Three is enough for the answer and still nowhere
 * near enough for anything to wander, with no tools to wander with.
 */
const OPTIONS = {
  systemPrompt: SYSTEM_PROMPT,
  allowedTools: [] as string[],
  maxTurns: 3,
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

async function ask(prompt: string): Promise<{ answer: string; error?: string }> {
  let answer = "";
  let failure: string | undefined;

  try {
    for await (const message of query({ prompt, options: OPTIONS })) {
      if (message.type !== "assistant") continue;

      for (const block of message.message.content) {
        if (block.type === "text") answer += block.text;
      }
    }
  } catch (error) {
    /**
     * The SDK throws on its own error results — a rate limit, an interrupted
     * run, a turn ceiling. Whatever text arrived before the throw is still worth
     * trying: the JSON is usually already complete. An empty answer becomes a
     * clean `no-answer`, which the Worker can fall back from, rather than a
     * crashed Draft.
     */
    failure = (error as Error).message;
    console.error("  model call failed:", failure);
  }

  return { answer: answer.trim(), error: failure };
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

  const first = await ask(prompt);
  let answer = first.answer;
  if (!answer) return { ok: false, reason: "no-answer", detail: first.error };

  let parsed = extractJson(answer);
  if (parsed === null) return { ok: false, reason: "invalid-json" };

  let checked = validate(parsed, allowed);
  if (checked.ok) {
    return { ok: true, payload: withSource(checked.payload, sourceUrl), inferred: checked.inferred };
  }

  // One retry, with the model's own answer and what was wrong with it. Two
  // failures mean the page is the problem, not the phrasing.
  const second = await ask(
    `${prompt}\n\nYour previous answer was rejected:\n${checked.errors
      .map((error) => `- ${error}`)
      .join("\n")}\n\nHere it is again:\n${answer}\n\nReturn the corrected JSON object, nothing else.`,
  );
  answer = second.answer;

  parsed = extractJson(answer);
  if (parsed === null) return { ok: false, reason: "invalid-json" };

  checked = validate(parsed, allowed);
  if (!checked.ok) return { ok: false, reason: "schema", detail: checked.errors.slice(0, 3).join("; ") };

  return { ok: true, payload: withSource(checked.payload, sourceUrl), inferred: checked.inferred };
}

/** Provenance is ours to set, not the model's to echo back. */
const withSource = (payload: RecipeFormValue, sourceUrl: string) => ({
  ...payload,
  sourceUrl,
  // Images are OR-43; whatever the model says about one is ignored.
  imageUrl: null,
});
