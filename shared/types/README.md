# @sjcrh/proteinpaint-types

## Background

This workspace was separated from the deprecated `server/shared/types` dir.
Constants and other runtime code will be exported at runtime - please limit
runtime code for constants and straightforward type guards. Type definitions
here are meant to be used by the tsc compiler, and will not be included in the runtime bundle.

Put type definitions that are used in *both* client and server code in this workspace.
Do NOT put here type definitions that are specific to one workspace,
those should be saved in the applicable workspace.

## Develop

Consumer code can use type definitions from `@sjcrh/proteinpaint-types`,
which maps to `src/index.ts` in dev environments where `--conditions=sjpp/dev`
is set as a Node option when running a dev or test script.

Consumer code may also import prod runtime code from `@sjcrh/proteinpaint-types`
which maps to `dist/index.js`.

## Test

```sh
npm test
```