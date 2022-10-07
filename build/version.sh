#!/bin/bash

set -e

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
	TYPE=$1
fi

echo "setting package versions"

# HOST=pp-prt
# REMOTEDIR=/opt/data/pp/packages
# PKGURL=https://pp-test.stjude.org/Pk983gP.Rl2410y45/packages

BRANCH=$(git branch --show-current)

# list workspaces in order of depedency chain, from children to parents
# TODO: add rust later
WORKSPACES="server client front"

for WS in ${WORKSPACES};
do
	set +e
	REMOTESHA=$(git rev-parse --verify -q origin/master:$WS)
	LOCALSHA=$(git rev-parse --verify -q HEAD:$WS)
	# echo "$WS [$REMOTESHA] [$LOCALSHA]"
	set -e
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		echo "Bumping the $WS version => $TYPE"
		npm version $TYPE --workspace=$WS --no-git-tag-version --no-workspaces-update
		
		# VERSION=$(node -p "require('./$WS/package.json').version")
		# TGZ=stjude-proteinpaint-$WS-$VERSION.tgz
		# # no need to immediately bump the dependency versions here for a non-published package, 
		# # will do that in its deploy script, so that its dependency versions reflect the last deployed state
		# for WSP in ${WORKSPACES};
		# do
		# 	echo "[$WSP] [$WS]"
		# 	if [[ "$WSP" != "$WS" && "$(grep -c proteinpaint-$WS $WSP/package.json)" != "0" ]]; then
		# 		echo "setting $WSP/package.json to use $TGZ"
		# 		npm pkg set dependencies.@stjude/proteinpaint-$WS=$PKGURL/$TGZ --workspace=$WSP
		# 	fi
		# done
	fi
done
