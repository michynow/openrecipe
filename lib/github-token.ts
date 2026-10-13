/**
 * The dispatch token as GitHub expects it. A token pasted into Vercel picks up
 * extras that GitHub answers with 401 Bad credentials: surrounding quotes from
 * a copied `.env` line, a `Bearer `/`token ` prefix, a stray line break.
 */
export function cleanGithubToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const token = raw
    .replace(/\s+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(bearer|token)(?=gh|github_pat_)/i, "");
  return token || undefined;
}

/**
 * What a failed dispatch means, in words the Master can act on. GitHub's own
 * status says little: 401 is a dead token, 403/404 a live one without the
 * permission `repository_dispatch` needs (Contents: write), or the wrong repo.
 */
export function dispatchFailureHint(status: number): string {
  if (status === 401) return "token odrzucony — wygasł, został cofnięty albo jest źle wklejony";
  if (status === 403 || status === 404) return "token bez uprawnienia Contents: write do tego repozytorium";
  return "";
}
