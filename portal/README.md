# Proteinpaint Portal

An example portal that uses Proteinpaint as client and server packages

## Develop

```bash
# in a terminal
cd portal
npm run dev 
# note: there may be an initial webpack bundling error that will get corrected quickly

# in a separate terminal
cd portal
npm start
```

## Build

```bash
npm version [major | minor | patch] # TODO: coordinate version changes across dependent workspaces
npm pack
npm publish
# !!! TODO: When deploying, use `npm update` from within the target host machine. !!!
```
