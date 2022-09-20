# Proteinpaint Server

The data server backend for the ProteinPaint application

## Installation

The client dependencies should be installed as a workspace, follow the README at the project root.

You can either:
- use a docker container for development, see ../build/dev/README.md
- or install the [system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut)
as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).


## Develop

From the proteinpaint/server/ directory:

`npm run dev` rebundles backend code

`npm start` runs the proteinpaint server


## Build

```bash
npm version [major | minor | patch] # TODO: coordinate version changes across dependent workspaces
npm pack
npm publish
# !!! TODO: When deploying, use `npm update` from within the target host machine. !!!
```
