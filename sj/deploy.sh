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

MODE=$3

#################################
# VERSION AND BUILD FROM COMMIT
#################################

# workspace must be clean to deploy
if [ ! -z "$(git status --porcelain)" ]; then
	ERRORMSG="!!! There are untracked changes, either commit or delete them, or 'npm run clean'."
	if [[ "$MODE" == "dry" ]]; then
		echo "(SKIPPED in dry-mode) $ERRORMSG"
	else
		echo $ERRORMSG
		exit 1
	fi
fi

# npm ci ??? # 

# this version script will commit and publish changes,
# unless in dry-run mode
./build/version.sh $VERSIONTYPE $ENV $MODE

cd sj/$ENV
REV=$(git rev-parse --short HEAD)
echo "$ENV $REV $(date)" > public/rev.txt
# NOTE: npm pack does not include symbolink link as-is or its contents
# will need to do that via rsync, which is optimal for syncing 
# larger sized static files
npm pack
VER=$(node -p "require('./package.json').version")
APP=pp
mv stjude-proteinpaint-*.tgz $APP-$VER.tgz

if [[ "$MODE" == "dry" ]]; then
	echo "SKIPPED deployment in dry-run mode"
	exit 0
fi

##########
# DEPLOY
##########

REMOTEDIR=/opt/app/pp

echo "Transferring build to $ENV"
scp $APP-$VER.tgz $ENV:~

ssh -t $ENV "
	tar --warning=no-unknown-keyword -xzf ~/$APP-$VER.tgz -C $REMOTEDIR/available/
	rm ~/$APP-$VER.tgz

	cd $REMOTEDIR
	mv -f available/package available/$APP-$VER
	cp -r active/node_modules available/$APP-$VER
	cp active/serverconfig.json available/$APP-$VER/

	cd available/$APP-$VER/
	npm update @stjude/proteinpaint-server
	npm update @stjude/proteinpaint-front
	ln -sfn /opt/app/pecan/portal/www/sjcharts/public public/sjcharts
	ln -sfn public/bin public/no-babel-polyfill

	cd $REMOTEDIR
	ln -sfn available/$APP-$REV active-0
	
	# TODO: should create the helper scripts under the project?
	# ./helpers/record.sh deployed
	# ./proteinpaint_run_node.sh
	# ./helpers/purge.sh \"pp-*\"
"

# TODO: rsync symlinked content to $ENV, 
# since package.files will not pack any symbolic link or its contents


#############
# CLEANUP
#############

exit 0
