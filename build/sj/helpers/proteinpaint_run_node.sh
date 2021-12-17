#!/bin/bash

set -e 

cd /opt/app/pp/active

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

logLastLines=""
sleep 1
while [[ "$logLastLines" == "" ]]
do
  # detect if there are startup errors
  # this replaces `node server.js validate`, so no need for separate
  # server starts, a validated server can proceed to listening after 
  # the active server process gets stopped
  if [[ -f $logdir/err && "$(cat $logdir/err)" != "" ]]; then
    echo "Error in server startup"
    cat $logdir/err
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

# point the log/forever symlink to the newest log directory
ln -sfn $logdir /opt/data/pp/pp-log/forever

echo "triggering /switchPorts ..."
curl http://localhost:3999/switchPorts
echo -e "\n"

cd ..
echo "RESTARTED"
./helpers/record.sh restart 
