# Change Log

All notable changes to this project will be documented in this file.

## Unreleased

Features:
- In mds3 track, new option allows to show/hide variant labels
- Support optional postRender and error callbacks from the embedded wrapper code

Fixes:
- Bug fix that creating mds3 subtrack with long filter name breaks


## 2.31.0

Features:
- highlight the row and column of the matrix cell when hovering over it, allow the users to select color for the highlighter
- profile plots now have filters to the left and the new data model is plotted
- Use the GDC gene expression API to request top variably expressed genes

Fixes:
- In genetic association analysis, principal component covariates now use actual term names from db, rather than hardcoded adhoc name


## 2.30.5

Fixes:
- After creating mds3 subtrack via filtering, term name may be printed with value if short enough
- Mutation AAchange showing in scatterplot and matrix are now based on canonical isoform
- Darken selected colors for gencode and sandbox title, to address Section 508 contrast issues


## 2.30.4

Fixes:
- skip the GDC aliquot caching when validating the server  configuration, data, and startup


## 2.30.3

Fixes:
- GDC maf ui indicates total size of selected files
- Bin default age ranges by 30 and 60 years for GDC age_at_diagnosis


## 2.30.2

Fixes:
- In mass sampleview, expanding tree branch everytime no longer triggers rerendering of disco/ssgq plots
- Disco: file name of downloaded svg preserves context including sample name and gene.
- Disco: by default it now prioritize CGC genes in hg38.
- Various scatterplot fixes: tooltip dot scale, divideBy bug
- Fix the session recovery within an embedder portal


## 2.30.1

Fixes:
- use a more specific class selector for detecting pill divs in the data download app


## 2.30.0

Features:
- Support clicking matrix legends and matrix legend group names to use as filters.

Fixes:
- Revert prev change that cause hic genome view to misalign


## 2.29.6

Fixes:
- Restore yellow highlight line when moving cursor over a genome browser block


## 2.29.5

Fixes:
- In GDC disco and bam slicing UI, detect when total number of SSM exceeds view limit and indicate such


## 2.29.4

Fixes:
- Supply the svg element as argument to the disco plot download handler
- in termsetting constructor option, getBodyParams() replaces getCurrentGeneNames() as a general and flexible solution

DevOps:
- fix the tp dir setup and package.json deps update for the integration test CI


## 2.29.3

Fixes:
- Bug fix to revert termdb/category route usage.
- search term with space character for genomic-equipped dataset should not break by gene search msg


## 2.29.2

Fixes:
- Use a jwt bearer auth to propagate basic session state to multiple PP server processes, beyond the server process that processed the /dslogin request
- Bug fix.


## 2.29.1
Fixes:
- Minor bug fixes.

## 2.29.0


## 2.28.0

Features:
- Added radar plots to the profile


## 2.27.2

- Correctly parse a null URL parameter value


## 2.27.1

Features:
- Disco plot UI with an example on the app drawer. Users can provide SNV, SV, and CNV data to create a disco plot.
- We can support now reading hic files for versions 7, 8 and 9
- Support different auth methods for the same dataset, by server route and app embedder.
- New button in geneset edit UI allowing to load top variably expressed genes in hierarchical clustering, for eligible datasets
- Support clicking matrix legends to use as filters.


## 2.27.0

