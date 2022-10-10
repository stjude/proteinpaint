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
WORKSPACES="rust server client front"
UPDATEDWS=""
for WS in ${WORKSPACES};
do
	set +e
	REMOTESHA=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:$WS | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:$WS | tail -n1) 
	# echo "$WS [$REMOTESHA] [$LOCALSHA]"
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		if [[ "$ENV" != "" && "$WS" != "server" ]]; then
			echo "TODO: reactivate testing !!!"
			# npm test --workspace=$WS
		fi

		echo "Bumping the $WS version => $TYPE"
		npm version $TYPE --workspace=$WS --no-git-tag-version --no-workspaces-update
		VERSION=$(node -p "require('./$WS/package.json').version")
		UPDATEDWS="$UPDATEDWS $WS-$VERSION"
		# no need to immediately bump the dependency versions here for a non-published package, 
		# will do that in its deploy script, so that its dependency versions reflect the last deployed state
		for WSP in ${WORKSPACES};
		do
			if [[ "$WSP" != "$WS" ]]; then
				DEVDEPS=$(npm pkg get devDependencies --workspace=$WSP)
				if [[ "$DEVDEPS" == *"proteinpaint-$WS"* ]]; then
					echo "setting $WSP devDependencies to use $WS@$VERSION"
					npm pkg set devDependencies.@stjude/proteinpaint-$WS="$VERSION" --workspace=$WSP
					UPDATEDWS="$UPDATEDWS $WSP:@$WS"
				fi

				DEPS=$(npm pkg get dependencies --workspace=$WSP)
				if [[ "$DEPS" == *"proteinpaint-$WS"* ]]; then
					echo "setting $WSP dependencies to use $WS@$VERSION"
					npm pkg set dependencies.@stjude/proteinpaint-$WS="$VERSION" --workspace=$WSP
					UPDATEDWS="$UPDATEDWS $WSP:@$WS"
				fi
			fi
		done
	fi
done

# A second argument implies a target deployment environment
if [[ "$ENV" != "" ]]; then
	BRANCH=$(git branch --show-current)
	if [[ "$BRANCH" != "master" && "$BRANCH" != *"-devops"* ]]; then
		# ws-devops branch is only for testing
		MSG="!!! ERROR: must be in the master or a devops branch to commit a version"
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
		NEWVER=$(node -p "require('../../$WS/package.json').version")
		DEVDEPVER=$(node -p "require('./package.json').devDependencies?.['@stjude/proteinpaint-$WS'] || ''")
		if [[ "$DEVDEPVER" != "" && "$DEVDEPVER" != "$NEWVER" ]]; then
			# echo "$WS [$NEWVER] [$DEPVER]"
			if [[ "$NEWVER" != "$DEVDEPVER" ]]; then
				echo "setting $ENV devDependencies[@stjude/proteinpaint-$WS] to $NEWVER"
				npm pkg set devDependencies.@stjude/proteinpaint-$WS="$NEWVER"
				UPDATEDWS="$UPDATEDWS $ENV:@$WS"
			fi
		fi
		DEPVER=$(node -p "require('./package.json').dependencies?.['@stjude/proteinpaint-$WS'] || ''")
		if [[ "$DEPVER" != "" && "$DEPVER" != "$NEWVER" ]]; then
			# echo "$WS [$NEWVER] [$DEPVER]"
			if [[ "$NEWVER" != "$DEPVER" ]]; then
				echo "setting $ENV dependencies[@stjude/proteinpaint-$WS] to $NEWVER"
				npm pkg set dependencies.@stjude/proteinpaint-$WS="$NEWVER"
				UPDATEDWS="$UPDATEDWS $ENV:@$WS"
			fi
		fi
	done
	# echo "106 [$UPDATEDWS]"

	set +e
	REMOTESHA=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:sj/$ENV | tail -n1)
	LOCALSHA=$(git rev-parse --verify -q HEAD:sj/$ENV | tail -n1)
	set -e
	if [[ "$UPDATEDWS" == *" $ENV:"* || "$REMOTESHA" != "$LOCALSHA"  ]]; then
		# the root version is >= max(sj/portal versions)
		# set the current portal version to the root version, 
		# in case the last version update did not apply to this portal=$ENV
		CURRENTVER=$(node -p "require('./package.json').version")
		# echo "116 [$CURRENTVER] [$ROOTVERSION]"
		if [[ "$CURRENTVER" != "$ROOTVERSION" ]]; then
			echo "Bumping the $ENV version => $TYPE"
			npm version $ROOTVERSION --no-git-tag-version --no-workspaces-update
		fi

		# then increment the version
		npm version $TYPE --no-git-tag-version --no-workspaces-update
		NEWVER=$(node -p "require('./package.json').version")
		UPDATEDWS="$UPDATEDWS $ENV-$NEWVER"
	fi

	cd ../..
	# get the new version before stashing
	NEWVER=$(node -p "require('./sj/$ENV/package.json').version")
	
	if [[ "$UPDATEDWS" != "" ]]; then
		git stash
	fi

	if [[ "$NEWVER" != "$ROOTVERSION" ]]; then
		echo "updating root package version to $NEWVER ..."
		npm version $NEWVER --no-git-tag-version --no-workspaces-update
	fi

	TAG="v$(node -p "require('./package.json').version")" 
	COMMITMSG="$TAG $UPDATEDWS"
	if [[ "$MODE" == "dry" ]]; then
		if [[ "$UPDATEDWS" != "" || "$NEWVER" != "$ROOTVERSION" ]]; then
			echo "$COMMITMSG"
			git restore .
		fi
		if [[ "$UPDATEDWS" != "" ]]; then
			echo "dropping $UPDATEDWS"
			git stash drop
		fi
		echo "SKIPPED commit, tag, and publish in dry-run mode"
		exit 0
	fi
	echo "120 [$UPDATEDWS] [$NEWVER] [$ROOTVERSION]"
	
	if [[ "$UPDATEDWS" != "" ]]; then
		git stash pop
	fi

	if [[ "$UPDATEDWS" != "" || "$NEWVER" != "$ROOTVERSION" ]]; then
		echo "committing version change ..."
		git add --all
		git commit -m "$COMMITMSG"
		git tag $TAG
		git push origin $TAG
	fi

	for WS in ${WORKSPACES};
	do
		PUBLISHEDVER=$(npm view @stjude/proteinpaint-$WS version | tail -n1)
		CURRENTVER=$(node -p "require('./$WS/package.json').version")
		echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
		if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
			echo "publishing $WS-$CURRENTVER"
			cd $WS
			npm publish
			cd ..
		fi
	done
fi

exit 0
