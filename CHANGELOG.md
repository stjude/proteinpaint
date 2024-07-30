# Change Log

All notable changes to this project will be documented in this file.

## 2.70.3

Fixes:
- prototype to allow GDC dictionary terms to work for barchart and query data without any genomic filter


## 2.70.2

Fixes:
- on validating container, gdc logic will skip case caching and stale cache check
- improve getData() to handle missing bin config for gene exp term for better performance


## 2.70.1

Fixes:
- pp and gdc filter are passed to getDefaultBin request for gene exp terms etc. bins are always computed against cohort to be precise
- violin data request at gene exp termsetting ui observes filter0


## 2.70.0

Features:
- prototype periodic check if gdc case-id-cache is stale and re-cache

Fixes:
- Allow to add survival term to GDC gene expression clustering map


## 2.69.0

General:
- bug fix: when clicking labels on violin plot breaks on master

Features:
- matrix and hiercluster: allow to recompute term shown in continuous mode as zscore

Fixes:
- pass filter0 in barchart request to work for gdc data


## 2.68.0

Features:
- New Data Matrix and Gene Expression cards on the homepage
- Enable edit option for geneVariant terms in oncoMatrix
- New continuous variables scatter plot example available from the scatter plot card on the homepage.
- New GDC sample disco plot example available from the disco card on the homepage.
- implemented the "snp" term type for summarizing and analyzing sample genotypes for a given SNP
- allow the drag/drop of rows from non-clustered row groups
- Added Facet plot to the UI
- New gene expression example available from the scatter plot card on the homepage.
- In the gene set edit UI, user is able to choose returning all genes or compare against a predefined or custom gene set.
- Handle custom matrix geneset input option
- In GDC gene exp clustering, when screening user-defined gene sets, use a close-to-zero min_median_log2_uqfpkm parameter to keep more genes expressed at low level

Fixes:
- hierCluster group Add_Rows ui can only add compatible terms
- filter0 is passed to violin request and improve to enable type checking
- gene expression hierCluster group Add_Rows ui can only add gene expression terms
- pass filter0 at sampleScatter to enable gdc gene exp plot, remove duplicating backend call for gene exp data
- allow GDC gene exp scatter plot to show case name


## 2.67.1

Fixes:
- improve oncomatrix non-ci test to include gene expression and survival, and CNV-only cohort

DevOps:
- Trigger browser notiffications of dev events such as rebundling status


## 2.67.0

Features:
- Support inputing custom CNV segments in mds3 tk, improve cnv rendering
- Support overall survival data from gdc
- New Publications button in the ProteinPaint header. Results are searchable in the omnisearch.
- support drag-and-drop groupsetting for geneVariant term
- support geneVariant term in regression analysis

Fixes:
- provide null values to brush range if there is no selection on brushing
- hiercluster refactored not to pretend geneVariant term type
- Centralize filter rehydration
- hiercluster: set missing term type based on data type


## 2.66.0

Features:
- Added use case to open the single cell gene expression violin of a sample

Fixes:
- At oncomatrix, allow gene expression term to pull data on all cases
- matrix: hover/click menu over geneexp/metabolite rows should indicate term type, and do not show undefined for missing data
- singlecell native gene exp data is loaded from rds file; no longer grep
- Speed up top variably expressed genes query from gdc api, directly submit case filter and do not first retrieve list of cases
- fix definitions for termsbyid route


## 2.65.0

Features:
- Single cell plots support now color by gene if geneExpression data it is provided

Fixes:
- Handle json payload for requests that contain authentication token


## 2.64.0

Features:
- Allow switching to other color scheme for hierCluster

Fixes:
- getFilterName() treats geneExp and metabolite same as float terms
- use Mds3 ttype, to catch potential typescript errors, early in termdb/config route handler functions


## 2.63.6

Fixes:
- create minified msigdb and associate to hg38-test for CI
- set appropriate response headers for all responses


## 2.63.5

Fixes:
- bug fix to pass terms[] when filtering by metaboliteIntensity
- use diagnosis specific age cutoff for the CHC burden calculation
- mds3 tk assigns vocabApi.app.opts.genome in adhoc manner for gene search to work in stateless filter UI
- fix the detection of hierCluster term group when handling a gene expression cell click


## 2.63.4

Fixes:
- fix the generation of Function constructor arguments for dataset configured data getters and mappers


## 2.63.3

