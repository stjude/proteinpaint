#!/bin/bash

# Claude Code PreToolUse hook for the Bash tool, see .claude/settings.json:
# - blocks a git command that skips the git hooks or the text check
# - checks the text of git and gh commands that will be public with check-text.sh
# Exits with 2 to block the command, which shows the stderr message to the agent.

INPUT=$(cat)
DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
CMD=$(echo "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command||"")}catch(e){}})')
CWD=$(echo "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).cwd||"")}catch(e){}})')
CWD=${CWD:-$(pwd)}

GITCMD='(^|[^[:alnum:]_.-])git[[:space:]]'
GHCMD='(^|[^[:alnum:]_.-])gh[[:space:]]+((pr|issue|release|label)[[:space:]]+(create|edit|comment|review|close|merge)|api[[:space:]])'
# the rest of one git command, which ends at a shell separator, a newline, or a backtick
GITARGS=$'[^;&|`\n]*'

if [[ "$CMD" =~ SKIP_TEXT_CHECK=[^[:space:]]*[[:space:]]+(git|gh)[[:space:]] ]] ||
	[[ "$CMD" =~ export[[:space:]]+SKIP_TEXT_CHECK ]] ||
	[[ "$CMD" =~ $GITCMD$GITARGS(--no-verify|core\.hooksPath) ]] ||
	[[ "$CMD" =~ $GITCMD[[:space:]]*commit([[:space:]]+-[[:alpha:]]+)*[[:space:]]+-[[:alpha:]]*n[[:alpha:]]*([[:space:]]|$) ]]; then
	echo "Do not skip the git hooks or the text check. If the check flags a false positive, or the fix is already deployed to prod, ask the user to run the command." >&2
	exit 2
fi

if [[ ! "$CMD" =~ $GITCMD[[:space:]]*(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(commit|checkout|switch|branch|worktree|push|tag|subrepo) ]] &&
	[[ ! "$CMD" =~ $GHCMD ]]; then
	exit 0
fi

# skip the check when the command clearly targets the private sjpp repo
TARGETDIR=$CWD
if [[ "$CMD" =~ ^cd[[:space:]]+([^[:space:]\;\&]+) ]]; then TARGETDIR=${BASH_REMATCH[1]}; fi
if [[ "$CMD" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+) ]]; then TARGETDIR=${BASH_REMATCH[1]}; fi
TARGETDIR=${TARGETDIR/#\~/$HOME}
if [[ "$TARGETDIR" != /* ]]; then TARGETDIR="$CWD/$TARGETDIR"; fi
TARGET=$(git -C "$TARGETDIR" remote get-url origin 2>/dev/null)
if [[ "$CMD" =~ (-R|--repo)[=[:space:]]+([^[:space:]]+) ]]; then TARGET=${BASH_REMATCH[2]}; fi
if [[ "$CMD" =~ $GHCMD && "$CMD" =~ repos/([^/[:space:]]+/[^/[:space:]]+) ]]; then TARGET=${BASH_REMATCH[1]}; fi
if [[ "$TARGET" =~ stjude/sjpp(\.git)?$ ]]; then
	if [[ ! "$CMD" =~ $GITCMD || ! "$CMD" =~ (ppgdc|ppmmrf) ]]; then exit 0; fi
fi

# also check the text in files that are passed to gh, such as with --body-file
TEXT=$CMD
FILEARG='(--body-file|--notes-file|--input|-F)[=[:space:]]+([^[:space:]]+)'
REST=$CMD
while [[ "$REST" =~ $FILEARG ]]; do
	FILE=${BASH_REMATCH[2]}
	FILE=${FILE#@}
	if [[ "$FILE" != /* ]]; then FILE="$CWD/$FILE"; fi
	if [[ -f "$FILE" ]]; then TEXT="$TEXT"$'\n'"$(cat "$FILE")"; fi
	REST=${REST#*"${BASH_REMATCH[0]}"}
done

echo "$TEXT" | "$DIR/check-text.sh" text "command text" || exit 2
exit 0
