#!/bin/bash

########################################
#  DO NOT MODIFY   #
########################################
# /etc/init.d/propteinpaint calls this script for restarting proteinpaint
########################################

PATH=/opt/local/tabix/bin:/opt/rh/rh-redis32/root/usr/bin:/opt/rh/rh-redis32/root/usr/sbin:/opt/rh/rh-php70/root/usr/bin:/opt/rh/rh-php70/root/usr/sbin:/opt/rh/httpd24/root/usr/bin:/opt/rh/httpd24/root/usr/sbin:/opt/rh/devtoolset-3/root/usr/bin:/opt/local/samtools/bin:/opt/local/nodejs/bin:/opt/local/dx-toolkit-v0.220.0/bin:/opt/local/composer/bin:/usr/local/bin:/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/genomeuser/.local/bin:/home/genomeuser/bin
export PATH
cd /opt/app/pp/active; 
# npm rebuild
../proteinpaint_run_node.sh


echo "ALSO Starting up pecan services....";
cd /opt/app/pecan/bin;
./start_queue_listener.sh
cd /opt/app/pp/
