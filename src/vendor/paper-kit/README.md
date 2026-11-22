# Vendored paper-kit v1.1.0

Copied unchanged from `/workspace/design/prism/paper-kit/` on 2026-11-22
(checksums of the upstream files: `UPSTREAM.sha256`): `src/paper-kit.ts`,
`tokens.css`, `tokens.json`, `paper-kit.css`, `assets/fibre-*.png`.

Type check: `npx tsc --noEmit` with the app's tsconfig (strict, TS 7.0.2):
0 errors, no edits needed. An extra-strict pass
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused checks)
reports 30 advisory items, all array/tuple index reads typed `T | undefined`
under `noUncheckedIndexedAccess` (lines 64, 429-461, 513). The app doesn't
use that flag, so nothing changed.

Don't edit these files here; change the kit upstream and re-vendor.
