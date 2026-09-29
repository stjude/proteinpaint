#!/usr/bin/env bash
# Lists open GitHub code scanning alerts as tab-separated rows, sorted by severity, rule, and file,
# so that alerts with the same rule in the same file (which often share one cause) are adjacent.
#
# usage: list-alerts.sh [--severity critical|high|medium|low] [--rule <rule id>] [--path <path prefix>] [--repo owner/name]
#
# columns: number, severity, rule, path:line:col, commit_sha, assignees
#   - severity is the security severity when available, otherwise the rule severity
#   - the list endpoint does not include the tainted sources of an alert, fetch a single alert for those

set -euo pipefail

repo=stjude/proteinpaint
severity=
rule=
pathprefix=

while [[ $# -gt 0 ]]; do
	case "$1" in
	--severity) severity=$2; shift 2 ;;
	--rule) rule=$2; shift 2 ;;
	--path) pathprefix=$2; shift 2 ;;
	--repo) repo=$2; shift 2 ;;
	*) echo "unknown argument: $1" >&2; exit 1 ;;
	esac
done

query="state=open&per_page=100"
if [[ -n $severity ]]; then query="$query&severity=$severity"; fi

printf 'number\tseverity\trule\tlocation\tcommit_sha\tassignees\n'
gh api --paginate "repos/$repo/code-scanning/alerts?$query" --jq '
	.[]
	| .most_recent_instance as $i
	| [
		.number,
		(.rule.security_severity_level // .rule.severity),
		.rule.id,
		"\($i.location.path):\($i.location.start_line):\($i.location.start_column)",
		$i.commit_sha,
		([.assignees[]?.login] | join(","))
	]
	| @tsv' |
	awk -F'\t' -v rule="$rule" -v pathprefix="$pathprefix" '
		(rule == "" || $3 == rule) && (pathprefix == "" || index($4, pathprefix) == 1)
	' |
	awk -F'\t' 'BEGIN { OFS = "\t"; rank["critical"] = 1; rank["high"] = 2; rank["error"] = 2; rank["medium"] = 3; rank["warning"] = 3; rank["low"] = 4; rank["note"] = 5 }
		{ print (rank[$2] ? rank[$2] : 9), $0 }' |
	sort -t$'\t' -k1,1n -k4,4 -k5,5V |
	cut -f2-
