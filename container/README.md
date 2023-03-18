# Proteinpaint Container

This distribution creates a Docker image with all of the system requirements
for running the Proteinpaint application. 

NOTE: The reference data files will still need to be downloaded.

**TODO**:
- automate or simplify reference data download
- make PP reference data available as an online API, so that there will not be a need 
to download really large reference data files. Only when there are performance and
reliability concerns will local copies of reference data be desirable.

## Installation

All installation options require a [Docker Engine or Desktop](https://www.docker.com/).

There are 3 options to obtain a Docker image:

### Option A: Pull a Prebuilt Image

This may be the easiest option to get started. However, it may require more Docker know-how
for customization.

```bash
TAG=latest # can change to a version number like 2.11.2
IMAGE_NAME=ghcr.io/stjude/ppfull:$TAG # may use ppserver:$TAG for server-only image
docker pull ghcr.io/stjude/$IMAGE_NAME

# to test, make sure that your current working directory has
#
# - a serverconfig.json, which has a "url": "http://localhost:[PORT]" entry 
#   (default PORT=3456, can be set to any valid, non-conflicting numeric port value)
#
# - an optional dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/server/dataset 
#   

# download the run script
wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/run.sh

chmod a+x run.sh
./run.sh $IMAGE_NAME

# open the browser to your serverconfig.url entry
# example routes to check, assuming serverconfig.url=http://localhost:3456
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
# http://localhost:3456 should open the Proteinpaint landing page
```

### Option B: Use NPM

This installation option will require [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
It will hide the details of pulling a prebuilt Docker image or building an image from a Dockerfile. It will also
hide which scripts are called to run a Docker image.

#### Custom Registry and Token 

There is a plan to use the default npmjs.com registry to host the ProteinPaint packages. Until then, 
the Github Packages registry will require an `.npmrc` file, in your home or current working directory,
with [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
and namespace entries:

```text
//npm.pkg.github.com/:_authToken=...                   # ignore this comment # pragma: allowlist secret
@stjude:registry=https://npm.pkg.github.com/
```

#### Install with npm

```bash
# for non-global installation in a folder
npm install @stjude/proteinpaint-container

# --- OR ---
# for global installation from any folder
npm install -g @stjude/proteinpaint-container
```

NOTE: The installation will trigger a Docker image build, which may take
approximately 10 minutes.

#### Usage

Example usage, where the current working directory has:
- a serverconfig.json, which has a `"url": "http://localhost:[PORT]"` entry
(default PORT=3456, can be set to any valid, non-conflicting numeric port value)
- an optional dataset folder, containing js files of any serverconfig.genomes.datasets[]
entry that is not already included in proteinpaint/server/dataset 
- an optional public folder, containing any html page that embed proteinpaint views

```bash
# for a full portal with html pages
npx proteinpaint-container

# open the browser to your serverconfig.url entry
# example routes to check, assuming serverconfig.url=http://localhost:3456
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
# http://localhost:3456 should open the Proteinpaint landing page
```

To run only the Proteinpaint server data api, without a static file server:
```bash
npx proteinpaint-container server
```

To run a fully customized server, follow the docker run commands in `run.sh`.

### Option C: Build from Source

The Dockerfile may optionally use the various proteinpaint-* packages as packed from source code.

```bash
# clone this repo
git clone https://github.com/stjude/proteinpaint.git
cd proteinpaint/container

# OPTIONAL: pack workspaces and replace each package.json's 
# dependency versions with the tarball location as copied into the Docker build
# if this script is not used, then published packages will be used in the Docker build
./pack.sh

# will run docker build
./build.sh

TAG=latest # can change to a version number like 2.11.2
IMAGE_NAME=full:$TAG # may use server:$TAG for server-only image

# to test, make sure that your current working directory has
#
# - a serverconfig.json, which has a "url": "http://localhost:[PORT]" entry 
#   (default PORT=3456, can be set to any valid, non-conflicting numeric port value)
#
# - an optional dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/server/dataset 
#   

./run.sh $IMAGE_NAME # start a container process

# open the browser to your serverconfig.url entry
# example routes to check, assuming serverconfig.url=http://localhost:3456
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
# http://localhost:3456 should open the Proteinpaint landing page
```

## Development

### Code structure

- `launch.js` will be called in the host machine, to launch a Docker process using `run.sh`.
- `app-full.js` or `app-server.js` will be copied into a build stage and called from **within a Docker container**,
to fill-in missing serverconfig.json settings and optional public files, and to start the `proteinpaint-server`.


### Dev build

Follow the `Build from Source` section above to pack tarballs, build the Docker image, and start a container process.

If the container does not start, replace
```bash
CMD ["sh", "-c", "node app.js"]
```
in the Dockerfile with
```bash
CMD ["sleep", "3600"]
```

and then ssh to the container using `docker exec -it pp bash` to inspect
node_modules, run commands that are giving the error, etc.

You may also place the `CMD ["sleep", "3600"]` earlier in the Dockerfile
prior to a build step that emits an error, and then run the command from
that step within the container to debug.


### Package testing

Note that publishing to the registry should **not** be part of iterative testing/debugging.
Instead, test the packing and Docker builds locally as much as possible before creating a
versioned release. The only time that it is acceptable to publish for testing purposes is
as related to verifying and debugging CI actions/workflows, but that should be done rarely
and only using prerelase, prepatch, or other pre* version types, in order to avoid disrupting the 
published version sequence.

```bash
cd container
npm pack
cd sowmehere/outside/of/sjpp
npm install ~/dev/sjpp/proteinpaint/container/stjude-proteinpaint-....tgz
# make sure you have serverconfig.json in this dir
npx proteinpaint-container
docker logs pp
# ssh to an active container to inspect
docker exec -it pp bash
```
