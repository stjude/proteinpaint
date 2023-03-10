#!/bin/bash

## exit 0 because of 'Process completed with exit code 143.' failure on github actions on 'pkill -f node'
function exitZero() {
exit 0
}
pkill -f node
trap exitZero EXIT INT TERM
