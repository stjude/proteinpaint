#!/bin/bash

URLRUNS="https://api.github.com/repos/stjude/proteinpaint/actions/runs?status=success&branch=master&event=push"
UNITRUNS=$(curl -sL -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$URLRUNS" > ./runs.json)
SHATESTED=$(node -p "(require('./runs.json')).workflow_runs?.find(r => r.display_title != 'append release notes to change log')?.head_sha")
rm runs.json
CHANGEDFILES="$(git diff --name-only HEAD $SHATESTED)"
if [[ "$SHATESTED" == "" ]]; then
	echo "$CHANGEDFILES"
else 
	IS_CODE_OR_CONFIG="f => !f.endsWith('.md') && !f.endsWith('.txt') && !f.endsWith('ignore') && f != 'LICENSE' && f != 'DESCRIPTION'"
	RELEVANTFILES=$(node -p "(\`$CHANGEDFILES\`).split('\n').filter($IS_CODE_OR_CONFIG).join('\n')")
	echo "$RELEVANTFILES"
fi
