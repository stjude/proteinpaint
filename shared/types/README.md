# @sjcrh/proteinpaint-types

## Background

This workspace was separated from the deprecated `server/shared/types` dir.
The type definitions here are meant to used by the tsc compiler, and will not
be included in runtime bundles.

Put type definitions that are used in *both* client and server code in this workspace.
Do NOT put here type definitions that are specific to one workspace,
those should be saved in the applicable workspace.

## Develop

Consumer code can use type definitions from `@sjcrh/proteinpaint-types`,
which maps to `src/index.ts` in dev environments where `--conditions=sjpp/dev`
is set as a Node option when running a dev or test script.

Consumer code may also import runtime code from `@sjcrh/proteinpaint-types`
which maps to `dist/index.js`.

## Test

```sh
npm test
```