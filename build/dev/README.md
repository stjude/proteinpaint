# Developer Container

## Background

The scripts in this directory sets up a developer enviroment using a Docker container.
Currently, only x86/amd64 machines may build the Docker image from source.
ARM/M1/M2 machines would have to download the image from Github Packages. Until the
cross-archictecture support is fixed, `run.sh` will pull a pre-built server image
that should allow frontend development in any CPU architecture. 

TODO: fix the M1/M2 support in the Dockerfile to allow server-side development.

## Setup

### Install

```bash
git clone git@github.com:stjude/proteinpaint.git
cd proteinpaint
npm install
```

### Client bundle

From the proteinpaint directory,

```bash
cd client
npm run dev
```

### serverconfig.json

In the proteinpaint directory, you should have a serverconfig.json that looks like:

```json
{
   "genomes": [
      {
         "name": "hg19",
         "species": "human",
         "file": "./genome/hg19.js",
         "datasets": [
            {
               "name": "Clinvar",
               "jsfile": "./dataset/clinvar.hg19.js"
            }
         ]
      },
      {
         "name": "hg38",
         "species": "human",
         "file": "./genome/hg38.js",
         "datasets": [
            {
               "name": "Clinvar",
               "jsfile": "./dataset/clinvar.hg38.js"
            }
         ]
      }
   ],
   "tpmasterdir": "/abs/path/to/data/dir",
   "backend_only": false
} 
```

### Server container

The following uses a pre-bundled server code inside a Docker container. (See the
TODO above to support local server development.)

NOTE: Make sure that you do not have any other server process that is listening on
the port value as specified in your serverconfig.json.

From the proteinpaint directory, run

```bash
./build/dev/run.sh

# to inspect the server logs
docker logs pp

# to stop the container process
docker stop pp
# or rerun `./build/dev/run.sh` to stop and remove a process with a matching name
```

### Web browser

Visit http://localhost:3000 to see your local ProteinPaint app instance. Note that
since a pre-built server image is used, this local instance is currently more limited
and may not be able to open all developer pages and features.

### Troubleshooting

To inspect the server logs:
- the running logs for server bundling and process are displayed in the terminal window where you triggered `./build/dev/run.sh`
- the client bundling logs will be displayed where you triggered `npm run dev` from the client dir 
