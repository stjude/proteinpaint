# @sjcrh/proteinpaint-shared

## Background

This workspace was separate from the deprecated `server/shared` dir.
The code here are meant to be consumed at runtime by either client or server
code.

IMPORTANT: 
- code must work in browser and nodejs: do not import libs, deps, or globals that
are specific to `nodejs` or `browser` environments, like `fs` or `DOM` elements

## Test

```sh
npm test
```