#!/bin/bash

set -e

cd react
npm link

cd ../portal
npm link pp-react
