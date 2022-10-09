#!/bin/bash

set -e

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
	TYPE=$1
fi

ENV=$2
if [[ "$ENV" != "" && ! -d ./sj/$ENV ]]; then
	echo "unknown ENV='$ENV'"
	exit 1
fi

MODE=$3

echo "setting package versions"

ROOTVERSION=$(node -p "require('./package.json').version")
git fetch origin v$ROOTVERSION

# list workspaces in order of depedency chain, from children to parents
# TODO: add rust later or use package.workspaces.join(",")
WORKSPACES="server client front"
UPDATEDWS=""
for WS in ${WORKSPACES};
do
	set +e
	REMOTESHA=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:$WS | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:$WS | tail -n1) 
	# echo "$WS [$REMOTESHA] [$LOCALSHA]"
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		echo "Bumping the $WS version => $TYPE"
		npm version $TYPE --workspace=$WS --no-git-tag-version --no-workspaces-update
		VERSION=$(node -p "require('./$WS/package.json').version")
		UPDATEDWS="$UPDATEDWS $WS-$VERSION"
		# no need to immediately bump the dependency versions here for a non-published package, 
		# will do that in its deploy script, so that its dependency versions reflect the last deployed state
		for WSP in ${WORKSPACES};
		do
			# echo "[$WSP] [$WS] [$(grep -c proteinpaint-$WS $WSP/package.json)]"
			if [[ "$WSP" != "$WS" && "$(grep -c proteinpaint-$WS $WSP/package.json)" != "0" ]]; then
				echo "setting $WSP/package.json to use $WS@^$VERSION"
				npm pkg set dependencies.@stjude/proteinpaint-$WS="^$VERSION" --workspace=$WSP
			fi
		done
	fi
done

# A second argument implies a target deployment environment
if [[ "$ENV" != "" ]]; then
	BRANCH=$(git branch --show-current)
	if [[ "$BRANCH" != "master" && "$BRANCH" != "ws-devops" ]]; then
		MSG="!!! ERROR: must be in the master or ws-devops branch to commit a version"
		if [[ "$MODE" == "dry" ]]; then
			echo "(ignored in dry-run mode) $MSG"
		else 
			echo $MSG
			exit 1
		fi
	fi

	cd sj/$ENV
	for WS in ${WORKSPACES};
	do
		DEPVER=$(node -p "require('./package.json').dependencies['@stjude/proteinpaint-$WS'] || ''")
		if [[ "$DEPVER" != "" ]]; then
			NEWVER=$(node -p "require('../../$WS/package.json').version")
			if [[ "$NEWVER" != "$DEPVER" ]]; then
				echo "setting $ENV dependencies[@stjude/proteinpaint-$WS] to ^$NEWVER"
				npm pkg set dependencies.@stjude/proteinpaint-$WS="^$NEWVER"
				UPDATEDWS="$UPDATEDWS $ENV:^$WS"
			fi
		fi
	done

	set +e
	REMOTESHA=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:sj/$ENV | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:sj/$ENV | tail -n1)
	set -e
	if [[ "$UPDATEDWS" == *" $ENV-"* || "$REMOTESHA" != "$LOCALSHA" ]]; then
		# the root version is >= max(sj/portal versions)
		# set the current portal version to the root version, 
		# in case the last version update did not apply to this portal=$ENV
		npm version $ROOTVERSION --no-git-tag-version --no-workspaces-update
		# then increment the version
		npm version $TYPE --no-git-tag-version --no-workspaces-update
	fi

	cd ../..

	set +e
	REMOTESHA=$(git rev-parse --verify -q v$ROOTVERSION^{commit} | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD | tail -n1)
	echo "$BRANCH remote=$REMOTESHA local=$LOCALSHA"
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		NEWVER=$(node -p "require('./sj/$ENV/package.json').version")
		git stash
		echo "updating root package version to $NEWVER ..."
		npm version $NEWVER --no-git-tag-version --no-workspaces-update
		git stash pop
	fi

	TAG="v$NEWVER"
	COMMITMSG="$TAG $UPDATEDWS"
	if [[ "$MODE" == "dry" ]]; then
		echo "SKIPPED commit, tag, and publish in dry-run mode: "
		echo "$COMMITMSG"
		git restore .
		exit 0
	fi

	echo "committing version change ..."
	git add --all
	git commit -m "$TAG"
	git tag $TAG
	git push origin $TAG

	for WS in ${WORKSPACES};
	do
		PUBLISHEDVER=$(npm view @stjude/proteinpaint-client version | tail -n1)
		CURRENTVER=$(node -p "require('./$WS/package.json').version")
		if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
			echo "publishing $WS-$CURRENTVER"
			cd $WS
			npm publish
			cd ..
		fi
	done
fi
