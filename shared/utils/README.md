# @sjcrh/proteinpaint-shared

## Background

This workspace was separate from the deprecated `server/shared` dir.
The code here are meant to be consumed at runtime by either client or server
code.

IMPORTANT: 
- code must work in browser and nodejs: do not import libs, deps, or globals that
are specific to `nodejs` or `browser` environments, like `fs` or `DOM` elements

## Develop

For server dev, the `tsx` library will accept imports with or without file extension,
and is able to correctly resolve imports of '.js' files that are actually '.ts'
files, which is done to comply with tsc compiler requirements. Server (consumer)
code MUST use the `.js` file extension even when importing `#shared/*.ts` files.

For client dev, the esbuild config will bundle the #shared imports correctly, using
custom plugins like dirname. 

## Build

This package will be bundled as part of the client dependencies. 

For server builds, run `npm run build` to generate `src/*.js` from `src/*.ts` files.
This is also automatically done as part of the `prepack` package script. 

NOTE: For now, only code in `.js` files. OR, if using `.ts` files, 
then commit the generated `.js` files, until a dev script or another approach
can take care of the `.js` file requirement.

## Test

```sh
npm test
```