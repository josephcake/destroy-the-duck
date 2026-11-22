# Vendored paper-kit v1.1.1

Copied unchanged from `/workspace/design/prism/paper-kit/` on 2026-11-22
(checksums of the upstream files: `UPSTREAM.sha256`): `src/paper-kit.ts`,
`tokens.css`, `tokens.json`, `paper-kit.css`, `assets/fibre-*.png`.

Type check: `npx tsc --noEmit` with the app's tsconfig (strict, TS 7.0.2):
0 errors, no edits needed. An extra-strict pass
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused checks)
reported 30 advisory `noUncheckedIndexedAccess` index reads in v1.1.0;
v1.1.1 (re-vendored 2026-11-22) guards them upstream. No visual change.

Don't edit these files here; change the kit upstream and re-vendor.
