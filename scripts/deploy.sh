#!/bin/bash

######## 
# NOTES
# - called from project root, e.g., `./scripts/deploy.sh $ENV`
# - checks out committed code into a subdirectory tmpbuild
# - calls webpack.config.$ENV to bundle *.js code
# - tars only the code that is needed (for examples, scr/* and scripts/* are not included in the build)
# - reuses serverconfig.json, dataset/*, and genome/* files from the previously deployed build 
# - restarts node server
########

###############
# ARGUMENTS
###############

# default to deploying to ppdev
if (($# == 0)); then
	ENV="internal-stage"
	REV="HEAD"
	DEPLOYER=$USER
elif (($# == 1)); then
	ENV=$1
	REV="HEAD"
	DEPLOYER=$USER
elif (($# == 2)); then
	ENV=$1
	REV=$2
	DEPLOYER=$USER
else 
	ENV=$1
	REV=$2
	DEPLOYER=$3
fi


########################
# PROCESS COMMIT INFO
########################

# convert $REV to standard numeric notation
if [[ $REV=="HEAD" ]]; then
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

APP=es6_proteinpaint # might be overridden below
RUN_SERVER_SCRIPT=proteinpaint_run_node.sh # might be overridden below
GIT_REMOTE=http://cmpb-devops.stjude.org/gitlab/viz/proteinpaint.git

if [[ "$ENV" == "old-stage" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pecan-test.stjude.org
	REMOTEDIR=/opt/genomeportal/current
	URL="//pecan-test.stjude.org/pp"
	SUBDOMAIN=pecan-test

elif [[ "$ENV" == "public-stage" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prt.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//pp-prt.stjude.org/pp"
	SUBDOMAIN=pp-prt

elif [[ "$ENV" == "old-prod" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pecan-web01-g.stjude.org
	REMOTEDIR=/opt/genomeportal/current
	TESTHOST=genomeuser@pecan-test.stjude.org
	URL="//pecan.stjude.org/pp"
	SUBDOMAIN=pecan

elif [[ "$ENV" == "internal-stage" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-int-test.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//pp-int-test.stjude.org/pp"
	SUBDOMAIN=pp-int-test

elif [[ "$ENV" == "internal-prod" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irp.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//ppr.stjude.org/"
	SUBDOMAIN=ppr

# alternate internal-prod deploy procedure
# which reuses live webpack bundle 
elif [[ "$ENV" == "ppdev" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irp.stjude.org
	REMOTEDIR=/opt/app/pp
	# TESTHOST=genomeuser@pecan-test.stjude.org
	DEVHOST=http://localhost:3000
	URL="//ppr.stjude.org/"
	SUBDOMAIN=ppr

elif [[ "$ENV" == "public-prod" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prp2.stjude.org
	REMOTEDIR=/opt/app/pp
	# TESTHOST=genomeuser@pecan-test.stjude.org
	URL="//proteinpaint.stjude.org/"
	SUBDOMAIN=proteinpaint

else
	echo "Environment='$ENV' is not supported"
	exit 1
fi



#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

rm -Rf tmpbuild
# remote repo not used, use local repo for now
mkdir tmpbuild
git archive HEAD | tar -x -C tmpbuild/

cd tmpbuild

# save some time by reusing parent folder's node_modules
# but making sure to update to committed package.json
ln -s ../node_modules node_modules
# npm update

# create webpack bundle
if [[ "$ENV" == "ppdev" ]]; then
	# option to simply reuse and deploy live bundled code.
	# This is slightly better than deploy.ppr.sh in that 
	# committed code is used except for the live bundle.
	# To force rebundle from committed code, 
	# use "internal-prod" instead of "ppdev" environment
	mkdir public/builds/$SUBDOMAIN
	cp ../public/bin/* public/builds/$SUBDOMAIN
	sed "s%$DEVHOST/bin/%https://ppr.stjude.org/bin/%" < public/builds/$SUBDOMAIN/proteinpaint.js > public/builds/SUBDOMAIN/proteinpaint.js
else 
	webpack --config=scripts/webpack.config.build.js --env.subdomain=$SUBDOMAIN
fi

# no-babel-polyfill version for use in sjcloud, to avoid conflict
if [[ "$ENV" == "public-prod" ]]; then
	webpack --config=scripts/webpack.config.build.js --env.subdomain=pecan --env.nopolyfill=1
fi

# create dirs to put extracted files
rm -rf $APP
mkdir $APP
mkdir $APP/public
mkdir $APP/src

./node_modules/babel-cli/bin/babel.js -q server.js | ./node_modules/uglify-js/bin/uglifyjs -q --compress --mangle > server.min.js

mv server.min.js $APP/server.js 
mv package.json $APP/
mv public/builds/$SUBDOMAIN $APP/public/bin
mv src/common.js src/vcf.js src/bulk* src/tree.js $APP/src/
mv utils test.embed $APP/
mv genome $APP/
mv dataset $APP/

if [[ "$ENV" == "public-stage" || "$ENV" == "public-prod" ]]; then
	cp public/pecan.html $APP/public/index.html
elif [[ "$ENV" == "internal-stage" ]]; then
	cp public/pp-int-test.html $APP/public/index.html
else
	cp public/index.html $APP/public/index.html
fi

if [[ "$ENV" == "public-prod" ]]; then
	mv public/builds/pecan/no-babel-polyfill $APP/public/
fi

# tar inside the dir in order to not create
# a root directory in tarball
cd $APP
tar -czf ../$APP-$REV.tgz .
cd ..

##########
# DEPLOY
##########

scp $APP-$REV.tgz $DEPLOYER@$REMOTEHOST:~

ssh -t $DEPLOYER@$REMOTEHOST "
	rm -Rf $REMOTEDIR/$APP-new
	mkdir $REMOTEDIR/$APP-new
	tar -xvzf ~/$APP-$REV.tgz -C $REMOTEDIR/$APP-new/

	cp -r $REMOTEDIR/$APP/node_modules $REMOTEDIR/$APP-new/
	cp $REMOTEDIR/$APP/serverconfig.json $REMOTEDIR/$APP-new/
	cp -Rn $REMOTEDIR/$APP/public/ $REMOTEDIR/$APP-new/

	rm -Rf $REMOTEDIR/$APP-prev
	mv $REMOTEDIR/$APP $REMOTEDIR/$APP-prev
	mv $REMOTEDIR/$APP-new $REMOTEDIR/$APP
	chmod -R 755 $REMOTEDIR/$APP

	cd $REMOTEDIR/$APP/
	$REMOTEDIR/proteinpaint_run_node.sh

	echo \"$ENV $REV $(date)\" >> $REMOTEDIR/$APP/public/rev.txt
"

#############
# CLEANUP
#############

cd ..
# rm -rf tmpbuild
