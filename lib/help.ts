/**
 * Which page the help button is on. One topic per screen; the words live in
 * copy.help.pages, keyed by these names.
 */
export type HelpTopic =
  | "dashboard"
  | "search"
  | "drafts"
  | "draft"
  | "newRecipe"
  | "recipe"
  | "editRecipe"
  | "settings"
  | "lost";

export function helpTopic(pathname: string): HelpTopic {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second, third] = parts;

  if (parts.length === 0) return "dashboard";
  if (first === "search" && parts.length === 1) return "search";
  if (first === "settings" && parts.length === 1) return "settings";
  if (first === "drafts") return parts.length === 1 ? "drafts" : "draft";
  if (first === "recipes" && second === "new" && parts.length === 2) return "newRecipe";
  if (first === "recipes" && second && parts.length === 2) return "recipe";
  if (first === "recipes" && third === "edit" && parts.length === 3) return "editRecipe";
  return "lost";
}
