#!/bin/bash

# call from the proteinpaint root

###############
# ARGUMENTS
###############

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

##########
# CONTEXT
##########

CURRDIR=$(pwd)
handlePkg=$CURRDIR/build/handlePkg.js

WORKSPACES="rust server client front"
BRANCH=$(git branch --show-current)
vpath=""
ext=""
if [[ "$BRANCH" != "master" ]]; then
	# will use tarballs to deploy instead of a registry when
	# not on master branch, to avoid potential conflicts with
	# version increment conflicts among parallel branches
	vpath=/opt/data/pp/packages/$BRANCH/stjude-proteinpaint
	ext=.tgz
fi

ROOTVERSION=$(node -p "require('./package.json').version")
if [[ ! $(git tag -l "v$ROOTVERSION") ]]; then
	git fetch origin v$ROOTVERSION
fi

COMMITMSG=$(git log --format=%B -n 1 v$ROOTVERSION)
if [[ "$COMMITMSG" != "v$ROOTVERSION "* ]]; then
	echo "tag=v$ROOTVERSION should be the starting substring in its commit message"
	echo "you may need to move back the tag to the correct commit"
	exit 1
fi

################
# FUNCTIONS
###############

UPDATED=""
SP='@stjude/proteinpaint'
WSPKG=$(npm pkg get version dependencies devDependencies --workspaces)
WSPKG=$($handlePkg "$WSPKG")
# echo $WSPKG

mayBumpVersionOnDiff() {
	local WS=$1
	local REFVER=$2 # a potentially higher reference version that this package has fallen behind 
	set +e
	local PREVIOUS=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:$WS | tail -n1)
	local CURRENT=$(git rev-parse --verify -q HEAD:$WS | tail -n1) 
	# echo "$OKG [$PREVIOUS] [$CURRENT]"
	set -e
	if [[ "$PREVIOUS" != "$CURRENT" ]]; then
		if [[ "$REFVER" != "" ]]; then
			# catch up to the reference version first, before applying the version $TYPE change 
			npm pkg set version=$REFVER
		fi
		# echo "Bumping $WS version => $TYPE (diff)"
		npm version $TYPE --no-git-tag-version --no-workspaces-update
		local VERSION=$(node -p "require('./package.json').version")
		UPDATED="$UPDATED $WS-$VERSION"
		updateWSPKGdep "[\"$SP-$WS\", \"version\", \"$VERSION\"]"
	fi
}

maySetDepVer() {
	local WS=$1
	local IMPORTER=$2
	local DEPTYPE=$3
	# echo "(...)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']"
	local VERSION=$(node -p "($WSPKG)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']")
	# echo "80 VERSION=[$VERSION] [$IMPORTER] [$DEPTYPE] [$WS]"
	if [[ "$VERSION" != "undefined" ]]; then
		local DIR=""
		if [[ "$vpath" != "" ]]; then
			DIR="$vpath-$WS-"
		fi
		local DEPVERSION=$(node -p "($WSPKG)['$SP-$WS'].version")
		echo "setting $IMPORTER $DEPTYPE to use $WS@$DEPVERSION [$(pwd)]"
		npm pkg set $DEPTYPE.$SP-$WS=$DIR$DEPVERSION$ext
		UPDATED="$UPDATED $IMPORTER:@$WS"
		updateWSPKGdep "[\"$SP-$IMPORTER\", \"$DEPTYPE\", \"$SP-$WS\", \"$DEPVERSION\"]"
	fi
}

mayBumpImporterVersion() {
	local IMPORTER=$1
	local REFVER=$2
	if [[ "$UPDATED" == *" $IMPORTER:@"* && "$UPDATED" != *" $IMPORTER-"* ]]; then
		if [[ "$REFVER" != "" ]]; then
			# catch up to the reference version first, before applying the version $TYPE change 
			npm pkg set version=$REFVER
		fi
		# echo "Bumping the $IMPORTER version => $TYPE"
		npm version $TYPE --no-git-tag-version --no-workspaces-update
		local VERSION=$(node -p "require('./package.json').version")
		UPDATED="$UPDATED $IMPORTER-$VERSION"
		updateWSPKGdep "[\"$SP-$IMPORTER\", \"version\", \"$VERSION\"]"
	fi
}