Fixes:
- make the matrix react to divide-by term edits from the label click


## 2.63.3-2

Features:
- Matrix plot survival term improvements: mouseover time-to-event and exit code info, color coding

## 2.63.3-1

Fixes:
- Replace "patients" with "samples" in barchart plots


## 2.63.3-0

Fixes:
- Fix termsetting scale for density plots

## 2.63.2

Fixes:
- bug fix to only apply niceNumLabels() when numeric tvs is not unbounded
- bug fix to allow for interactions with molecular variables in regression analysis
- test run on all genome tabix files on server launch to detect old index file issue early
- add missing jsonwebtoken import

DevOps:
- use esbuild in client unit and integration tests


## 2.63.1

Fixes:
- Fix setHostUrl function.

## 2.63.0

Features:
- Allow to add survival terms to oncoMatrix

Fixes:
- show a border on select dropdown elements, within sja scope

DevOps:
- replace client dev scripts and html to use esbuild-bundled code


## 2.62.0

Features:
- geneVariant term now supports grouping variants into predefined groups


## 2.61.2

Fixes:
- Limit the css reset to not conflict with embedder styles, by using scoped normalize css rules


## 2.61.1

Fixes:
- handle prebuilt matrix plots to work with the advanced sorter UI
- scope PP-specific css resets and styles to the root holder, such as the previously unscoped h2 style


## 2.61.0

Features:
- Adding sorting samples options for hierCluster


## 2.60.0

Features:
- Data for the hic whole genome view is cached for faster load. Additional UI improvements in the hic app.

Fixes:
- fixed rendering of barchart and violin when terms have uncomputable categories
- Fixed issues with the resolution in the hic detail view.


## 2.59.0

Features:
- GDC bam app can visualize truncated bam slice when streaming is terminated due to hitting max size
- Supported geneExpression filtering

Fixes:
- Mds3 backend reuse gene search helper to be able to find a gene by isoform access in addition to symbol


## 2.58.1

Fixes:
- import findParent in the groups component and create tests


## 2.58.0

General:
- Update custom mutation data instruction.

Features:
- Significant improvements to the whole genome hic app including: faster load, ability to launch the chromosome pair and detail view from runproteinpaint(), rendering fixes, additional min cutoff input, and change to reactive app.
- support dataset-specific healthcheck information
- In mds3 tk, add Point up/down option when in skewer mode

Fixes:
- Filter mutations checkbox is not shown for if there is no CGC
- Bcf url argument for mds3 tracks fixed.
- No empty gdc filter elements will be created when mapping pp filter to GDC format
- show the incomplete caching message in the gene expression app
- COSMIC mds3 track bug fix, number of variants will go down in subtrack with sample filtering


## 2.57.0

Features:
- enable 'lollipop' plot btn through tsne sample clicking for geneVariant terms

Fixes:
- GDC sequence reads viz no longer limits slicing range; the only limit is slice file size
- GDC bam slicing ui show actual number of available bam files which can be lower than 1000, fix scrollbar appearance
- Updated protein domain color is applied to all instances of this domain, not just first one
- replace 'view' with 'Sample view' on tsne sample label clicking


## 2.56.0

Features:
- Disco plot: added hambuger menu
- Disco plot: added option to render CNVs as heatmap and barchart
- Disco plot: added option to set percentile for CNV rendering


## 2.55.1

Fixes:
- prevent showing a blank CNV legend in the lolllipop app


## 2.55.0

Features:
- oncoMatrix: after hiding a category from divideBy term, add an option to divideBy button to bring it back

Fixes:
- numeric setdefaultq() will default to term's own default bin type rather than always hardcoding to regular-bin
- Pass request header containing session when querying arriba file which is controlled
- improve GDC cohortMAF ui to add case link and make scrollbar more apparent


## 2.54.0

Features:
- Click on protein domain legend to show menu options to toggle visibility and change color.

Fixes:
- email log bug fix


## 2.53.0

Features:
- Both mutation and sv/fusion data can be submitted in one ui to create custom mds3 tk
- New BCF card on the home page. See proteinpaint.stjude.org/?appcard=BCF.

Fixes:
- fix npm start
- address mds3 mclass legend error by not setting uninitiated flag to true


## 2.52.0

Features:
- enable downloading data for oncoMatrix


## 2.51.2

Fixes:
- fix position errors after oncoMatrix/hierCluster zooming in/out caused by outdated imgBox
- when parsing phenotree, enforce uncomputable categories are numbers also


