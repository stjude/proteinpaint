#!/bin/bash
SHATESTED="$1"

if [[ "$SHATESTED" == "" ]]; then
	URLRUNS="https://api.github.com/repos/stjude/proteinpaint/actions/runs?status=success&branch=master&event=push"
	UNITRUNS=$(curl -sL -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$URLRUNS" > ./runs.json)
	SHA_IN_COMMIT=$(git rev-list -n10 HEAD)
	SHA_TESTED_LIST=$(node -p "(require('./runs.json')).workflow_runs?.filter(r => r.display_title != 'append release notes to change log').map(r => r.head_sha).join(' ')")
	rm runs.json
	for SHA in $SHA_TESTED_LIST; do
		if [[ "$SHA_IN_COMMIT" ==  *"$SHA"* ]]; then
			SHATESTED=$SHA
			break
		fi
	done
fi

if [[ "$SHATESTED" == "" ]]; then
	SHATESTED=$(git rev-parse HEAD~7)
fi

CHANGEDFILES="$(git diff --name-only HEAD $SHATESTED)"

IS_CODE_OR_CONFIG="f => !f.endsWith('.md') && (!f.endsWith('.txt') || f.startsWith('server/test/tp')) && !f.endsWith('ignore') && f != 'LICENSE' && f != 'DESCRIPTION'"
RELEVANTFILES=$(node -p "(\`$CHANGEDFILES\`).split('\n').filter($IS_CODE_OR_CONFIG).join('\n')")
# patch is used only to satisfy the version type argument, can be any other allowed value  
CHANGEDWS="$(./build/bump.cjs patch -c=$SHATESTED)"
WS_TO_TEST=""
for ws in $CHANGEDWS; do
	# QUICK FIX to detect rust ws as changed when test tp files have changed
	if [[ "$RELEVANTFILES" == *"$ws/"* || ("$ws" == "rust" && "$RELEVANTFILES" == *"server/test/tp"*) ]]; then
		WS_TO_TEST="$WS_TO_TEST $ws"
	fi
done
echo "$WS_TO_TEST"
