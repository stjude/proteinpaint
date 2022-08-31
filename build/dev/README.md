# Developer Container

## Background

The scripts in this directory sets up a developer enviroment
using a Docker container. Although it may take minutes to build
the initial Docker image, it is still easier than having to 
manually install the Proteinpaint system dependencies natively
in the developer machine.

## Setup

Run once to set up the base node-debian image:
```bash
./build/full/build.sh
```

To start the developer container:
```bash
# this will reuse the full build artifacts to lessen the total build time
./build/dev/run.sh
# !!! NOTE: There may be an initial server process error 
# if the bundling has not completed before the server start;
# use CTRL+Z to stop the loogin and `docker stop ppdev` to stop the container
```

To inspect troubleshoot logs:
- the running logs for server bundling and process are displayed in the terminal window where you triggered `./build/dev/run.sh`
- the client bundling logs will be displayed where you triggered `npm run dev` from the client dir 

## TODO 
- minimize the need for a full `npm install`, even for just the server workspace
- maybe used a squashed or flattened pprust image
