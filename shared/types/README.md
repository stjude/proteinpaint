# @sjcrh/proteinpaint-types

## Background

This workspace was separated from the deprecated `server/shared/types` dir.
The type definitions here are meant to used by the tsc compiler, and will not
be included in runtime bundles.

Put type definitions that are used in client and server code in this workspace.
Do NOT put here type definitions that are specific to one workspace,
those should be saved in the applicable workspace.

## Develop

Consumer code can use type definitions b


## Test

```sh
npm test
```