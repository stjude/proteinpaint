#!/bin/bash

# Scans the commits to push for secrets with pre-commit, which runs the detect-secrets hook.
#
# usage:
#   scan-secrets.sh <remote>   # from a pre-push hook, reads its stdin
#
# Each commit to push is scanned, instead of the working tree, so that the scan works when the pushed branch
# is not checked out, and also checks a secret that is added in one commit and removed in a later one.
# The changed files of each commit are written to a temporary repo, together with the commit's
# .pre-commit-config.yaml and .secrets.baseline, and pre-commit is run there on those files.
# A merge commit is skipped, its changed files from the merged branch are scanned in that branch's commits.

REMOTE=$1
ROOT=$(git rev-parse --show-toplevel)
SCANDIR=$(mktemp -d)
trap 'rm -rf "$SCANDIR"' EXIT

# The git env variables that may be set for a hook are unset, so that git commands, including the ones
# that pre-commit runs, use the temporary repo instead of this repo
GITENV=(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_PREFIX)
"${GITENV[@]}" git init -q "$SCANDIR/repo" || exit 1
SCANNED="$SCANDIR/scanned"
touch "$SCANNED"

# writes the changed files of a commit to the temporary repo, and runs pre-commit on them
scan_commit() {
	local COMMIT=$1 FILES=() META MODE SHA FILE CONFIG OUT CODE
	find "$SCANDIR/repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
	# -z output: ":<old mode> <new mode> <old sha> <new sha> <status>" NUL "<path>" NUL, for each file
	while IFS= read -r -d '' META && IFS= read -r -d '' FILE; do
		read -r _ MODE _ SHA _ <<< "$META"
		# skip a submodule or symlink, which is not a file with content to scan
		if [[ "$MODE" != 100* ]]; then continue; fi
		mkdir -p "$SCANDIR/repo/$(dirname "$FILE")"
		git cat-file blob "$SHA" > "$SCANDIR/repo/$FILE"
		FILES+=("$FILE")
	done < <(git diff-tree -r -z --no-commit-id --no-renames --diff-filter=ACM --raw "$COMMIT")
	if [[ ${#FILES[@]} -eq 0 ]]; then return 0; fi

	for CONFIG in .pre-commit-config.yaml .secrets.baseline; do
		git show "$COMMIT:$CONFIG" > "$SCANDIR/repo/$CONFIG" 2>/dev/null || cp "$ROOT/$CONFIG" "$SCANDIR/repo/$CONFIG"
	done

	CODE=0
	OUT=$(cd "$SCANDIR/repo" && "${GITENV[@]}" pre-commit run --files "${FILES[@]}" 2>&1) || CODE=$?
	# detect-secrets exits with 3 when it only updates the line numbers in the baseline, which is not
	# a new secret, such as when the commit's baseline was not updated after the lines were moved
	if [[ "$OUT" == *"Potential secrets about to be committed"* ]] || [[ $CODE -ne 0 && "$OUT" != *"The baseline file was updated"* ]]; then
		echo "--- commit $(git log -1 --format='%h %s' "$COMMIT") ---"
		echo "$OUT"
		return 1
	fi
}

STATUS=0
NUMCOMMITS=0
while read -r LOCALREF LOCALSHA REMOTEREF REMOTESHA; do
	# skip the deletion of a remote ref
	if [[ ! "$LOCALSHA" =~ [1-9a-f] ]]; then continue; fi
	# only scan the commits that are not on the destination remote yet, same as in check-text.sh
	if [[ "$REMOTE" != "" ]] && git remote get-url "$REMOTE" > /dev/null 2>&1; then
		RANGE=("$LOCALSHA" --not "--remotes=$REMOTE")
	else
		RANGE=("$LOCALSHA" --not --remotes)
	fi
	if [[ "$REMOTESHA" =~ [1-9a-f] ]] && git cat-file -e "$REMOTESHA" 2>/dev/null; then
		RANGE+=(--not "$REMOTESHA")
	fi
	for COMMIT in $(git rev-list --no-merges "${RANGE[@]}"); do
		# a commit can be in more than one pushed ref
		if grep -qx "$COMMIT" "$SCANNED"; then continue; fi
		echo "$COMMIT" >> "$SCANNED"
		NUMCOMMITS=$((NUMCOMMITS + 1))
		scan_commit "$COMMIT" || STATUS=1
	done
done

echo "number of commits scanned for secrets=$NUMCOMMITS"
if [[ $STATUS -ne 0 ]]; then
	echo "--- push aborted: potential secrets found in the commits above ---"
fi
exit $STATUS
