## Code Style & Structure

Applies to this workspace only. 

### In-file code layout

A developer should easily recognize familiar patterns and follow the code execution flow.

Structure files in the following order:
1. Imports (external libraries first, then local paths)
2. Types / Interfaces (TypeScript or other typed languages only)
3. Immediate invocation of a main function, if applicable
4. A main function containing core execution logic. It should be named after the filename (preferred) or `main()`.
  - This should read like a short, ordered list of high-level instructions
  - Most of the steps should call a function that has more logic and details
5. Helper / Utility functions

For `.ts` and `.js` files:
- Prefer ESM over commonjs, except for devops or utility scripts.
- Prefer named functions that can be called ahead of its declaration block, allowing a main function to be declared at the beginning.

## Code Architecture & Patterns

<!--
Simplify execution paths and reduces LLM reasoning errors

Why to Include ThisReduces Cognitive Load: 
- Early routing separates decision-making from execution logic: especially useful for mutually exclusive code/data processing flows
- Improves LLM Performance: Smaller, specialized prompts perform better than massive conditional ones.
- Simplifies Testing: Individual execution paths can be isolated and tested independently.
-->

### 1. Router-First Pattern (Early Branching)
To minimize nested `if-else` conditionals and prevent downstream complexity, always use a routing layer at the earliest possible entry point. 

#### Principle
* Classify the intent or request type immediately.
* Hand off execution to a dedicated, single-purpose function or specialized sub-agent.
* Keep downstream code completely oblivious to alternative execution paths.

## Tests

### CLI code

Exercise logic in-process, off disk — inject the side-effecting dependency (defaulting to the real one, so production is unchanged) instead of spawning the CLI or writing temp files:

- Route commands through an injectable runner (`ctx.execSync`, default `child_process.execSync`) and file reads through injectable content (`config.instances[*].rawDirectives`, else read disk). Examples: `context.js`, `validate.config.js`, `test/rollout.inproc.js`.
- Guard each CLI entry with `if (require.main === module)` and export its function, so tests call it in-process with the fakes.
- Fakes match the command/input and FAIL CLOSED: an unmodeled command throws, so drift surfaces instead of passing silently.
- Keep 1–2 real subprocess smoke tests per entry point (context creation + exit-code propagation; `test/cli.smoke.test.js`).
- Keep injectables minimal — seam only at the boundary to proven system libraries (`fs`, `child_process`), at the highest level that still runs your own logic: enough to cover production code, not so deep the test re-verifies the stdlib or so broad it litters production with seams.
