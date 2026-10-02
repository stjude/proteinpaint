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
- Use `clippy`: Rust linter to check for common code errors. For now we only fail the commit if there are errors. In the future we will also fail with warnings
- Detect secrets: to not accidentally expose what may be secret string
- Check the added lines with `check-text.sh`, see below

### commit-msg

- Check the commit message with `check-text.sh`, see below
- Update `release.txt` from the commit message

### pre-push

- Detect secrets: run again, in case the pre-commit hook missed something
- Check the pushed branch name, and the messages and added lines of the commits to push, with `check-text.sh`

### reference-transaction

- Check the name of a new branch with `check-text.sh` before it's created, such as by `git checkout -b`,
  `git switch -c`, `git branch`, or `git worktree add -b`. A renamed branch is checked by the pre-push hook.

### check-text.sh

Checks text that will be public for terms that describe the issue that a change fixes, instead of what the code does,
see the "Security-related changes" section in `AGENTS.md`. The generic terms are in `text-check-patterns.txt`.
More specific terms, which should not be in this public repo, are read from an optional private terms file
at `$PP_TEXT_CHECK_TERMS`, `git config pp.textCheckTerms` (set by `init.sh` when this repo is checked out
within sjpp), or `../../../security-triage/text-check-terms.txt` relative to this directory.
Set `SKIP_TEXT_CHECK=1` to skip the check, such as when the fix is already deployed to prod.

### claude-bash-check.cjs

A Claude Code `PreToolUse` hook, configured in `.claude/settings.json`. It blocks an agent's git command
that skips the git hooks or the text check, and checks the text of git and gh commands that will be public,
such as PR titles and descriptions, and the files that gh reads such as with `--body-file`, with `check-text.sh`.
It splits the command into simple commands without running it, to find the working directory and target repo
of each git and gh invocation.

## Install

From the `proteinpaint` dir, run `npm run sethooks` which calls the `init.sh` script (`./utils/hooks/init.sh`).
