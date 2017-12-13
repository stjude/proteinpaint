#!/bin/bash

######## 
# NOTES
# - called from project root, e.g., `./scripts/deploy.sub.sh $APPNAME $ENV`
# - checks out committed code into a subdirectory tmpbuild
# - calls webpack.config.sub.prod.js to bundle *.js code
# - simple scp to deploy to remote $ENV
########

###############
# ARGUMENTS
###############

# default to deploying to ppdev
if (($# == 0)); then
	echo "The name of the standalone app to deploy is required."
	exit 1
elif (($# == 1)); then
	APP=$1
	ENV="public-stage"
	REV="HEAD"
	DEPLOYER=$USER
elif (($# == 2)); then
	APP=$1
	ENV=$2
	REV="HEAD"
	DEPLOYER=$USER
elif (($# == 3)); then
	APP=$1
	ENV=$2
	REV=$3
	DEPLOYER=$USER
else 
	APP=$1
	ENV=$2
	REV=$3
	DEPLOYER=$4
fi


########################
# PROCESS COMMIT INFO
########################

# convert $REV to standard numeric notation
if [[ $REV=="HEAD" ]]; then
	if [[ -d .git ]]; then
		REV=$(git svn find-rev $(git rev-parse HEAD))
	elif [[ -d .svn ]]; then
		REV=$(svn info | awk '/^Revision:/ {print $2}')
	fi
fi

if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
	echo "Unable to convert the HEAD revision into a SVN revision number."
	exit 1
fi


#####################
# CONTEXTUAL CONFIG
#####################

SVNREMOTE=https://subversion.stjude.org/svn/compbio/apps/proteinpaint/branches/dev2

if [[ "$ENV" == "public-stage" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pecan-test.stjude.org
	REMOTEDIR=/opt/genomeportal/current/es6_proteinpaint
	URL="http://pecan-test.stjude.org/pp"

elif [[ "$ENV" == "public-prod" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pecan-web01-g.stjude.org
	REMOTEDIR=/opt/genomeportal/current/es6_proteinpaint
	TESTHOST=genomeuser@pecan-test.stjude.org
	URL="http://pecan.stjude.org/pp"

elif [[ "$ENV" == "internal-stage" ]]; then
	DEPLOYER=$USER
	REMOTEHOST=pp-irt.stjude.org
	REMOTEDIR=/opt/app/pp/es6_proteinpaint
	URL="http://pp-irt.stjude.org/pp"

else
	echo "Environment='$ENV' is not supported"
	exit 1
fi



#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

rm -Rf tmpbuild
svn export -qr $REV $SVNREMOTE tmpbuild

cd tmpbuild
# save some time by reusing parent folder's node_modules
# but making sure to update to committed package.json
ln -s ../node_modules node_modules
# npm update

# create webpack bundle
webpack --config=scripts/webpack.config.app.js --env.app=$APP --env.target=$ENV

# deploy to host
scp public/bin/proteinpaint.$APP.js $DEPLOYER@$REMOTEHOST:$REMOTEDIR/public/bin


#############
# CLEANUP
#############

cd ..
rm -rf tmpbuild