## 2.51.1

Fixes:
- Oncomatrix do not allow to hide all the alteration groups


## 2.51.0

Features:
- Support survival term as outcome variable in regression analysis


## 2.50.0

Features:
- include auth test status in server healthcheck
- Hide synonymous mutations by default for GDC oncoMatrix
- Improve the matrix sorting options to easily toggle sorting by cnv and/or consequence

Fixes:
- fix the error from genomic alterations rendering when there are no mutations or CNV data
- In GDC query, do not supply empty "case_filters{content[]}" that will slow down API. lollipop and oncomatrix are now faster when there's no cohort
- at GDC bam slicing UI, the table listing available cases and bam files can be filtered by assay types
- Add to GDC oncoMatrix mutation/cnv buttons all available mutation/cnv classes in GDC instead of all available mutation/cnv classes in the current matrix


## 2.49.0

Features:
- Display hints about persisted matrix gene set and option to unhide CNV and mutations when there is no matrix data to render
- Stream data into and out of R using the run_R.js module
- Reenable the option to create a single sample cohort from a lollipop sample table/menu

Fixes:
- refactor to move all gdc plot launchers into a separate folder


## 2.48.1

Fixes:
- GDC bam slicing download app now calls gdc api directly from client without going through pp backend
- Group similar mutation class colors together when sorting matrix samples and if CNVs are displayed
- Add Single style for GDC oncoMatrix


## 2.48.0

Features:
- enable selecting individual mclasses upon clicking GDC oncomatrix mutation/cnv button

Fixes:
- Fix the timeout issues when using ky http client
- change the defination of trancating/protein-changing mutation, change oncomatrix mclasses sorting order
- Fix to unhide a survival series by clicking its corresponding legend entry
- Do not persist highlighted dendrogram branch selection when the hier. cluster data changes due to changes to cohort, clustering method, etc.
- Disable the geneset submit button when there there is less than a minNumGenes option (3 for hier cluster, 1 for matrix)


## 2.47.1

Fixes:
- Include gfClient to the pp deps image
- remove main menu renderer from disco plot


## 2.47.0

Features:
- Add Mutation and CNV control buttons for GDC. Hide CNV by default for GDC.

Fixes:
- Fix custom jwt processing by replacing the remaining webpack_require in auth code
- Do not force the sample table to be positioned relative to screen bottom after a sunburst click


## 2.46.4

Fixes:
- updated mclass definitions and rank for protein_altering_variant
- mds3 tk temporarily disables sample selection button in single sample table, to avoid creating single-case cohort in GDC
- deprecated term "sample_type" is dropped from GDC dictionary


## 2.46.3

Fixes:
- preliminary fix for mds3 tk using custom bcf file to pull mutated smples


## 2.46.2

Fixes:
- Dataset configuration should have limited access to server code


## 2.46.1

Fixes:
- when a term has only 2 categories, then only a single category needs to be tested in the association test
- Return early on server validation instead of proceeding with startup


## 2.46.0

Features:
- Migrate the CJS server workspace into an ESM package

Fixes:
- Fix disco plot width issue
- Restore drag to resize on legacy ds gene exp panel


## 2.45.0

Features:
- Add test-data-ids to enable mds3 e2e testing


## 2.44.0


## 2.43.2

Fixes:
- GDC BAM slicing will be terminated if slice file size exceeds a limit (user is informed)


## 2.43.1

Fixes:
- switching GDC mds3 track from gene to genomic mode it can properly display ssm now


## 2.43.0

Features:
- enable geneVariant legend group filter for hierCluster
- combine all dts (except for dt=4) into mutations/consequences legend group for dt without assay availability

Fixes:
- allow to use a simplified filterObj on mds3 tk that will be hydrated on launch


## 2.42.2

Fixes:
- mds3 tk sample summary table will scroll if too tall


## 2.42.1

Fixes:
- Replace require syntax with import to prevent bundling errors in client package bundlers


## 2.42.0

Features:
- upgrade node from v16 to v20

Fixes:
- Show user error message for an invalid genome provided in a URL. Error message contains the list of available genomes from that server.


## 2.41.1

Fixes:
- when downloading GDC bam slice (no caching), do not limit request region max size;
- Reload page while streaming/downloading gdc bam slice to client will not crash server
- GDC bam slice ui requires hitting Enter to search and no longer auto search to avoid showing duplicate ssm table
- support ?massnative=genome,dslabel url parameter shorthand


