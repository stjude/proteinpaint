# Proteinpaint Container

This distribution creates a Docker image with all of the system requirements
for running the Proteinpaint application. 

NOTE: The reference data files will still need to be downloaded.

**TODO**:
- automate or simplify reference data download
- ideal???: make a GDC-like API for PP reference data, so that there will not be a need 
to download really large reference data files. Only when there are performance and
reliability concerns will local copies of reference data be desirable.

## Installation

Requirements:
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker Engine or Desktop](https://www.docker.com/)

```bash
echo "@stjude:registry=https://npm.pkg.github.com/" > .npmrc

# for non-global installation in a folder
npm install @stjude/proteinpaint-container

# --- OR ---
# for global installation from any folder
npm install -g @stjude/proteinpaint-container
```

NOTE: The installation will trigger a Docker image build, which may take
approximately 10 minutes.

To pull updates:
```bash
npm update @stjude/proteinpaint-container
```

## Usage

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
# http://localhost:3456: should open the Proteinpaint landing page
```

To run only the Proteinpaint server data api, without a static file server:
```bash
npx proteinpaint-container server
```

To run a fully customized server, follow the docker run commands in `run.sh`.

## Development

The Dockerfile may optionally use the various proteinpaint-* as packed from source code.

```bash
# will pack workspaces and replace each package.json's dependency versions
# with the tarball location as copied into the Docker build
./pack.sh

# will run docker build
./build.sh
```