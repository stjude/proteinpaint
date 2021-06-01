#!/bin/bash

##########################################################################
# Simplifes using the host helper scripts
# usage:
# ./build/help.js HOST TASK ARGS
# where 
# HOST: [username@]domain OR IP-address
# TASK: any filename under build/helpers/, without the file extension
# ARGS: see the allowed arguments in the corresponding TASK script
##########################################################################

set -e

REMOTE=$1
TASK=$2

rsync -a --delete ./helpers/ $REMOTE:/opt/app/pp/helpers

ssh "$REMOTE" "cd /opt/app/pp; chmod -R 755 helpers; bash -s " -- < ./helpers/$TASK.sh "${@:3}" 
