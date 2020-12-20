#!/bin/bash

set -e

######## 
# NOTES
# - called from project root, e.g., `./build/deploy.sh $ENV`
# - checks out committed code into a subdirectory tmpbuild
# - calls webpack.config.$ENV to bundle *.js code
# - tars only the code that is needed (for examples, scr/* and build/* are not included in the build)
# - reuses serverconfig.json from the previously deployed build 
# - restarts node server
########

###############
# ARGUMENTS
###############

# default to deploying to ppdev
if (($# == 0)); then
	ENV="pp-test"
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

if [[ "$ENV" != "scp-prod" ]]; then 
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
fi

#####################
# CONTEXTUAL CONFIG
#####################

APP=es6_proteinpaint # might be overridden below
RUN_SERVER_SCRIPT=proteinpaint_run_node.sh # might be overridden below
GIT_REMOTE=git@github.com:stjude/proteinpaint.git

if [[ "$ENV" == "pp-irt" || "$ENV" == "pp-int-test" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irt.stjude.org
	USERatREMOTE=$DEPLOYER@$REMOTEHOST
	REMOTEDIR=/opt/app/pp
	HOSTNAME=pp-int-test.stjude.org
	SUBDOMAIN=pp-int-test

elif [[ "$ENV" == "internal-prod" || "$ENV" == "pp-int" || "$ENV" == "pp-irp" || "$ENV" == "ppdev" || "$ENV" == "ppr" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irp.stjude.org
	USERatREMOTE=$DEPLOYER@$REMOTEHOST
	REMOTEDIR=/opt/app/pp
	HOSTNAME=ppr.stjude.org
	SUBDOMAIN=ppr

elif [[ "$ENV" == "public-stage" || "$ENV" == "pp-test" || "$ENV" == "pp-prt" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prt.stjude.org
	USERatREMOTE=$DEPLOYER@$REMOTEHOST
	REMOTEDIR=/opt/app/pp
	HOSTNAME=pp-test.stjude.org
	SUBDOMAIN=pp-test

elif [[ "$ENV" == "public-prod" || "$ENV" == "pp-prp" || "$ENV" == "prp1" || "$ENV" == "pecan" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prp1.stjude.org
	USERatREMOTE=$DEPLOYER@$REMOTEHOST
	REMOTEDIR=/opt/app/pp
	HOSTNAME=proteinpaint.stjude.org
	SUBDOMAIN=proteinpaint

elif [[ "$ENV" == "jump-prod" || "$ENV" == "vpn-prod" ]]; then
	# 
	# requires these tunnel settings in ~/.ssh/config:
	# 
	# Host prp1
  # User          genomeuser
  # HostName      pp-prp1.stjude.org
  # ProxyCommand  ssh gnomeuser@svldtemp01.stjude.org nc %h %p 2> /dev/null
  #
	USERatREMOTE=prp1 
	REMOTEDIR=/opt/app/pp
	HOSTNAME=proteinpaint.stjude.org
	SUBDOMAIN=proteinpaint

else
	echo "Environment='$ENV' is not supported"
	exit 1
fi

#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

if [[ -d tmpbuild && -f tmpbuild/$APP-$REV.tgz && $(grep -l "https://$HOSTNAME/bin" tmpbuild/$APP/public/bin/proteinpaint.js) != "" ]]; then
	echo "Reusing a previous matching build"
	cd tmpbuild
else 
	rm -Rf tmpbuild
	# remote repo not used, use local repo for now
	mkdir tmpbuild  # temporary empty workspace for checkedout commit
	git archive HEAD | tar -x -C tmpbuild/

	cd tmpbuild

	# save some time by reusing parent folder's node_modules
	# but making sure to update to committed package.json
	ln -s ../node_modules node_modules
	# npm update

	# create webpack bundle
	echo "Packing bundle ..."
	if [[ "$ENV" == "ppdev" ]]; then
		# option to simply reuse and deploy live bundled code.
		# This is slightly better than deploy.ppr.sh in that 
		# committed code is used except for the live bundle.
		# To force rebundle from committed code, 
		# use "internal-prod" instead of "ppdev" environment
		mkdir public/bin
		cp ../public/bin/* public/bin
		sed "s%$DEVHOST/bin/%https://ppr.stjude.org/bin/%" < public/builds/$SUBDOMAIN/proteinpaint.js > public/builds/SUBDOMAIN/proteinpaint.js
	else 
		npx webpack --config=build/webpack.config.build.js --env.url=https://$HOSTNAME
	fi

	# create dirs to put extracted files
	rm -rf $APP
	mkdir $APP
	mkdir $APP/public
	mkdir $APP/src
	mkdir $APP/utils

	npm run build-server
	mv server.js $APP/
	mv package.json $APP/
	mv public/bin $APP/public/bin
	mv genome $APP/
	mv dataset $APP/
	mv utils/*.R $APP/utils/
	mv src/common.js src/vcf.js src/bulk* src/tree.js $APP/src/

	if [[ "$ENV" == "public-stage" || "$ENV" == "public-prod" ||  "$SUBDOMAIN" == "proteinpaint" ]]; then
		cp public/pecan.html $APP/public/index.html
	else
		cp public/index.html $APP/public/index.html
	fi

	# tar inside the dir in order to not create
	# a root directory in tarball
	cd $APP
	tar -czf ../$APP-$REV.tgz .
	cd ..
fi

##########
# DEPLOY
##########

echo "Transferring build to $USERatREMOTE"
scp $APP-$REV.tgz $USERatREMOTE:~
ssh -t $USERatREMOTE "
	rm -Rf $REMOTEDIR/$APP-new
	mkdir $REMOTEDIR/$APP-new
	tar --warning=no-unknown-keyword -xzf ~/$APP-$REV.tgz -C $REMOTEDIR/$APP-new/
	rm ~/$APP-$REV.tgz

	cp -r $REMOTEDIR/$APP/node_modules $REMOTEDIR/$APP-new/
	cp $REMOTEDIR/$APP/serverconfig.json $REMOTEDIR/$APP-new/
	cp -Rn $REMOTEDIR/$APP/public/ $REMOTEDIR/$APP-new/
	cp -Rn $REMOTEDIR/$APP/dataset/ $REMOTEDIR/$APP-new/

	rm -Rf $REMOTEDIR/$APP-prev
	mv $REMOTEDIR/$APP $REMOTEDIR/$APP-prev
	mv $REMOTEDIR/$APP-new $REMOTEDIR/$APP
	chmod -R 755 $REMOTEDIR/$APP

	ln -s /opt/app/pecan/portal/www/sjcharts/public $REMOTEDIR/$APP/public/sjcharts
	ln -s $REMOTEDIR/$APP/public/bin $REMOTEDIR/$APP/public/no-babel-polyfill

	cd $REMOTEDIR/$APP/
	../proteinpaint_run_node.sh

	echo \"$ENV $REV $(date)\" > $REMOTEDIR/$APP/public/rev.txt
"

#############
# CLEANUP
#############

cd ..
rm -rf tmpbuild
