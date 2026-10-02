#!/bin/bash

# Checks text that will be public for terms that describe a security issue instead of
# what the code does, see the "Security-related changes" section in AGENTS.md.
#
# usage:
#   <text> | check-text.sh text <label>        # commit message, branch name, PR text
#   <unified diff> | check-text.sh diff <label> # only the added lines are checked
#   check-text.sh commit-msg <file> [label]     # from a commit-msg hook
#   check-text.sh push <remote>                 # from a pre-push hook, reads its stdin
#
# The terms are read from text-check-patterns.txt in this directory, and from an optional
# private terms file, which is found at $PP_TEXT_CHECK_TERMS, `git config pp.textCheckTerms`,
# or ../../../security-triage/text-check-terms.txt relative to this directory.
#
# Set SKIP_TEXT_CHECK=1 to skip the check, such as when the fix is already deployed to prod.

MODE=$1
LABEL=${2:-$MODE}
DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

if [[ "$SKIP_TEXT_CHECK" == "1" ]]; then
	cat > /dev/null
	exit 0
fi

if [[ "$MODE" == "commit-msg" ]]; then
	# check the text that git will keep: like git's default cleanup, the comment lines are
	# removed only when the message is from the editor, which adds the comment below,
	# and not when it's from `git commit -m` or `-F`
	CLEANUP=$(git config --get commit.cleanup)
	if [[ "$CLEANUP" != "verbatim" && "$CLEANUP" != "whitespace" && "$CLEANUP" != "scissors" ]] &&
		grep -q '^# Please enter the commit message' "$2"; then
		STRIP=(git stripspace --strip-comments)
	else
		STRIP=(cat)
	fi
	# remove the text below a scissors line that git adds, such as for the `git commit -v` diff,
	# which git also removes, but not below a scissors line in a message from `-m` or `-F`
	awk '
		/^# -* >8 -*$/ {
			cut = $0
			if ((getline line) <= 0) { print cut; next }
			if (line ~ /^# Do not modify or remove the line above/) exit
			print cut
			print line
			next
		}
		{ print }
	' "$2" | "${STRIP[@]}" | "$0" text "${3:-commit message}"
	exit
fi

if [[ "$MODE" == "push" ]]; then
	REMOTE=$2
	STATUS=0
	while read -r LOCALREF LOCALSHA REMOTEREF REMOTESHA; do
		# skip the deletion of a remote ref
		if [[ ! "$LOCALSHA" =~ [1-9a-f] ]]; then continue; fi
		echo "${REMOTEREF#refs/*/}" | "$0" text "pushed ref name" || STATUS=1
		if [[ "$REMOTESHA" =~ [1-9a-f] ]] && git cat-file -e "$REMOTESHA" 2>/dev/null; then
			RANGE=("$REMOTESHA..$LOCALSHA")
		else
			# a new remote ref: only check the commits that are not on the destination remote yet,
			# or on any remote when the destination is a url instead of a configured remote
			if [[ "$REMOTE" != "" ]] && git remote get-url "$REMOTE" > /dev/null 2>&1; then
				RANGE=("$LOCALSHA" --not "--remotes=$REMOTE")
			else
				RANGE=("$LOCALSHA" --not --remotes)
			fi
		fi
		git log --format=%B "${RANGE[@]}" | "$0" text "commit messages to push" || STATUS=1
		# --remerge-diff shows the lines that a merge commit adds, such as when resolving a conflict
		git log -p --remerge-diff -U0 --no-color --no-ext-diff --format= "${RANGE[@]}" | "$0" diff "commits to push" || STATUS=1
	done
	exit $STATUS
fi

TERMS=${PP_TEXT_CHECK_TERMS:-$(git config --get pp.textCheckTerms 2>/dev/null)}
TERMS=${TERMS:-$DIR/../../../security-triage/text-check-terms.txt}
PATTERNS=$(mktemp)
trap 'rm -f "$PATTERNS"' EXIT
cat "$DIR/text-check-patterns.txt" "$TERMS" 2>/dev/null | grep -v -E '^[[:space:]]*(#|$)' > "$PATTERNS"
grep -i -E -f "$PATTERNS" < /dev/null > /dev/null 2>&1
if [[ $? -gt 1 ]]; then
	cat > /dev/null
	echo "!!! $LABEL: not checked, since there is an invalid expression in $DIR/text-check-patterns.txt or $TERMS !!!" >&2
	exit 1
fi

if [[ "$MODE" == "diff" ]]; then
	# print each added line as <file>:<line>: <text>, except in files that list the terms or do the check
	HITS=$(awk '
		/^--- / { header = 1; next }
		header && /^\+\+\+ / {
			header = 0
			file = substr($0, 7)
			skip = file ~ /(^|\/)(AGENTS\.md|CLAUDE\.md|text-check-patterns\.txt|text-check-terms\.txt|check-text\.sh|claude-bash-check\.cjs|package-lock\.json)$/
			next
		}
		/^@@ / { split($3, a, ","); line = substr(a[1], 2) + 0; next }
		/^\+/ { if (!skip) print file ":" line ": " substr($0, 2); line++; next }
		/^ / { line++ }
	' | grep -i -E -f "$PATTERNS")
else
	HITS=$(grep -n -i -E -f "$PATTERNS")
fi

if [[ "$HITS" == "" ]]; then exit 0; fi

echo "" >&2
echo "!!! $LABEL: text that may describe a security issue instead of what the code does !!!" >&2
echo "$HITS" | cut -c1-200 | sed 's/^/  /' >&2
echo "Reword it, see the 'Security-related changes' section in AGENTS.md." >&2
echo "If the fix is already deployed to prod, or this is a false positive, rerun with SKIP_TEXT_CHECK=1." >&2
echo "" >&2
exit 1
