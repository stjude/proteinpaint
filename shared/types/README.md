# @sjcrh/proteinpaint-types

## Background

This workspace was separated from the deprecated `server/shared/types` dir.
The type definitions here are meant to used by the tsc compiler, and will not
be included in runtime bundles.

Put type definitions that are used in client and server code in this workspace.
Do NOT put here type definitions that are specific to one workspace,
those should be saved in the applicable workspace.

## Develop

IMPORTANT: When changing source code that are used to generate runtime 
checker code, run `npm run generate` after saving changes. This package
script will call `typia` to generate runtime code from typescript markup. 
If there are lots of iterations in editing type definitions that could 
affect run time code generation, you may call `npm run dev` which will
watch changed `src` files and trigger a call to `typia` to regenerate `dist`
runtime code.

Consumer code can use type definitions from `@sjcrh/proteinpaint-types`,
which maps to `src/index.ts`.

Consumer code may also use runtime code from `@sjcrh/proteinpaint-types/checkers`,
which maps to 
- `dist/index.js` for server code in nodejs env 
- `[public_dir]/dist/*.js` for client code in browser environment, requires symlinking
from `@sjcrh/proteinpaint-types/dist` to somewhere under `public` dir.

Note that in dev environment, `tsx` and `esbuild` are expected to directly transform
`dist/*.ts` files for server and browser usage, respectively.

## Test

```sh
npm test
```