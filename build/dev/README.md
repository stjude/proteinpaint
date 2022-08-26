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
```
# this will reuse the full build artifacts to lessen the total build time
./build/dev/run.sh
```

To inspect troubleshoot logs:
- the client bundling logs are displayed in the terminal window where you triggered `./build/dev/run.sh`
- the running logs for server bundling and process can be displayed in a terminal via `docker logs ppdev --follow` 

## TODO 
- minimize the need for a full `npm install`, even for just the server workspace
- maybe used a squashed or flattened pprust image
