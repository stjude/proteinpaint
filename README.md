# Proteinpaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data

## Develop

Clone this repository and install its dependencies:

```bash
git clone git@github.com:stjude/proteinpaint.git
cd proteinpaint
npm install
node ./utils/install.pp.js
```

`npm run dev` rebundles backend and frontend code

`npm run server` restarts the proteinpaint server

`npm test` tests both frontend and backend code

`npm run test-browser` bundles the front-end spec files for use at localhost:[port]/testrun.html

`./scripts/deploy.sh [env]` builds and deploys the bundled code