## 2.41.0

Features:
- adding geneset edit ui from Gene Expression chart button

Fixes:
- Bug fix to show correct category total size by passing a missing filter0
- profilegenevalue track reports subtrack file error in a legible way
- Bug fix for disco plot launched from sunburst shows aachange in sandbox header rather than undefined


## 2.40.8

Fixes:
- BAM track bug fix to handle reads with no sequence and not to break.
- BAM track bug fix to not to break by hide/show toggling at track menu
- In GDC BAM slicing, before creating new cache file, find out old enough ones to delete to free up storage
- Bug fix to convert "case." to "cases." in case_filters[] for GDC mds3 sunburst clicking to load sample table
- Bug fix for GDC mds3 category total sample count to respond/shrink with cohort change
- Prevent double-clicking on a sunburst ring so that same sample table will not appear duplicated


## 2.40.7

Fixes:
- Fix the detection of sorting-related updates in the matrix app, as distinct from the hier cluster
- Pass the cohort filter to the lollipop track from the matrix gene label click
- Pass the cohort filter to the lollipop track from the matrix and disco plot label click


## 2.40.6

Fixes:
- Refactor and improve backend GDC BAM slicing logic
- BAM track in variant-typing mode, read group header clicking is disabled due to known issue with GFF
- GDC BAM slicing will reject if range>=50kb to be safe
- reliably detect stale async results using a rx component api method
- Cancel stale fetch requests to unblock current geneset, matrix, and hierCluster requests that are being throttled by the browser's concurrent request limit
- Do not re-render the matrix controls as part of displaying a no data message when svg dimensions and layout have not been computed yet
- Do not assign a non-auth related error as a token verification message, which caused the matrix to not rerender even with subsequent valid data
- Do not display a mouseover over a hidden matrix or hier cluster svg
- an unrendered matrix or hierCluster should not react to window resize


## 2.40.5

Fixes:
- do not redispatch a plot_splice from the oncomatrix and gene expression launchers

## 2.40.4

Fixes:
- Hide the undo/redo buttons until a more thorough fix is implemented for the oncomatrix and gene expression

## 2.40.3

Fixes:
- Matrix must skip data processing steps after detecting stale action, to avoid confusing rerenders   

## 2.40.2

Fixes:
- Fix OncoMatrix and hierCluster brushing and list samples issue
- refresh the case count when there is no matching oncomatrix data
- pass opts.hierCluster in the launcher to handle create cohort
- hide the svg on error or matching data
- darken table2col row titles to meet Section 508 contrast requirements
- do not show the option to replace a gene expression/hierCluster term


## 2.40.1

Fixes:
- Return a defined adjusted state for the GDC matrix and gene expression tools, so that the undo/redo component can react
- Increase the contrast of the table header text in the BAM files and variants list
- Fix the geneFilter handling in the gdc tool launchers


## 2.40.0

Features:
- Hi-C whole genome view supports different matrix types (e.g. observed, expected, etc.). Users can select different matrix types from dropdown.
- The Hi-C whole genome view now calculates the cutoff on load and with user changes. Previously, the default was 5000.

Fixes:
- GDC bam slicing UI can still pull BAM files when experimental_strategy=Methylation Array filtering is used
- support navigation-by-keyboard of bam UI elements
- fix the display of no data error message and hiding of previously rendered heatmap in the hier cluster app
- For hierCluster, set left dendrogram position based on max gene label length, ignore variable labels.
- ignore the computed twlst of the hierCluster term group when tracking recoverable state
- Do not modify the hierCluster term group lst with server data, to avoid unnecessary state tracking and to prevent unwanted geneset edits
- Use the geneset edit UI when there is no initial computed geneset for hierCluster


## 2.39.6

Fixes:
- Do not show the "Edit" option when clicking a gene row label in matrix
- detect and handle race conditions in the matrix and hiercluster server data requests


## 2.39.5

Fixes:
- Use graphql query to replace /analysis/top_mutated_genes_by_project in GDC OncoMatrix
- Ensure that an embedder loading overlay gets triggered using the app callbacks.preDispatch option

## 2.39.4

Fixes:
- GDC bam slicing UI bug fix to forget previous coordinate input box search result
- Always trigger the closing of an embedder's loading overlay, even when there are no chart state changes
- Block track menu will not allow to hide a GDC bam tk, and no longer shows delete button for custom tracks


