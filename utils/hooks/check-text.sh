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
# Each line is checked, and also each pair of consecutive lines, for a term that is wrapped onto the next line.
# In the text mode, each all-caps word is also checked for a term from a line that starts with caps:.
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
		# only check the commits that are not on the destination remote yet, or on any remote when the
		# destination is a url instead of a configured remote. This excludes the commits that are already
		# in the remote master, such as after the branch is rebased onto a newer master, which the range
		# $REMOTESHA..$LOCALSHA would include
		if [[ "$REMOTE" != "" ]] && git remote get-url "$REMOTE" > /dev/null 2>&1; then
			RANGE=("$LOCALSHA" --not "--remotes=$REMOTE")
		else
			RANGE=("$LOCALSHA" --not --remotes)
		fi
		if [[ "$REMOTESHA" =~ [1-9a-f] ]] && git cat-file -e "$REMOTESHA" 2>/dev/null; then
			RANGE+=(--not "$REMOTESHA")
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
CAPS=$(mktemp)
trap 'rm -f "$PATTERNS" "$CAPS"' EXIT
ALLPATTERNS=$(cat "$DIR/text-check-patterns.txt" "$TERMS" 2>/dev/null | grep -v -E '^[[:space:]]*(#|$)')
printf '%s\n' "$ALLPATTERNS" | grep -v '^caps:' > "$PATTERNS"
printf '%s\n' "$ALLPATTERNS" | sed -n 's/^caps://p' > "$CAPS"
grep -i -E -f "$PATTERNS" < /dev/null > /dev/null 2>&1
STATUS=$?
grep -i -E -f "$CAPS" < /dev/null > /dev/null 2>&1
if [[ $STATUS -gt 1 || $? -gt 1 ]]; then
	cat > /dev/null
	echo "!!! $LABEL: not checked, since there is an invalid expression in $DIR/text-check-patterns.txt or $TERMS !!!" >&2
	exit 1
fi

# each line to check is printed as <file>\037<line>\037<text>, with an empty <file> for text
if [[ "$MODE" == "diff" ]]; then
	# the added lines, except in files that list the terms or do the check
	LINES=$(awk '
		/^--- / { header = 1; next }
		header && /^\+\+\+ / {
			header = 0
			file = substr($0, 7)
			skip = file ~ /(^|\/)(AGENTS\.md|CLAUDE\.md|text-check-patterns\.txt|text-check-terms\.txt|check-text\.sh|claude-bash-check\.cjs|package-lock\.json)$/
			next
		}
		/^@@ / { split($3, a, ","); line = substr(a[1], 2) + 0; next }
		/^\+/ { if (!skip) print file "\037" line "\037" substr($0, 2); line++; next }
		/^ / { line++ }
	')
else
	LINES=$(awk '{ print "\037" NR "\037" $0 }')
fi

# each line as <file>:<line>: <text>, or <line>:<text> for text, like grep -n
FORMATTED=$(printf '%s\n' "$LINES" | awk -F '\037' 'NF { print ($1 == "" ? $2 ":" : $1 ":" $2 ": ") $3 }')
# the matching lines as <index>:<formatted line>, where <index> is its line number in FORMATTED
MATCHED=$(printf '%s\n' "$FORMATTED" | grep -n -i -E -f "$PATTERNS")

# Also check each pair of consecutive lines as one line, for a term that is wrapped onto the next line, such as
# in a code comment or commit message. The next line is joined without its indent and comment marker. Line <index>
# of JOINED is the pair of FORMATTED lines <index> and <index> + 1, or empty when those are not consecutive lines.
JOINED=$(printf '%s\n' "$LINES" | awk -F '\037' '
	!NF { next }
	n++ {
		if ($1 != file || $2 != line + 1) print ""
		else {
			a = text
			sub(/[[:space:]]+$/, "", a)
			b = $3
			sub(/^[[:space:]]*(\/\/+|#+|\/?\*+|--|;+|<!--)?[[:space:]]*/, "", b)
			print ($1 == "" ? line "-" $2 ":" : $1 ":" line "-" $2 ": ") a " " b
		}
	}
	{ file = $1; line = $2; text = $3 }
')
PAIRED=$(printf '%s\n' "$JOINED" | grep -n -i -E -f "$PATTERNS")

# a pair is only reported when neither of its lines matches by itself, since that line is already reported
HITS=$({
	printf '%s\n' "$MATCHED"
	printf '%s\n' "$PAIRED" | sed 's/^/pair:/'
} | awk '
	/^pair:./ {
		sub(/^pair:/, "")
		i = $0
		sub(/:.*/, "", i)
		if (!((i in single) || ((i + 1) in single))) print substr($0, length(i) + 2)
		next
	}
	NF {
		i = $0
		sub(/:.*/, "", i)
		single[i] = 1
		print substr($0, length(i) + 2)
	}
')

# In the text mode, also check each all-caps word, such as an env var or constant name, for a caps: term.
# Each word is printed as <line>\037<word>, and matched by itself, so that a caps: term can be anchored to the word.
if [[ "$MODE" == "text" ]]; then
	WORDS=$(printf '%s\n' "$LINES" | awk -F '\037' '
		NF {
			n = split($3, w, /[^A-Za-z0-9_]+/)
			for (i = 1; i <= n; i++) {
				if (w[i] ~ /^[A-Z0-9_]+$/ && w[i] ~ /[A-Z].*[A-Z]/) print $2 "\037" w[i]
			}
		}
	')
	# the index of each matching word in WORDS
	WORDHITS=$(printf '%s\n' "$WORDS" | awk -F '\037' '{ print $2 }' | grep -n -i -E -f "$CAPS" | cut -d: -f1)
	# each line with a matching word as <line>:<text>  (all-caps: <words>)
	CAPSHITS=$(awk -F '\037' '
		FNR == 1 { f++ }
		f == 1 { if (NF) hit[$0] = 1; next }
		f == 2 {
			if ((FNR in hit) && !(($1, $2) in seen)) {
				seen[$1, $2] = 1
				words[$1] = (($1 in words) ? words[$1] ", " : "") $2
			}
			next
		}
		NF && ($2 in words) { print $2 ":" $3 "  (all-caps: " words[$2] ")" }
	' <(printf '%s\n' "$WORDHITS") <(printf '%s\n' "$WORDS") <(printf '%s\n' "$LINES"))
fi

if [[ "$HITS" == "" && "$CAPSHITS" == "" ]]; then exit 0; fi

echo "" >&2
if [[ "$HITS" != "" ]]; then
	echo "!!! $LABEL: text that may describe a security issue instead of what the code does !!!" >&2
	echo "$HITS" | cut -c1-200 | sed 's/^/  /' >&2
	echo "Reword it, see the 'Security-related changes' section in AGENTS.md." >&2
fi
if [[ "$CAPSHITS" != "" ]]; then
	echo "!!! $LABEL: all-caps words that stand out and may be associated with security !!!" >&2
	echo "$CAPSHITS" | cut -c1-200 | sed 's/^/  /' >&2
	echo "Reword the text or remove the all-caps word, see the 'Security-related changes' section in AGENTS.md." >&2
fi
echo "If the fix is already deployed to prod, or this is a false positive, rerun with SKIP_TEXT_CHECK=1." >&2
echo "" >&2
exit 1
