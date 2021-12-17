#!/bin/bash

set -e 

cd /opt/app/pp/active

echo "*** RESTARTING proteinpaint node server ***"

timestamp=$(date +"%Y-%m-%d-%H%M%S")
logdir=/opt/data/pp/pp-log/forever-$timestamp
echo "making logdir=$logdir"
mkdir $logdir

# start a new pp server. 
# NOTE: for zero downtime switchover, 
# server.js uses the serverconfig.preListenScript=/opt/app/pp/ppstop.sj 
# option to stop all processes except the most recently started,
# before app.listen()
./node_modules/.bin/forever -m 10000 -a --minUptime 5000 --spinSleepTime 1000 --uid "pp" -l $logdir/log -o $logdir/out -e $logdir/err start server.js --max-old-space-size=8192

# detect errors in the launched process' log files
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
    node /opt/app/pp/ppstop.js error
    exit 1
  fi
  if [[ -f $logdir/log ]]; then
    logLastLines=$(tail $logdir/log | grep "PORT 3000" | sed -r 's/\x1B\[(;?[0-9]{1,3})+[mGK]//g')
  fi
  echo "detecting server startup ... [$logLastLines]"
  sleep 1
done

# point the log/forever symlink to the newest log directory
ln -sfn $logdir /opt/data/pp/pp-log/forever

cd ..
echo "RESTARTED"
./helpers/record.sh restart 

# restart blat server if it is not running AND if there is a blat script
blatscript=/opt/data/pp/blatserver.sh
if [[ $(ps aux | grep gfServer | wc -l) -lt 2  && -f $blatscript ]]; then
  echo "triggering $blatscript"
  sh $blatscript
fi

