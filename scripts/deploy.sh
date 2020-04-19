#!/bin/bash

set -e

######## 
# NOTES
# - called from project root, e.g., `./scripts/deploy.sh $ENV`
# - checks out committed code into a subdirectory tmpbuild
# - calls webpack.config.$ENV to bundle *.js code
# - tars only the code that is needed (for examples, scr/* and scripts/* are not included in the build)
# - reuses serverconfig.json from the previously deployed build 
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

if [[ "$ENV" == "internal-stage" || "$ENV" == "pp-int-test" || "$ENV" == "pp-irt" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irt.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//pp-int-test.stjude.org"
	SUBDOMAIN=pp-int-test

elif [[ "$ENV" == "internal-prod" || "$ENV" == "pp-int" || "$ENV" == "pp-irp" || "$ENV" == "ppdev" || "$ENV" == "ppr" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-irp.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//ppr.stjude.org/"
	SUBDOMAIN=ppr

elif [[ "$ENV" == "public-stage" || "$ENV" == "pp-test" || "$ENV" == "pp-prt" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prt.stjude.org
	REMOTEDIR=/opt/app/pp
	URL="//pp-test.stjude.org/pp"
	SUBDOMAIN=pp-test

elif [[ "$ENV" == "public-prod" || "$ENV" == "pp-prp" || "$ENV" == "pecan" || "$ENV" == "vpn-prod" || "$ENV" == "scp-prod" || "$ENV" == "jump-prod" ]]; then
	DEPLOYER=genomeuser
	REMOTEHOST=pp-prp1.stjude.org
	REMOTEDIR=/opt/app/pp
	# TESTHOST=genomeuser@pp-test.stjude.org
	URL="//proteinpaint.stjude.org/"
	SUBDOMAIN=proteinpaint
	#
	# *** TO-DO ***: 
	# Replace the following with a build server, preferably via git hooks + CI.
	#
	# The following approach removes the need to maintain another git repo
	# on a prod-whitelisted machine. So builds are created locally in the
	# dev machine, no need to worry about incompatible builds in another 
	# remote machine.
	# 
	# vpn-prod (step 1): 
	#	- put the built tar into a non-whitelisted temporary host
	# 
	# scp-prod (step 2): 
	# 	- log on to prod-whitelisted machine/remote desktop
	#	- scp built tar from the non-whitelisted temporary host
	#	- scp built tar to prod host
	#	- then complete the deployment via from there
	#
	if [[ "$ENV" == "vpn-prod" || "$ENV" == "scp-prod" ]]; then
		TEMPHOST=pp-irp
	elif [[ "$ENV" == "jump-prod" ]]; then
		TEMPHOST=svldtemp01
	fi
else
	echo "Environment='$ENV' is not supported"
	exit 1
fi



#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

if [[ "$ENV" != "scp-prod" ]]; then 
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
	echo "Packing bundle ..."
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
		npx webpack --config=scripts/webpack.config.build.js --env.subdomain=$SUBDOMAIN
	fi

	# no-babel-polyfill version for use in sjcloud, 
	# to avoid conflict with external code
	if [[ "$ENV" == "public-prod" ]]; then
		npx webpack --config=scripts/webpack.config.build.js --env.subdomain=$SUBDOMAIN --env.nopolyfill=1
	fi

	# create dirs to put extracted files
	rm -rf $APP
	mkdir $APP
	mkdir $APP/public
	mkdir $APP/src

	npm run build-server
	mv server.js $APP/
	mv package.json $APP/
	mv public/builds/$SUBDOMAIN $APP/public/bin
	mv src/common.js src/vcf.js src/bulk* src/tree.js $APP/src/
	mv utils modules $APP/
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
		mv $APP/public/bin/no-babel-polyfill $APP/public/
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

if [[ "$ENV" == "jump-prod" ]]; then
	echo "scp'ing $APP-$REV.tgz tar ball to jump box at $TEMPHOST ..."
	scp $APP-$REV.tgz gnomeuser@$TEMPHOST:~
	scp ./scripts/deploy.sh gnomeuser@$TEMPHOST:~
	echo "deploying from jump box to $REMOTEHOST"
	ssh -t gnomeuser@$TEMPHOST "
	cd ~
	# uncomment when there is git in jump box
	# git pull
	./deploy.sh scp-prod $REV
"
	exit 1
elif [[ "$ENV" == "vpn-prod" ]]; then
	scp $APP-$REV.tgz $DEPLOYER@$TEMPHOST:~
	echo "Deployed to $TEMPHOST. Whitelisted IP address required to access $REMOTEHOST."
	exit 1
elif [[ "$ENV" == "scp-prod" ]]; then
	if [[ ! -f $APP-$REV.tgz ]]; then
		scp $DEPLOYER@$TEMPHOST:~/$APP-$REV.tgz .
		ssh -t $DEPLOYER@$TEMPHOST "rm ~/$APP-$REV.tgz"
	fi
fi

scp $APP-$REV.tgz $DEPLOYER@$REMOTEHOST:~

ssh -t $DEPLOYER@$REMOTEHOST "
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

	cd $REMOTEDIR/$APP/
	$REMOTEDIR/proteinpaint_run_node.sh

	echo \"$ENV $REV $(date)\" >> $REMOTEDIR/$APP/public/rev.txt
"

#############
# CLEANUP
#############

if [[ "$ENV" == "scp-prod" ]]; then
	rm ./$APP-$REV.tgz
else 
	cd ..
	rm -rf tmpbuild
fi