Features:
- Prototyped single sample viewer
- Default bin configs for GDC numeric variables are determined on the fly and no longer hardcoded
- For matrix plot, when hovering over gene label, show the percentage of mutation (#mutated samples / #tested sample)
- Click the divide-by term at the top left corner of matrix plot to edit, replace, or delete
- Display average admix coefficient for filter-vs-population comparison in genome browser
- Prototyped a server route for cumulative burden estimates
- Prototyped support for disco plot to show adhoc data

Fixes:
- Fix for sorting the custom bin labels on numeric terms in violin plot
- Gracefully handle a Hi-C file with no frag resolutions
- Display Age at diagnosis in years instead of days for GDC
- Fix the GDC Days to birth axis issue
- Fix the issues results from term conversion between continous and discrete mode
- Indicate the original value unit in termsetting UI if the term value is converted; safety check on bin size to avoid crashes
- Add a safety check for the first bin stop and last bin start in numeric discrete termsetting, make the ui actually usable
- Bug fix for the broken single variant panel from mds3 tk, by requiring tooltipPrintValue() to return [{k,v}]
- Mds3 variant2samples.get() returns an object to wrap the optional bin labels
- Allow a sample to be missing files for disco and singleSampleGenomeQuantification data types and do not break server
- Display matrix cell tooltip as two column table, and group events of same dt under same heading
- Bug fix to not to print text when average admix value is missing; improve population item UI in genomebrowser controls
- Improve INFO field UI in genome browser group selection
- Option to disable switching GDC SSM lollipop track to genomic mode, due to issues with api query

DevOps:
- Support more release note section titles and their corresponding commit keywords
- Avoid unnecessarily running unit test CI, for pull requests with unaffected workspaces and on automated push
- Improve the release text detection and generator, to minimize potential conflicts when merging


## 2.26.1

Fix
- add a latest tag to the docker build
 
## 2.26.0

Features:
- For hg38-based datasets, Disco plot may prioritize gene labels by Cancer Gene Census genes.
- Numeric termsetting edit UI shows density curve at mode=continuous.
- Update gene filter to restrict filtering for multiple alteration groups.
- Unify click behavior for survival and cuminc legend items.
- Mds3 numeric axis (e.g. occurrence) y scale can be edited.
- PrOFILE polar and barchart bug fixes and improvements.
- Implemented at-risk count filter in mass cuminc plot
- GDC "Age at diagnosis" value by day is shown as "X years, Y days" in mds3 sample table.
- Prototype a hierarchical cluster plot using the matrix plot
- New Info fields from gnomAD added to clinvar datasets for mds3 track
- CancerHotspot hg19 data added for mds3 track
- Display sample and catergory numbers in each subgroup when hovering over term label in matrix plot


Fixes:
- Ignore hidden values when conducting association tests for mass barchart.
- Do not force a matrix barplot min scale to 0;
- Fix the missing tooltip when mousing over second+ continuous matrix barplot rows
- For matrix plot, when the "Group Samples By" variable has a predefined order, use that order for subgroups. 
- Fix the sessionid handling to allow more OncoMatrix data to be shown for a signed-in user.
- For SSM from GDC API, use consequence from canonical transcript designated by GDC.
- GDC SSM range query by graphql appropriately accounts for sample filtering from a subtrack.
- In GDC bam slicing block display, clicking on a transcript from native gene tk will disable the "View in protein" option.
- Improve the hierarchical clustering R script to include the scaling step.
- Add CNV information to label tooltips in disco plot.
- Fixed legend labels for continuous term and uncomputable categories in violin plot

 
## 2.25.0

Features:
- Display pairlst data, if available, for a fusion event on matrix cell mouseover
- Launch lollipop from a geneVariant row label of matrix
- User-controllable filter for at-risk counts in cumulative incidence plot
- Default binning improved for GDC numeric dictionary variables with stats{} from graphql query

Fixes:
- Bug fix to change cutoff grade for condition term
- Fix the matrix sample sorting by name, to use the display sampleName instead of sample ID
- Fix the matrux sample group sorting by group name, to use predefined or group name as applicable
- In lollipop tk, upon creating a subtk with a filtering criteria, sunburst generated from subtk will show correct total sample count for sunburst wedges by accounting for subtk filtering criteria. this fix works for both GDC and local TK
- Scatterplot bug fix to improve behavior upon filtering by gene mutation
- When filtering results in 0 eligible sample, big file query will not happen.

 
## 2.24.1

Devops:
- Fix the npm publish CI to use the list of changed workspace dirs as argument
- Fix the empty change detection in the version jump script

 
## 2.24.0

Features
- Profile plots have now filters and a download button
- Make disco plot rings width configurable
- Added to scatter plot scale dot option. Added also test for it.
- Support a reset button option for the rx recover component

Fixes:
- Selecting hundreds of samples from GDC lollipop no longer hangs or crashes (using a cached mapping to case uuid)
- Fix the numeric edit menu when violin plot data is requested for a GDC variable, which needs currentGeneNames
- Bug fix to show reduced sample summaries when creating sub-track from GDC lollipop (mds3) track
- Correctly handle special uncomputable numeric term values in a matrix row bar plot, when mode='continuous' 
- GDC OncoMatrix has switched to use case uuid but not case submitter id to align data, while still displaying submitter ids on UI; the latter is not unique between projects.

DevOps:
- Reuse a published dependencies image for releasing new image versions to improve build times and stability

 
## 2.19.2

Fixes
- Use import() instead of require() for dynamic import, so that rollup can bundle properly
 
## 2.19.1

Enhancements
- Display sample counts in matrix sample group labels, mouseovers, and legend.
- Option to toggle a matrix sample group visibility by clicking on the corresponding legend item

Fixes
- Cohort creation in the matrix plot, where sample atttribute mapping is required.
- Allow continuous variables to be added to GDC matrix without breaking. Next will support query of graphql API to retrieve min/max of the variables.
- Sort matrix samples by gene variant hits before grouping, then sort again within each group
- Reenable selecting samples from lollipop view for cohort creation. On the fly aliquote-to-case.case_id conversion is performed on
selected samples, allowing to create GDC cohort; next the conversion will be supported by caching to allow to work with large number of samples.

 
## 2.19.0

- Fusion event labels in disco plot are prioritized and displayed with a tooltip
- Various minor disco plot bug fixes
- Improved matrix sample sorting options and labels
- Option to truncate matrix labels for columns and rows
- Improved readme detection, sorting, and error handling
- Started type definitions for termwrapper and termsetting-related code
- Prototyped a custom profile barchart

 
## 2.18.3

- supported a matrix cell click option 
- added a dtsv case in the bulk.svjson parser
- prototyped new chart profileBarplot
- handled on the fly cnv call from genebody probe signals
- defaulted to truncate matrix samples against gene variant hits even when there are selected dictionary terms
- fixed the matrix rezoom-by-outline zooming out instead of zooming in
- fixed bugs found in 3d plot opened from the new dynamic scatter
 
## 2.18.2

- handle optional action.config in mass store.plot_edit()
- fix recover to not prematurely replace state
- fix LohArc import for rollup
 
## 2.18.1

- fix the rollup bundling error caused by the dynamic import of Disco.ts

 
## 2.18.0

- fixed the matrix sample grouping input lag, edit menu error, empty column bug
- contextualized the matrix row label mouseover title
- removed GDC terms that are IDs or cause server response errors
- removed the numeric axis in the matrix row label when switching from continuous to discrete mode 
- removed an empty matrix term group after its last remaining term gets moved to a different term 
- supported launching disco plot from a matrix sample label click
- improved the geneset edit UI by having group input and fixing bugs
- supported a standalone scatter plot button in the charts tab
- mds3 gdc convert to case.case_id on the fly for disco plot
- improved disco plot tooltip, ring logic, other features and bug fixes
- use typescript for genomes, dataset, termsetting code

 
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
