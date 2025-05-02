# ProteinPaint git hooks

## Background

The hooks/scripts in this directory are triggered by the corresponding git command
with a matching name.

- eslint
- eslint-config-prettier
- @typescript-eslint/eslint-plugin

### pre-commit

- Use `prettier`: to make coding style consistent, diffs less noisy and code reviews easier
- Use `rustfmt`: serves the same function as `prettier` but for Rust code
- Use `clippy`: Rust linter to check for common code errors
- Detect secrets: to not accidentally expose what may be secret string

### pre-push

- Detect secrets: run again, in case the pre-commit hook missed something

## Install

From the `proteinpaint` dir, run `npm run sethooks` which calls this script (`./utils/hooks/init.sh`).
