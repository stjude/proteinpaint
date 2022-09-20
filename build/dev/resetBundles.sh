#!/bin/bash

echo 'waiting for server bundling to finish ...'
while [[ ! -f 'server/server.js' ]]; do
	sleep 1; 
done
# there is a lag between bundling completion and webpack's log emission
sleep 1
echo 'may now start the server ...'
