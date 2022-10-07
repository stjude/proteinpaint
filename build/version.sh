#!/bin/bash

set -e

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
	TYPE=$1
fi

ENV=$2

echo "setting package versions"

# HOST=pp-prt
# REMOTEDIR=/opt/data/pp/packages
# PKGURL=https://pp-test.stjude.org/Pk983gP.Rl2410y45/packages

ROOTVERSION=$(node -p "require('./package.json').version")
# list workspaces in order of depedency chain, from children to parents
# TODO: add rust later
WORKSPACES="server client front"
UPDATEDWS=" "
for WS in ${WORKSPACES};
do
	set +e
	REMOTESHA=$(git rev-parse --verify -q origin $ROOTVERSION^{commit}:$WS | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:$WS | tail -n1) 
	# echo "$WS [$REMOTESHA] [$LOCALSHA]"
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		echo "Bumping the $WS version => $TYPE"
		npm version $TYPE --workspace=$WS --no-git-tag-version --no-workspaces-update
		UPDATEDWS="$UPDATEDWS $WS "
		VERSION=$(node -p "require('./$WS/package.json').version")
		# no need to immediately bump the dependency versions here for a non-published package, 
		# will do that in its deploy script, so that its dependency versions reflect the last deployed state
		for WSP in ${WORKSPACES};
		do
			echo "[$WSP] [$WS] [$(grep -c proteinpaint-$WS $WSP/package.json)]"
			if [[ "$WSP" != "$WS" && "$(grep -c proteinpaint-$WS $WSP/package.json)" != "0" ]]; then
				echo "setting $WSP/package.json to use $WS@^$VERSION"
				npm pkg set dependencies.@stjude/proteinpaint-$WS="^$VERSION" --workspace=$WSP
			fi
		done
	fi
done



if [[ "$ENV" != "" ]]; then
	BRANCH=$(git branch --show-current)
	# if [[ "$BRANCH" != "master" ]]; then
	# 	echo "!!! ERROR: must be in the master branch to commit a version"
	# 	exit 1
	# fi

	cd sj/$ENV
	for WS in ${WORKSPACES};
	do
		DEPVER=$(node -p "require('./package.json').dependencies['@stjude/proteinpaint-$WS'] || ''")
		if [[ "$DEPVER" != "" ]]; then
			NEWVER=$(node -p "require('../../$WS/package.json').version")
			if [[ "$NEWVER" != "$DEPVER" ]]; then
				echo "setting the dependencies[@stjude/proteinpaint-$WS] to ^$NEWVER"
				npm pkg set dependencies.@stjude/proteinpaint-$WS="^$NEWVER"
				UPDATEDWS="$UPDATEDWS $ENV"
			fi
		fi
	done

	set +e
	REMOTESHA=$(git rev-parse --verify -q origin $ROOTVERSION^{commit}:sj/$ENV | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:sj/$ENV | tail -n1)
	set -e
	if [[ "$UPDATEDWS" == *" $ENV "* ]]; then
		# the root version is >= max(sj/portal versions)
		# set the current portal version to the root version, 
		# in case the last version update did not apply to this portal=$ENV
		npm version $ROOTVERSION --no-git-tag-version --no-workspaces-update
		# then increment the version
		npm version $TYPE --no-git-tag-version --no-workspaces-update
	fi

	cd ../..

	set +e
	REMOTESHA=$(git rev-parse --verify -q origin $ROOTVERSION^{commit} | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD | tail -n1)
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		NEWVER=$(node -p "require('./sj/$ENV/package.json').version")
		git stash
		echo "updating root package version to $NEWVER ..."
		npm version $NEWVER --no-git-tag-version --no-workspaces-update
		git stash pop

		echo "committing version change ..."
		# git add --all
		# git commit -m "released to $ENV"
		for WS in ${WORKSPACES};
		do
			if [[ "$UPDATEDWS" == *" $WS "* ]]; then
				echo "publishing $WS"
				cd 
				# npm publish
			fi 
		done
	fi
fi
