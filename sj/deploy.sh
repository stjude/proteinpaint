#!/bin/bash

set -e

######## 
# NOTES
# - called from project root, e.g., `./sj/deploy.sh $ENV`
# - uses npm pack to build, workspace deps will be `npm installed` in the remote host
# - reuses serverconfig.json from the previously deployed build 
# - restarts node server
########

###############
# ARGUMENTS
###############

# default to deploying to ppdev
if (($# == 0)); then
	ENV="pp-prt"
	REV="HEAD"
elif (($# == 1)); then
	ENV=$1
	REV="HEAD"
else 
	ENV=$1
	REV=$2
fi

########################
# PROCESS COMMIT INFO
########################

# workspace must be clean to deploy
if [ ! -z "$(git status --porcelain)" ]; then
	echo "There are untracked changes, either commit or delete them, or 'npm run clean'."
	exit 1
fi

# convert $REV to standard numeric notation
if [[ $REV == "HEAD" ]]; then
	if [[ -d .git ]]; then
		REV=$(git rev-parse --short HEAD)
	fi
fi

if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
	echo "Unable to convert the HEAD revision into a Git commit hash."
	exit 1
fi

#####################
# CONTEXTUAL CONFIG
#####################

APP=pp # might be overridden below
RUN_SERVER_SCRIPT=proteinpaint_run_node.sh # might be overridden below
REMOTEDIR=/opt/app/pp

#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

# npm ci ???

VERSIONTYPE=prerelease
if [[ "$2" != "" ]]; then
	VERSIONTYPE=$2
fi

./build/version.sh $VERSIONTYPE "release to $ENV"

WORKSPACES="server client front"
cd sj/$ENV
for WS in ${WORKSPACES};
do
	DEPVER=$(node -p "require('./package.json').dependencies['@stjude/proteinpaint-$WS'] || ''")
	if [[ "$DEPVER" != "" ]]; then
		NEWVER=$(node -p "require('../../$WS/package.json').version")
		echo "setting the dependencies[@stjude/proteinpaint-$WS] to ^$NEWVER"
		npm pkg set dependencies.@stjude/proteinpaint-$WS="^$NEWVER"
	fi
done

npm version $VERSIONTYPE --no-git-tag-version --no-workspaces-update

echo "$ENV $REV $(date)" > public/rev.txt
npm pack
VER=
mv stjude-proteinpaint-*.tgz $APP-$REV.tgz

##########
# DEPLOY
##########

echo "Transferring build to $ENV"
scp $APP-$REV.tgz $ENV:~
ssh -t $ENV "
	tar --warning=no-unknown-keyword -xzf ~/$APP-$REV.tgz -C $REMOTEDIR/available/
	rm ~/$APP-$REV.tgz
	cd $REMOTEDIR
	mv -f available/package available/$APP-$REV
	cp active/serverconfig.json available/$APP-$REV/

	chmod -R 755 available/$APP-$REV
	cd available/$APP-$REV
	# npm install --production

	cd $REMOTEDIR
	ln -sfn available/$APP-$REV active-0
	ln -sfn /opt/app/pecan/portal/www/sjcharts/public available/$APP-$REV/public/sjcharts
	# legacy support for embedders that required this
	ln -sfn ./bin available/$APP-$REV/public/no-babel-polyfill
	
	# ./helpers/record.sh deployed
	# ./proteinpaint_run_node.sh
	# ./helpers/purge.sh \"pp-*\"
"

#############
# CLEANUP
#############

cd ..
# rm -rf tmpbuild
exit 0
