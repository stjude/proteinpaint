#!/bin/bash

set -e 

cd /opt/app/pp/active

# validate the server without triggering app.listen() and  before restarting with forever
echo "Validating the server configuration against data and code:"
echo "If you do not see a message for server restart in a few seconds, see validation.log to troubleshoot ..."
echo -e "\n\n$(date '+%Y-%m-%d %H:%M:%S')" >> ../../validate.log

# DO NOT USE: this does not output any validation log to terminal, only to file
# node ./server.js validate >> ../../validate.log 2>&1

# this logs both to terminal and file, but must reset the pipe
# to cause the script to fail if there is a validation error
set -o pipefail
node ./server.js validate 2>&1 | tee -a ../../validate.log
set +o pipefail

echo "*** RESTARTING proteinpaint node server ***"

# get the process index for any active pp server that is already running
# must set serverconfig.preListenScript=/opt/app/pp/psindex.sh
psindex=$(/opt/app/pp/psindex.sh | tr -d '[:space:]')
echo "previous forever process index: [$psindex]"
timestamp=$(date +"%Y-%m-%d-%H%M%S")
logdir=/opt/data/pp/pp-log/forever-$timestamp
mkdir $logdir
# start a new pp server
./node_modules/.bin/forever -m 10000 -a --minUptime 5000 --spinSleepTime 1000 --uid "pp" -l $logdir/log -o $logdir/out -e $logdir/err start server.js --max-old-space-size=8192
# move the log/forever symlink to the newest log directory
ln -sfn $logdir /opt/data/pp/pp-log/forever

set -e
logLastLines=""
sleep 1
while [[ "$logLastLines" == "" ]]
do
  # detect if there are startup errors
  if [[ -f $logdir/err && "$(cat $logdir/err)" != "" ]]; then
    echo "Error in server startup"
    exit 1
  fi
  if [[ -f $logdir/log ]]; then
    logLastLines=$(tail $logdir/log | grep "PORT 3999" | sed -r 's/\x1B\[(;?[0-9]{1,3})+[mGK]//g')
  fi
  echo "testing port ... [$logLastLines]"
  sleep 1
done

if [[ "$psindex" != "" ]]; then
  echo "stopping the previous process='$psindex'"
  forever stop $psindex
fi

echo "triggering /switchPorts ..."
curl http://localhost:3999/switchPorts
echo -e "\n"
cd ..
echo "RESTARTED"
./helpers/record.sh restart 