# arguments: a list of subnested keys
updateWSPKGdep() {
	local PATCH=$1
	WSPKG=$($handlePkg "$WSPKG" "$PATCH")
}

###############################
# CHECK FOR UPDATED WORKSPACES
###############################

for WS in ${WORKSPACES};
do
	cd $WS
	mayBumpVersionOnDiff $WS
	cd ..
done

##################################
# UPDATE THE IMPORTER WORKSPACES
##################################

for WS in ${WORKSPACES};
do
	for WSP in ${WORKSPACES};
	do
		if [[ "$WSP" != "$WS" && "$UPDATED" == *" $WS-"* ]]; then
			cd $WSP
			maySetDepVer $WS $WSP devDependencies
			maySetDepVer $WS $WSP dependencies
			cd ..
		fi
	done
	mayBumpImporterVersion $WSP
done

if [[ "$ENV" == "" ]]; then
	if [[ "$MODE" == "dry" ]]; then
		echo "[$UPDATED]"
	fi
	git restore .
	exit 0
fi

echo "[$UPDATED]"
# echo $WSPKG

########################
# UPDATE THE PORTAL ENV
########################

# update only the current target environment for deployment,
# let other enviroments' package.jsons each remain in its 
# last applicable deployed version

cd sj/$ENV
PORTALPKG="$(npm pkg get version dependencies devDependencies)"
# echo "[$SP-$ENV] $PORTALPKG"
updateWSPKGdep "[\"$SP-$ENV\", $PORTALPKG]"

for WS in ${WORKSPACES};
do
	if [[ "$UPDATED" == *" $WS-"* ]]; then
		maySetDepVer $WS $ENV devDependencies
		maySetDepVer $WS $ENV dependencies
	fi
done
mayBumpImporterVersion $ENV $ROOTVERSION

if [[ "$UPDATED" != *" $ENV-"* ]]; then
	mayBumpVersionOnDiff $WS $ROOTVERSION
fi

cd ../..

##########################
# UPDATE THE ROOT PACKAGE
##########################

PORTALVER=$(node -p "($WSPKG)['$SP-$ENV'].version")
if [[ "$UPDATED" == *" $ENV-"* ]]; then
	npm pkg set version=$PORTALVER
	updateWSPKGdep "[\"version\", \"$PORTALVER\"]"
elif [[ "$PORTALVER" != "$ROOTVERSION" ]]; then
	cd sj/$ENV
	npm pkg set version=$ROOTVERSION
	cd ../..
else	
 	
 	# mayBumpVersionOnDiff $WS $ROOTVERSION
fi

echo "UPDATED [$UPDATED]"
$handlePkg "$WSPKG"

if [[ "$MODE" == "dry" ]]; then
	# git restore .
	echo "SKIPPED commit, tag, and publish in dry-run mode"
	exit 0
fi

#################
# COMMIT CHANGES 
#################

TAG="v$(node -p "require('./package.json').version")"
COMMITMSG="$TAG $UPDATED"
echo "committing version change ..."
git add --all
git commit -m "$COMMITMSG"
git tag $TAG
git push origin $TAG

#############################
# PUBLISH CHANGED WORKSPACES 
#############################

for WS in ${WORKSPACES};
do
	if [[ "$BRANCH" == "master" ]]; then
		PUBLISHEDVER=$(npm view @stjude/proteinpaint-$WS version | tail -n1)
		CURRENTVER=$(node -p "require('./$WS/package.json').version")
		echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
		if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
			echo "publishing $WS-$CURRENTVER"
			cd $WS
			npm publish
			cd ..
		fi
	else 
 		echo "TODO: scp versioned tarballs to $ENV if not previously deployed"
 		exit 1
	fi
done
