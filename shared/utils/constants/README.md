# Shared Constants

The code files in proteinpaint/shared/utils/constants must be:
- typescript files
- have no imports, to prevent cyclical references/imports that crashes bundling and/or tsc compilation
- export constants that can be transitively exported by shared/utils/src/index.js code

The goal is to allow shared/types code to be able to import type definitions from shared/utils
with no bundling or tsc compilation issues.
