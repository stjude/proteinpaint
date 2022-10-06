#!/bin/bash

set -e

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
	TYPE=$1
fi

REMOTEHOST=$2
HOST=pp-prt
REMOTEDIR=/opt/data/pp/packages
PKGURL=https://pp-test.stjude.org/Pk983gP.Rl2410y45
WORKSPACES="client server portal" # $(node -p "require('./package.json').workspaces.join(' ')")

for WS in ${WORKSPACES};
do
	BRANCH=$(git branch --show-current)
	REMOTESHA=$(git rev-parse origin/$BRANCH:$WS)
	LOCALSHA=$(git rev-parse HEAD:$WS)
	if [[ "$REMOTESHA" != "$LOCALSHA" ]]; then
		echo "Bumping the $WS version => $TYPE"
		npm version $TYPE --workspace=$WS --no-git-tag-version --no-workspaces-update
		
		VERSION=$(node -p "require('./$WS/package.json').version")
		TGZ=stjude-proteinpaint-$WS-$VERSION.tgz
		for WSP in ${WORKSPACES};
		do
			ISPRIVATE=$(node -p "require('./$WSP/package.json').private")
			# no need to bump the version of a non-published package, unless it is being deployed
			if [[ "$ISPRIVATE" != "true" || "$WSP" == "$REMOTEHOST" ]] && [[ "$WSP" != "$WS" && "$(grep -c proteinpaint-$WS $WSP/package.json)" != "0" ]]; then
				echo "setting $WSP/package.json to use $TGZ"
				npm pkg set dependencies.@stjude/proteinpaint-$WS=$PKGURL/packages/$TGZ --workspace=$WSP
			fi
		done
	fi
done
