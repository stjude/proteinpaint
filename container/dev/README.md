# Docker dev container development

Requires Docker Desktop on your host machine. 

## Host Machine development

```bash
cd proteinpaint
npm run sethooks
cd container/dev
./run.sh "/path/to/proteinpaint/"
```


Changes made to the code in the host machine will be reflected in the container and re-bundled automatically.
The command npm run dev1 will be run in the container when starting the docker image using /container/dev/run.sh script.

## Docker dev container development using VSCode

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