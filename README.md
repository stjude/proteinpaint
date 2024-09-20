# ProteinPaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data

## Source Code 

```bash
git clone git@github.com:stjude/proteinpaint.git
```

## Installation

### Host Machine installation

```bash

If working on the server code: Install the 
[system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut)
as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).

```bash
cd proteinpaint
npm run sethooks
nvm use 20
npm install
# follow the instructions at https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit
```

### Docker dev container installation

Requires Docker Desktop on your host machine. 

```bash
cd proteinpaint
npm run sethooks
cd container/dev
./run.sh "/path/to/proteinpaint/"
```

## Develop
### Host Machine development

These scripts require npm v7.7.6+ and are tested with Node v20+.

```bash

# develop BOTH server and client code using 2 terminal windows/tabs
npm run dev # rebundles frontend code
npm start # in separate terminal runs the ProteinPaint server, requires a serverconfig.json at the project root

# --- OR --- 
# to display both server/client bundling logs, 
# plus server process logs in one terminal window/tab
npm run dev1

# --- OR ---
# see build/dev/README.md to use a Docker container for development
```
When running your dev server, you can see [marked up README's in the browser](http://localhost:3000/readme.html).


### Docker dev container development

Changes made to the code in the host machine will be reflected in the container and re-bundled automatically.
The command npm run dev1 will be run in the container when starting the docker image using /container/dev/run.sh script.

### Docker dev container development using VSCode

To use VSCode with the Docker container, you can use the Dev Containers extension.

1. Install the [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.
2. Open the proteinpaint directory in VSCode.
3. Click on the "Reopen project in Dev Container" button that appears in the bottom right corner of the window.
4. Open the terminal from VS code and run the following commands to start the server and bundling process:

```bash
npm install
npm run build
cp container/dev/serverconfig.json .
npm run dev1
```

## Test
```bash
npm testws # tests all workspaces
```

You can also set your `serverconfig.debugmode: true`, and open http://localhost:3000/testrun.html to see available client-side unit and integration tests.

## Build

### Package Release

The build and release steps can be triggered via Github Actions using the Create Release workflow.

### Docker Build

See [container/README.md](https://github.com/stjude/proteinpaint/blob/master/container/README.md).

### Version 

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).

You may dry-run a version change by running the following:

```bash
cd ~/proteinpaint
# see the comments in the script for arguments
./build/jump.sh patch

# to undo changes if the `-w` option was used 
git restore .
```

## Document

To auto-generate documentation to public/docs,

```bash
npm run doc
```

TODOs: 
- Organize the leftbar links by API topics, by using typescript namespaces or coding a custom plugin
- Display test code that are specific to a documented type or interface
