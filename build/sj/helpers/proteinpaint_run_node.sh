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
npx forever -m 10000 -a --minUptime 5000 --spinSleepTime 1000 --uid "pp" -l $logdir/log -o $logdir/out -e $logdir/err start server.js --max-old-space-size=8192

logtail=""
vstatus=""
i=0
while [[ "$logtail" == "" ]]
do
  sleep 1
  i=$[i+1]

  # detect if there are startup errors
  # this replaces `node server.js validate`, so no need for separate
  # server starts, a validated server can proceed to listening after 
  # the active server process gets stopped
  if [[ "$vstatus" == "passed" ]]; then
    # any logged error will NOT be related to the initial server validation,
    # so allow the server process switchover is allowed even though
    # the first requests to the new server process may trigger an error
    :
  elif [[ -f $logdir/log && "$(grep -c "Validation succeeded." $logdir/log)" != "0" ]]; then
    vstatus="passed"
    printf "\rvalidation passed after $i seconds.\n"
  elif [[ -f $logdir/err && "$(cat $logdir/err)" != "" ]]; then
    echo "Error in server startup"
    cat $logdir/err
    node /opt/app/pp/ppstop.js error
    exit 1
  fi

  # detect if the post-app.listen() message has been logged
  if [[ -f $logdir/log ]]; then
    logtail=$(tail -n1 $logdir/log | grep "PORT 3000" | sed -r 's/\x1B\[(;?[0-9]{1,3})+[mGK]//g')
  fi
  
  if [[ "$logtail" != "" ]]; then
    printf "\rdetecting server startup [$logtail] (total startup time: $i seconds)\n"
  elif [[ "$vstatus" == "passed" ]]; then
    printf "\rdetecting server startup [$i seconds]"
  else
    printf "\rvalidating ... [$i seconds]"
  fi
done
# point the log/forever symlink to the newest log directory
ln -sfn $logdir /opt/data/pp/pp-log/forever

echo "RESTARTED"
cd ..
./helpers/record.sh restart 

# restart blat server if it is not running AND if there is a blat script
blatscript=/opt/data/pp/blatserver.sh
if [[ $(ps aux | grep gfServer | wc -l) -lt 2  && -f $blatscript ]]; then
  echo "triggering $blatscript"
  sh $blatscript
fi

