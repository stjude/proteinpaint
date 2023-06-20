# Change Log

All notable changes to this project will be documented in this file. 
## 2.17.0

- start using typescript in core code
- option to filter by survival data
- precompute intermediate cuminc data to improve server response
- reactivate the support for selecting samples in the matrix plot
- create an improved geneset edit UI that can be used in matrix and other plots
- disambiguate variant and testing status matrix data by alteration type and origin
- fix the matrix sorting by fusion data
- fix the GDC server-side data query for matrix data, using cnv_occurrences
- fix the barchart sort order
- option to customize the violin plot "thickeness"
- experimental: prototype more features in the new disco plot

 
## 2.16.0

- improve the matrix control layout, labels, and mouseover information
- option to display quantitative CNV data using a chromatic scale in the matrix plot
- support new flags to disable custom track ui to guard against html injection
- support divide-by term and regression curve fitting for sample scatter plot
- support downloading multiple charts as one svg image file for survival and sample scatter plots
- update the optional origin values for variant data
- improve wholegenome numeric data plotting

- fix epaint panel positioning
- manual info filtering due to bcftools not filtering multi-ALT
- fix violin plot bugs related to scales, uncomputable values, pvalue table, and condition terms
- detect missing sample vcf file

 
## 2.15.0

- pin the base node image version for the Docker build
- improved gene/variable search result logic and display
- more migrated disco plot features
- synchronize scatter groups with mass state.groups
- prototype sample scatter divide by variable
- fixed current and added new integration tests: regression, cuminc, search, matrix
- fixed the ordering of condition terms and added integration tests

GDC-related
- fix the missing gene isoform error, by allowing empty query result from the gdc genedb

 
## 2.14.4

- support a matrix sort filter for a multi-valued sample, where a non-targeted filter value may be used for sorting
- fix adding a gene term to the matrix plot, by including a unique termwrapper $id
- fix failing client-side integration tests
 
## 2.14.3

- use a null filter0 for the OncoMatrix
- use dataset-defined matrix settings in the GDC launcher
 
## 2.14.2

- fix the expected scope for local workspaces when bumping versions
- fix the serverconfig detection in the container app scripts
- cap cnv values in the disco plot
- use dissimilarity mesaure for computing y-axis of nodes
- test fixes

 
## 2.14.1

- fix the matrix zoom outline in firefox
- fix dom canvas scaling in browsers that do not support OffscreenCanvas
- fix unit and integration tests

GDC-related
- move the CGC filter input to the gene control menu
- label the OncoMatrix undo/redo buttons to address Section 508 errors
- fix and improve the zoom UI labels to address Section 508 warnings

 
## 2.14.0

- persisted custom terms in termdb-based charts and apps
- matrix zoom/pan/scrolling, canvas rendering
- customizable colors for overlays/legends in more charts
- improved termdb database schema, ETL scripts, and queries
- prototype dendograms and heatmap using rust
- reimplement disco plot in proteinpaint
- log-scale in violin plot
- more unit and integratin tests, inluding fixes and improvements

 
## 2.13.0

- matrix zoom and pan
- feature improvement and bug fixes for sampleScatter 
 
## 2.12.1

- Switch to npmjs registry for npm publishing.
 
## 2.11.2

- improved docker build and release
- sample lists when allowed for violin and sample scatter plots
 
## 2.11.2-1

- allow listing samples from rendered charts for authorized users
- improved gene variant filters
 
## 2.11.2-0

- added license
- simplified file requests
 
## 2.11.1

- copy the gdc.hg38.js file from sjpp/dataset for the gdc Docker build
- configure the gdc.hg38.js dataset to de-prioritize cnv data for matrix sorting

 
## 2.11.0

- check the user permission using session id when generating GDC BAM search results
- option to set a default geneSymbol for mds3 gene search
 
## 2.10.1

- fix the rollup bundling of client code that breaks GDC bundling
 
## 2.10.0

- option to select samples from mds3 track
- activated more integration and unit tests on CI

 
## 2.9.8-2

- Bundle all cards.
 
