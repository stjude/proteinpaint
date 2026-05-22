# @sjcrh/proteinpaint-shared

## Background

This workspace was separate from the deprecated `server/shared` dir.
The code here are meant to be consumed at runtime by either client or server
code. Do NOT put utility/helper code here that are specific to only one
workspace, those files should be saved in that workspace.

IMPORTANT: 
- Shared code must work in browser and nodejs: do not import libs, deps, or globals that
are specific to `nodejs` or `browser` environments, like `fs` or `DOM` elements.
- Except for contants, do not import from this workspace (aka `@sjcrh/proteinpaint-shared/` 
or `#shared`) into `shared/types` as that will cause cyclical imports that break bundler 
startup or `tsc` compilation.

## Develop

It is much simpler to import directly from `@sjcrh/proteinpaint-shared`. Avoid file-specific 
imports unless tree-shaking performance is a concern. If a specific shared file must be imported,
prefer an alias such as `#shared/someFile.js`, which shields importers from shared code
file renames or reorganizations.

For server dev, the `tsx` library will accept imports with or without file extension.
Server (consumer) code should use `@sjcrh/proteinpaint-shared`, or if for some reason
a shared file must be specific, it MUST use the `.js` file extension (e.g., 
`#shared/someFile.js`).

For client dev, the esbuild config will bundle the `#shared` imports correctly, even
when `.js` extension is used to import what is actually a `.ts` file.

Do not import from `#shared/utils` to `#shared/types` - it may cause `tsc` compilation or `esbuild`
build errors. Only imports in the opposite direction, from `shared/types` to `shared/utils`, is allowed
to to ensure that there are no cyclical imports that breaks type checks or bundling.

## Build

This package will be bundled as part of the client dependencies. 

For server builds, run `npm run build` to generate `src/*.js` from `src/*.ts` files.
This is also automatically done as part of the `prepack` package script. 

NOTE: For now, only code in `.js` files. 

### If using `.ts` files:
1. commit the generated `.js` files
2. add the js file to package.json prettier command
keep doing this until a dev script or another approach can take care of the `.js` file requirement.

## Test

```sh
# run all tests
npm test

# run one script
node test/mds3tk.unit.spec.js
```