## 2.39.3

Fixes:
- Supply the missing api reference when launching a gdc matrix
- Option to override the matrix default of not rendering samples that are not annotated for any dictionary term, for more intuitive behavior in gene-centric use-cases
- Matrix should update when the filter0 changes while the geneset edit UI is displayed
- Ensure that the zoom controls has valid dimensions on update, in case it was initially rendered in an invisible div

DevOps:
- Detect unreleased notes in the CHANGELOG, in addition to the release.txt


## 2.39.2

Fixes:
- Detect empty hits before trying to render bam variants
- Reenable the handling of genome-level termdbs in the migrated server route
- Display an initial geneset edit UI when the GDC default matrix genes is empty
- Exclude embedder state in the standalone recover tracked state, for the matrix and hier cluster undo/redo


## 2.39.1

Fixes:
- Disable the term group menu for hierCluster gene expression term group, and remove the 'edit' and 'sort' options for other hier cluster term groups
- Fix the navigation of matrix and gene expression controls by keyboard


## 2.39.0

Features:
- GDC cohort-MAF tool: allow to customize output file columns
- Clicking matrix cell to show similar info table as hovering over the matrix cell.
- Mds3 track uses simpler radio buttons to toggle between view modes such as lollipop and occurrence

Fixes:
- Gene exp clustering will display an alert msg to inform user that a map is not doable when there is just one gene
- display total number of mutations on disco plot
- Fix oncomatrix error: adding dictionary term from row group menu
- Numeric termsetting edit UI allows a term to be default with custom bin config and will not switch to regular binning


## 2.38.1

Fixes:
- for hierCluster, nodejs always transform to zscore; use scaleLinear for improved heatmap rendering
- Fix the handling of multi-valued samples and group overlaps
- GDC gene exp clustering bug fix on querying data for dictionary variables and leads to speeding up


## 2.38.0

Features:
- Always show a menu after brushing matrix: Zoom in, List samples, and Add to a group/create cohort.

Fixes:
- Add clang missing dependency
- Fixed issues showing variable definition with termsetting instance, especially in chart edit menu.
- GDC OncoMatrix: use a more human-readable case ID as label instead of the UUID
- Fix the samplelst filter editor and auto-update of the pill label


## 2.37.0

Features:
- custom colors can now be assigned to custom groups

Fixes:
- Show a message about loading top gene in GDC hierCluster app


## 2.36.0

Features:
- show # of samples and add link for samples for dendrogram list sample menu option

Fixes:
- do not re-parse the already parsed result from cachedFetch
- Detect failure on GDC data caching and abort launch
- fix hierCluster gene dendrogram misaligned upon panning


## 2.35.1

Fixes:
- fix the toFixed error that randomly occurs when zoom on matrix.


## 2.35.0

Features:
- Click dendrogram to highlight sub-branches, zoom in and select cases underneath

Fixes:
- topVariablyExpressedGenes is changed from a GDC-specific route to general purpose route. Awaiting further work for non-gdc dataset


## 2.34.1

Fixes:
- GDC BAM slicing UI will reject non-BAM files.
- GDC BAM slicing UI now works with submitter or UUID of samples and aliquots, in addition to cases
- GDC BAM slicing UI shares a common route to retrieve ssm by case, reducing code duplication


## 2.34.0

Features:
- Disco plot UI now allows users to upload tab delimited data

Fixes:
- Use a urlTemplates.gene.defaultText option to make a gene external link more intuitive
- Allow ssm url to be supplied from both snvindel query and termdb, so termdb-less clinvar is able to link to ClinVar portal
- Hardcoded normalization methods replaced with values encoded in Hi-C files.
- Disco plot now detects and reports data issues from user submitted data.
- Gdc bam slice download handles case with no ssm; bam table changes to radio to force single-selection; table.js bug fix to use unique input name
- Fix the processing of hierCluster overrides


## 2.33.1

Fixes:
- Use a urlTemplates.gene.defaultText option to make a gene external link more intuitive

## 2.33.0

Features:
- GDC BAM slicing UI supports new "download mode", will directly download BAM slice to client, including unmapped reads.
- Click matrix cell to launch gene summary and case summary page, click row label to launch gene summary page, click case id to launch case summary


## 2.32.1

Fixes:
- Bug fix to allow mds3 track variant download to work again


## 2.32.0

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
