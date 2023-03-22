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

- [Option A: Pull a Prebuilt Image (Recommended)](https://github.com/stjude/proteinpaint/wiki/Installation-Option-A:-Pull-a-Prebuilt-Image-(Recommended))
- [Option B: Use NPM](https://github.com/stjude/proteinpaint/wiki/Installation-Option-B:-Use-NPM)
- [Option C: Build from Source](https://github.com/stjude/proteinpaint/wiki/Installation-Option-C:-Build-from-Source)

## Usage

To test, make sure that your current working directory has

- a serverconfig.json which has
  - a `tpmasterdir` entry, for the absolute path to the data directory
  - an optional `"URL": "http://localhost:[PORT]"` entry,  defaults to `"http://localhost:3456"`

- an optional dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
 that is not already included in proteinpaint/server/dataset    

### Running the image

Based on the installation option that you chose, you can either use: 
- `./run.sh [IMAGE_NAME]` for the non-NPM installation
- `npx proteinpaint-container [server | full]` if you used the NPM-installation option

### Web App

Open your web browser to your serverconfig.URL entry. The following examples assume that serverconfig.URL=http://localhost:3456.

When running either a server-only or full app image, you can check:
- http://localhost:3456/healthcheck
- http://localhost:3456/genomes


When running a full app image, you can check:
- http://localhost:3456 should open the Proteinpaint landing page

### Hints

- inspect logs with `docker logs pp`
- ssh into the container with `docker exec -it pp`
- stop the container with `docker stop pp`



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
cd dir/not/under/a/git/repo
npm install path/to/proteinpaint/container/stjude-proteinpaint-....tgz
# make sure you have serverconfig.json in this dir
npx proteinpaint-container
docker logs pp
# ssh to an active container to inspect
docker exec -it pp bash
```
