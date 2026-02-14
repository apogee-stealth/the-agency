---
name: General Checks
applies_when: Always — applies to all PRs regardless of file types
---

- [ ] **New environment variables**: Are there new `process.env.*` references that need documentation or deployment configuration?
- [ ] **Type safety**: Are there `any` types, type assertions (`as`), or `@ts-ignore` / `@ts-expect-error` comments that bypass TypeScript's type system?
- [ ] **Dead code**: Flag new functions, methods, constants, or type definitions that are exported or defined but never referenced by any other code in the diff. Also flag commented-out code blocks and unreachable code after unconditional `return`, `throw`, or `process.exit` statements. If it's not called, imported, or reachable, it shouldn't be merged.
- [ ] **Dependency changes**: Flag new packages added to `dependencies` or `devDependencies`. For each new dependency, consider: does the project already have a library that does this? Is a full package warranted or would a few lines of code suffice? Also flag removed packages (is anything still importing them?) and major version bumps (check for breaking changes in the upgrade path).
- [ ] **Leftover debugging**: Flag `debugger` statements, `console.debug`, `.only` on test cases (`describe.only`, `it.only`, `test.only`), artificial delays (`sleep()`, `setTimeout` used as a wait hack), and commented-out code that was clearly used during development (e.g., commented-out `console.log`, toggled feature flags, hardcoded user IDs). These are fine locally — not fine in a merge to main.
- [ ] **Breaking interface changes**: Flag changes to exported function signatures, type definitions, or shared interfaces that alter the contract — renamed fields, removed parameters, changed return types, narrowed union types. In a monorepo, these can silently break consumers in other packages. Flag when there's no corresponding update to callers visible in the diff, and no migration note or changelog entry.
- [ ] **Large binary/asset additions**: Flag images, fonts, PDFs, video files, database dumps, or other binary assets added directly to the repo, especially files over 500KB. These inflate the git history permanently and typically belong in a CDN, object store, or asset pipeline. Small icons and favicons are fine.
