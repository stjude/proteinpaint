# Shared Constants

The goal of the `constants` code to allow shared/types code to be able to import type definitions 
from shared/utils with no bundling or tsc compilation issues. Ideally, there would be a separate
`shared/constants` workspace. However, due to time constraints and effort required to set up a 
new workspace, this `shared/utils/constants` directory was created instead.

The code files in proteinpaint/shared/utils/constants:
- typescript files
- must have no imports from outside this folder, to prevent cyclical references/imports that crash bundling and/or tsc compilation
- must export constants that can be transitively exported to devTs.ts file and shared/utils/src/index.js
