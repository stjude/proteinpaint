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

ENV=pp-prt
if [[ "$1" != "" ]]; then
	ENV=$1
fi

VERSIONTYPE=prerelease
if [[ "$2" != "" ]]; then
	VERSIONTYPE=$2
fi

#####################
# CONSTANTS
#####################

APP=pp # might be overridden below
REMOTEDIR=/opt/app/pp

#################################
# VERSION AND BUILD FROM COMMIT
#################################

# workspace must be clean to deploy
if [ ! -z "$(git status --porcelain)" ]; then
	echo "There are untracked changes, either commit or delete them, or 'npm run clean'."
	exit 1
fi

# npm ci ??? # 

# this version script will commit and publish changes,
# unless in dry-run mode
./build/version.sh $VERSIONTYPE $ENV

REV=$(git rev-parse --short HEAD)
echo "$ENV $REV $(date)" > public/rev.txt
npm pack

VER=$(node -p "require('./package.json').version")
mv stjude-proteinpaint-*.tgz $APP-$VER.tgz

##########
# DEPLOY
##########

echo "Transferring build to $ENV"
scp $APP-$VER.tgz $ENV:~
ssh -t $ENV "
	tar --warning=no-unknown-keyword -xzf ~/$APP-$VER.tgz -C $REMOTEDIR/available/
	rm ~/$APP-$VER.tgz
	cd $REMOTEDIR
	mv -f available/package available/$APP-$VER
	cp active/serverconfig.json available/$APP-$VER/

	chmod -R 755 available/$APP-$VER
	cd available/$APP-$VER
	npm install --production

	cd $REMOTEDIR
	ln -sfn available/$APP-$VER active-0
	ln -sfn /opt/app/pecan/portal/www/sjcharts/public available/$APP-$VER/public/sjcharts
	# legacy support for embedders that required this
	ln -sfn ./bin available/$APP-$VER/public/no-babel-polyfill
	
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
