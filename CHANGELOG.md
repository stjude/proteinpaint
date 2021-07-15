# Change Log

All notable changes to this project will be documented in this file.

## 1.10

- move targets/ contents under the build/ directory
- improve the app drawer and examples
- prototype cumulative incidence plots in the termdb app
- extract or synthesize data for testing  

### GDC-related

- Use the GDC API to view slices in the BAM track

## 1.9.1

- Synchronize the version update in client and server package.json
- Delete unneeded build scripts
- Fix the extraction of files from a clean git workspace

## 1.9.0

- Reorganize the code into a monorepo structure using NPM workspaces
- Split the build and packing scripts to handle each respective target
- TODO: improve SJ server and client builds 

### GDC-related

- Prototype a GDC-specific build script and Dockerfile 
- TODO: create tiny test data files to test GDc features while building a Docker image

## 1.8.3

- Export the base_zindex from client.js

## 1.8.2

- Selectively import and re-order code in mds3/makeTk to address bundling issues
in consumer apps or portal code that use Webpack v3

### GDC-related

- do not use the test/init.js and pp bundle for automated tests of gdc-related code

## 1.8.1

- Bug fix: use the webpack.config.client.js (renamed) in build/pack.sh

## 1.8.0

### GDC-related

- Support passing gene, filters, and ssm_id as props
(NOTE: URL parsed information will be deprecated when the gdc portal app switches to passing via props only)
- Highlight a lolliplot disc when ssm_id is available
- Link to sample aliquot information from a sample details table
