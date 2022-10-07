#!/bin/bash

set -e

# workspace must be clean to deploy
if [ ! -z "$(git status --porcelain)" ]; then
	echo "There are untracked changes, either commit or delete them, or 'npm run clean'."
	exit 1
fi

REMOTEHOST=$1
if [[ "$REMOTEHOST" == "" ]]; then
	echo "Usage: ./build/push REMOTEHOST [VERSIONTYPE]"
	exit 1
fi

# npm ci ???

# run this from the proteinpaint directory
REV=$(git rev-parse --short HEAD)

VERSIONTYPE=prerelease
if [[ "$2" != "" ]]; then
	VERSIONTYPE=$2
fi

./build/version.sh $VERSIONTYPE
git add --all
git commit -m "release to $REMOTEHOST"
git push

npm publish --workspaces --dry-run

# TODO: ??? do we need either of these before publish ??? 
# npm ci
# ------ OR ------
# echo "making a tmpbuild dir for REV='$REV'"
# rm -rf tmpbuild
# mkdir tmpbuild

# echo "using git archive to extract revision='$REV'"
# git archive $REV | tar -x -C tmpbuild/
# cd tmpbuild

# echo "creating node_modules softlinks"
# # assume node_modules are up-to-date in the working dir
# ln -s ../node_modules .
# ln -s ../../client/node_modules client/node_modules
# ln -s ../../server/node_modules server/node_modules

# TGZHOST=pp-prt
# REMOTEDIR=/opt/data/pp/packages
# PKGURL=https://pp-test.stjude.org/Pk983gP.Rl2410y45

# PUBLISHED="server client front"
# for WS in ${PUBLISHED};
# do
# 	echo "checking for $WS version and build ..."
# 	VERSION=$(node -p "require('./$WS/package.json').version")
# 	TGZ=stjude-proteinpaint-$WS-$VERSION.tgz

# 	# TODO: can use `npm show` if using a registry,
# 	# instead of checking for the presense of similarly named tarball
# 	if ssh $TGZHOST "test -e $REMOTEDIR/$TGZ"; then
#   	echo "file $TGZ already deployed to $TGZHOST"
# 	else
# 		# !!! TODO: use `npm publish` when using an npm-compatible registry !!!
# 		cd $WS
# 		./publish.sh $TGZHOST $TGZ
# 		cd ..
# 		npm pkg set dependencies.@stjude/proteinpaint-$REMOTEHOST=$PKGURL/$TGZ --workspace=$REMOTEHOST
# 	fi
# done


# echo "checking for $REMOTEHOST version and build ..."
# VERSION=$(node -p "require('./$REMOTEHOST/package.json').version")
# TGZ=stjude-proteinpaint-$REMOTEHOST-$VERSION.tgz

# if ssh $TGZHOST "test -e $REMOTEDIR/$TGZ"; then
# 	echo "file $TGZ already deployed to $TGZHOST"
# elif [[ "$WS" == "$REMOTEHOST" ]]; then
# 	cd sj/$WS
# 	echo "deploying $TGZ"
# 	#./deploy.sh $TGZ $VERSION
# 	cd ../..
# fi
