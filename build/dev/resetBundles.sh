#!/bin/bash

rm -f 'server/server.js*'
rm -rf public/bin
echo 'waiting for server and client code bundling to finish ...'
while [[ ! -f 'server/server.js' || ! -f 'public/bin/proteinpaint.js' ]]; do
	sleep 1; 
done
# there is a lag between bundling completion and webpack's log emission
sleep 1
echo 'may now start the server ...'