## 2.9.8-1

- Bundle spliceevent.prep.js, spliceevent.a53ss.js and spliceevent.exonskip.js
 
## 2.9.8-0

- Set a default cards directory ONLY if it exists.
 
## 2.9.7-0

- Bundle shared/vcf.js.
 
## 2.9.6-0

- Budle dictionary.parse.js.
 
## 2.9.5-0

- Bundle termdb initbinconfig.
 
## 2.9.4-0

- Bundle checkReadingFrame and bedj.parseBed to the server module
 
## 2.9.3-0

- fixed rollup bundle issue
 
## 2.9.2-0

- Add violin plot integration tests
- Bundle lines2R to server module

## 2.9.0

- Improved matrix sorting

GDC-related
- OncoMatrix analysis card prototyped

## 2.8.x

- Release testing only for continuous delivery

## 2.7.3

- Fix the duplicate rows in about:filesize in bam track 

## 2.7.2

GDC-related
- fit the gdc bam slice request by not using compression

## 2.7.1

- improve tvs and filter UIs, and fix the integration tests

GDC-related
- fix the alert visibility when submitting a BAM slice + variant selection

## 2.7.0

- samplelst edit UI
- bean plot over violin plot

GDC-related
- preliminary support for the GDC filter0 in the matrix plot 

## 2.6.1

- fixes to the summary plot toggling
- track integration test data including minimal reference data slices

GDC-related
- more checks for gdc bam slice download, indexing

## 2.6.0

- support a samplelst term-type
- Github Actions for unit tests

GDC-related
- launch a separate SSM lollipop track using a term/variable filter
- fix the package files list for the GDC build
- temporary fix to GDC permission check request

## 2.5.1

- fixes to server tests

GDC-related
- fix the handling of optional environment variable for GDC API URL

## 2.5.0

- support for MSigDb genesets
- violin and TSNE plot prototypes
- auto-column width and more sorting options for the matrix plot
- improvements to other MASS UI plots

GDC-related
- handle sessionid cookie for the portal.gdc.cancer.gov
- oncoprint-like prototype

## 2.4.0

- d3 upgrade to version 7
- prototype the sample scatter plot in the MASS UI

GDC-related
- Use the portal.gdc.* URL to handle the sessionid cookie, instead of api.gdc.* with X-Auth-Token

## 2.3.1

GDC-related
- fix the cohort filter handling for GDC case search and BAM slice
- input border for text and search input within sja_root div

Dev-related
- readme.html to easily navigate and view readme's in one place

## 2.3.0

- data download app in the MASS UI
- improvements to the cuminc plot
- app drawer refactor

GDC-related
- more customized mutation colors for Section 508 compliance

Dev-related
- Upgrade to Node 16 for development, non-breaking as transpilation still targets Node 12 for deployed builds,
until SJ servers are upgraded to have python3
- node-canvas 2.9.3, fixes hardcoded requirement for Node 12 fonts
- Support Apple Silicon for Docker builds
- Support developer containers

## 2.2.0

- option to easily override colors for mutation class and other styles
- Improvements to MASS UI plots, including a data downloader app
- Updates to the BAM sequence read app

## 2.1.5

- move all React wrapper code to the GDC frontend framework repo

## 2.1.4

- make the React wrapper work in the GDC frontend framework

## 2.1.3

- include utils/install.pp.js in the package 

## 2.1.2

- fix the Docker build and npm packing for pp-dist

## 2.1.1

- bug-fix for trailing comma in gencode bigbed
- BAM: determine by read width whether to clip arrowhead; clean up re-align logic

GDC-related
- alert if token is missing when doing GDC BAM slicing

## 2.1.0

- new regresssion options in MASS UI
- BAM track improvements
- started the MASS matrix prototype

## 2.0.0

### Breaking Changes

- Now uses bigbed dbsnp files
- Requires additional columns for termdb database tables: terms.[type, isleaf], subcohort_terms.[child_types, includes_types]

### Non-breaking features
- MASS UI: supersedes the dictionary tree-based UI as the default termdb portal app


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
