// Static image imports (`import icon from "./icon.png"`) need Next's module
// declarations. next-env.d.ts carries them but is generated and gitignored, so
// CI's plain `tsc` — which runs before `next build` creates it — never sees it.
/// <reference types="next/image-types/global" />
