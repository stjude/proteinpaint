#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

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

# dry: dry-run
# tgz: deploy tarballs instead of publishing to registry
# tgz-force: deploy tarballs even if a package version exists in a registry
MODE=$3

##########
# CONTEXT
##########

CURRDIR=$(pwd)
handlePkg=$CURRDIR/build/handlePkg.js

WORKSPACES="rust server client front"
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "master" ]]; then
	if [[ "$MODE" != *"tgz"* ]]; then
		echo "!!! ERROR: non-tarball version bumps must be done in the master branch"
	fi

	if [[ "$MODE" == "dry" ]]; then
		echo "(ignoring the error above in dry-mode)"
	elif [[ "$MODE" != *"tgz"* ]]; then
		exit 1
	fi
fi

ROOTVERSION=$(node -p "require('./package.json').version")
if [[ ! $(git tag -l "v$ROOTVERSION") ]]; then
	git fetch origin v$ROOTVERSION
fi

COMMITMSG=$(git log --format=%B -n 1 v$ROOTVERSION)
if [[ "$COMMITMSG" != "v$ROOTVERSION "* && "$COMMITMSG" != "release $ROOTVERSION"* ]]; then
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
# reduce the pacakge deps to only this project's workspaces
WSPKG=$($handlePkg "$WSPKG")
# echo $WSPKG

mayBumpVersionOnDiff() {
	local WS=$1
	local REFVER=$2 # a potentially higher reference version that this package has fallen behind
	set +e
	local PREVIOUS=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:$WS)
	local CURRENT=$(git rev-parse --verify -q HEAD:$WS) 
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
		updatePkg "[\"$SP-$WS\", \"version\", \"$VERSION\"]"
	fi
	HASH=$(echo $CURRENT | cut -c1-6)
	updatePkg "[\"$SP-$WS\", \"hash\", \"$HASH\"]"
}

maySetDepVer() {
	local WS=$1
	local IMPORTER=$2
	local DEPTYPE=$3
	local DEPVERSION=$4
	# echo "(...)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']"
	local VERSION=$(node -p "($WSPKG)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']")
	# echo "80 VERSION=[$VERSION] [$IMPORTER] [$DEPTYPE] [$WS]"
	if [[ "$VERSION" != "undefined" ]]; then
		if [[ "$DEPVERSION" == "" ]]; then
			DEPVERSION=$(node -p "($WSPKG)['$SP-$WS'].version")
		fi
		echo "setting $IMPORTER $DEPTYPE to use $WS@$DEPVERSION [$(pwd)]"
		npm pkg set $DEPTYPE.$SP-$WS=$DEPVERSION
		UPDATED="$UPDATED $IMPORTER:@$WS"
		updatePkg "[\"$SP-$IMPORTER\", \"$DEPTYPE\", \"$SP-$WS\", \"$DEPVERSION\"]"
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
		if [[ "$IMPORTER" == "front" ]]; then
			echo "Bumping the $IMPORTER version => $TYPE [$REFVER] [$TYPE]"
		fi
		npm version $TYPE --no-git-tag-version --no-workspaces-update
		local VERSION=$(node -p "require('./package.json').version")
		UPDATED="$UPDATED $IMPORTER-$VERSION"
		updatePkg "[\"$SP-$IMPORTER\", \"version\", \"$VERSION\"]"
	fi
}

# arguments: a list of subnested keys
updatePkg() {
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
	cd $WSP
	mayBumpImporterVersion $WSP
	cd ..
done

if [[ "$ENV" == "" ]]; then
	if [[ "$MODE" == "dry" ]]; then
		echo "[$UPDATED]"
	fi
	git restore .
	exit 0
fi

########################
# UPDATE THE PORTAL ENV
########################

# update only the current target environment for deployment,
# let other enviroments' package.jsons each remain in its 
# last applicable deployed version

cd sj/$ENV
PORTALPKG="$(npm pkg get version dependencies devDependencies)"
# echo "[$SP-$ENV] $PORTALPKG"
updatePkg "[\"$SP-$ENV\", $PORTALPKG]"

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
	updatePkg "[\"version\", \"$PORTALVER\"]"
elif [[ "$PORTALVER" != "$ROOTVERSION" ]]; then
	cd sj/$ENV
	npm pkg set version=$ROOTVERSION
	cd ../..
else	
	echo "TODO: may bump the root version for non-workpsace, non-portal related changes"
 	# so as long as something gets deployed, via registry or traball, increment the root version?
 	# mayBumpVersionOnDiff $WS $ROOTVERSION
fi

# display the current versions as JSON
$handlePkg "$WSPKG"

#################
# COMMIT CHANGES 
#################

TAG="v$(node -p "require('./package.json').version")"
COMMITMSG="$TAG $UPDATED"
echo "$COMMITMSG"

if [[ "$MODE" == "dry" ]]; then
	# git restore .
	echo "SKIPPED version commit, tag, and publish in dry-run mode"
	exit 1
elif [[ "$MODE" == "tgz" || "$BRANCH" != "master" ]]; then
	echo "SKIPPED version commit and tag in tarball mode and/or non-master branch"
elif [[ "$UPDATED" == "" ]]; then
	echo "No workspace package updates, will reuse previously published versions"
else 
	echo "committing version change ..."
	git add --all
	git commit -m "$COMMITMSG"
	git tag $TAG
	git push origin $TAG
fi

#############################
# PUBLISH CHANGED WORKSPACES 
#############################

if [[ "$MODE" == *"tgz"* ]]; then
	REMOTEDIR=/opt/data/pp/packages
	DEPLOYEDTGZ=$(ssh $ENV "ls $REMOTEDIR")
fi

for WS in ${WORKSPACES};
do
	PUBLISHEDVER=$(npm view @stjude/proteinpaint-$WS version | tail -n1)
	CURRENTVER=$(node -p "require('./$WS/package.json').version")
	echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
	if [[ "$PUBLISHEDVER" != "$CURRENTVER" || "$MODE" == *"force"* ]]; then
		cd $WS
		if [[ "$MODE" != *"tgz"* ]]; then
			echo "publishing $WS-$CURRENTVER"
			npm publish
			cd ..
		else
			VER=$(node -p "($WSPKG)['$SP-$WS'].version")
			HASH=$(node -p "($WSPKG)['$SP-$WS'].hash")
			TGZ=$WS-$VER-$HASH.tgz
			if [[ "$DEPLOYEDTGZ" == *"$TGZ"* ]]; then
				echo "will reuse a previously deployed $TGZ"
			else
				npm pack
				mv stjude-proteinpaint-$WS-$VER.tgz $TGZ
				echo "scp'ing $TGZ to $ENV ..."
				scp $TGZ $ENV:$REMOTEDIR
			fi
			cd ..
			
			for IMPORTER in ${WORKSPACES};
			do
				if [[ "$IMPORTER" != "$WS" ]]; then
					cd $IMPORTER
					maySetDepVer $WS $IMPORTER devDependencies $REMOTEDIR/$TGZ
					maySetDepVer $WS $IMPORTER dependencies $REMOTEDIR/$TGZ
					cd ..
				fi 
			done

			cd ./sj/$ENV
			maySetDepVer $WS $ENV devDependencies $REMOTEDIR/$TGZ
			maySetDepVer $WS $ENV dependencies $REMOTEDIR/$TGZ
			cd ../..
		fi
	fi
done

################
# CLEANUP
################

# if [[ "$BRANCH" != "master" || "$MODE" == *"tgz"* ]]; then
# 	git restore .
# fi
