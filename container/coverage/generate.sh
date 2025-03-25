#!/bin/bash

set -exo pipefail

./copy-server-files.sh

./build.sh

./test.sh
