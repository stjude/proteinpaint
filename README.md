# Proteinpaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data


## Usage

Follow the [example project setup](https://github.com/stjude/pp-dist).


## Develop

### Source Code 

```bash
# St. Jude developers
git clone git@github.com:stjude/proteinpaint.git 

# GDC developers
git clone git@github.com:NCI-GDC/proteinpaint.git
```

### Installation

Install the [system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut) as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).

Then
```bash
cd proteinpaint
npm run sethooks
# follow the instructions at https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit
# to install system and application dependencies, then run of the scripts below
```

### Scripts

`npm run dev` rebundles backend and frontend code

`npm start` runs the proteinpaint server

`npm test` tests both frontend and backend code

`npm run test-browser` bundles the front-end spec files for use at localhost:[port]/testrun.html

`./scripts/deploy.sh [env]` builds and deploys the bundled code to internal SJ hosts

`./build/target.sh dev` builds a Docker image and runs a containerized server, but using the public/bin bundles from `npm run dev`


## Build

Follow the [build instructions](https://docs.google.com/document/d/13gUdU9UrHFkdspcQgc6ToRZJsrdFM4LCwCg7g1SQc4Q/edit?usp=sharing).
