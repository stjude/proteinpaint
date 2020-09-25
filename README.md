# Proteinpaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data


## Usage

Follow the [example project setup](https://github.com/stjude/pp-trial).


## Develop

Clone this repository

```bash
git clone git@github.com:stjude/proteinpaint.git
cd proteinpaint
npm run sethooks
```

As needed, follow the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit)

`npm run dev` rebundles backend and frontend code

`npm run server` restarts the proteinpaint server

`npm test` tests both frontend and backend code

`npm run test-browser` bundles the front-end spec files for use at localhost:[port]/testrun.html

`./scripts/deploy.sh [env]` builds and deploys the bundled code


## Release

```bash
# assign a version number to the last commit,
# since using `npm version` directly causes unnecessary extra commits
npm run tag-patch # for bug fixes 
npm run tag-minor # for feature updates 

# publish a new package version
./scripts/publish registry # to GitHub Packages (@stjude/proteinpaint)
./scripts/publish tgz	# create a tarball only inside './tmppack'
./scripts/publish dry # only echoes the expected package contents, no actual files created
```
