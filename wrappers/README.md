# Proteinpaint Wrappers

how to package Proteinpaint front-end code for use as a node_module

## Usage

Set up the react wrapper component
```bash
cd wrappers/react
npm install
npm run dev
npm link
```

Set up an example portal app that embeds the react wrapper component
```bash
cd wrappers/portal
npm install
npm run dev
npm link pp-react
```

Expose the example portal app via the pp server
```bash
cd public
ln -s ../wrappers/portal/public portal
ln -s ../wrappers/react/public react

# then load http://localhost:3000/[react || portal], 
# edit the port :3000 based on your serverconfig.port
```