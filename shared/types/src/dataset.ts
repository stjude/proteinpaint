import type { Mclass } from './Mclass.ts'
import type { WSImage } from './routes/samplewsimages.ts'
import type { WSISample } from './routes/wsisamples.ts'

/*** General usage types ***/
type FileObj = {
	file: string
}

type KeyVal = {
	k: string
	v?: string
}

type KeyLabel = {
	key: string
	label: string
}

/** a set of categories about a vcf INFO field */
export type InfoFieldCategories = {
	/** category key from an INFO field of a vcf file */
	[index: string]: {
		/** Color used for rendering labels and backgrounds in the legend, tables, etc. */
		color: string
		/** Human readable label */
		label?: string
		/** Shown in the legend on label click */
		desc: string
		/** When .color is used as the background, denoted whether
		 * to use 'white', 'black', or other color for the text */
		textcolor?: string
	}
}

type NumericFilterEntry = {
	/** '<' or '>' for filtering */
	side: string
	/** value for filtering */
	value: number
}

type AFEntry = {
	/** human readable label */
	name: string
	/**  */
	locusinfo: {
		/** usually the data dictionary value  (e.g. AF_EXAC for ExAC frequency) */
		key: string
	}
	/** key/values for filtering */
	numericfilter: NumericFilterEntry[]
}

/** Specific allele freq info for ClinVar */
export type ClinvarAF = {
	[index: string]: AFEntry
}

/*** types supporting Queries type ***/

type InfoFieldEntry = {
	/** Human readable name to display */
	name: string
	/** vcf INFO field */
	key: string
	/** a set of categories about a vcf INFO field */
	categories?: InfoFieldCategories
	/** seperator (e.g. '&', '|' ) between join values */
	separator?: string
}

/*
type GenomicPositionEntry = {
                chr: string
                start: number
                stop: number
}
*/

type bcfMafFile = {
	/** bcf file for only variants, no samples and FORMAT */
	bcffile: string
	/** maf file for sample mutations. bcf header contents with FORMAT and list of samples are
	 * copied into this maf as headers followed by the maf header starting with #chr, pos, ref,
	 * alt and sample. Each column after sample corresponds to the information in FORMAT. file
	 * is bgzipped and tabix indexed (tabix -c"#" -s 1 -b 2 -e 2 <maf.gz>) */
	maffile: string
}

type SnvindelByIsoform = {
	/** if true, served from gdc. no other parameters */
	gdcapi?: true
	/** getter function to retrieve data. dynamically added or ds-supplied
	first argument is required and allow for 2 additional ones
	*/
	get?: (f: any, f2?: any, f3?: any) => void
	/** if true, all tw from one client query must be processed via one call to snvindel.byisoform.get()
	and no longer processes each tw by calling mayGetGeneVariantData()
	*/
	processTwsInOneQuery?: true
}

type SnvindelByRange = {
	/** if true, served from gdc. no other parameters */
	gdcapi?: true
	//local ds can have following different setup
	/** one single bcf file */
	bcffile?: string
	/** one bcf file per chr
	after loading, this is transformed into byrange._tk.chr2files{}, and deleted!
	*/
	chr2bcffile?: {
		/** index is the chr (e.g. 'chr1', 'chr2', etc.)
		 * value is the bcf file path */
		[index: string]: string
	}
	/** bcf+maf combined */
	bcfMafFile?: bcfMafFile
	/** allow to apply special configurations to certain INFO fields of the bcf file */
	infoFields?: InfoFieldEntry[]
	/** getter function to retrieve data. dynamically added or ds-supplied */
	get?: (f: any) => void
}

type URLEntry = {
	/** base URL, including the host and possibly other queries */
	base?: string
	key?: string
	namekey?: string
	label?: string
	url?: string
}

type SkewerRim = {
	/** only enabled for 'format' */
	type: string
	/** 'origin' */
	formatKey: string
	/** 'somatic' or 'germline', generally germline */
	rim1value: string
	/** 'somatic' or 'germline', generally somatic */
	noRimValue: string
}

type GdcApi = {
	/** Represents the configuration for accessing the GDC API. */
	gdcapi?: boolean
}

type SnvIndelFormat = {
	[index: string]: {
		/* has value for a non-GT field indicating the variant 
        is annotated to this sample*/
		ID: string
		Description: string
		/** 'R' or 1. do not parse values here based on Number="R"
        as we don't need to compute on the format values on backend
        client will parse the values for display */
		Number: string | number
		Type: string
	}
}

type FilterValues = {
	[index: string | number]: {
		key?: string | number
		label: string
	}
}

type RangesEntry = {
	start: number
	startinclusive: boolean
	stopunbounded: boolean
}

type BaseTvsFilter = {
	isnot?: boolean
	ranges?: RangesEntry[]
}

type TvsFilter = BaseTvsFilter & {
	values?: (string | number | { label: string })[]
}

export type FilterTermEntry = BaseTvsFilter & {
	id: string
	name: string
	type: string
	parent_id: string | null
	isleaf: boolean
	values?: FilterValues
	tvs?: TvsFilter
	min?: number
	max?: number
}

type FilterLstTvs = BaseTvsFilter & {
	term: FilterTermEntry
	values: (string | number | FilterValues)[]
}

type FilterLstEntry = {
	type: string
	tvs: FilterLstTvs
}

type Filter = {
	type: string
	join: string
	in: boolean
	lst?: FilterLstEntry[]
}

type VariantFilter = {
	opts: { joinWith: string[] }
	filter?: Filter
	terms: FilterTermEntry[]
}

/** one set of AC and AN info fields to retrieve data for this population */
type PopulationINFOset = {
	/** optional term id for retrieving admix coefficient for an ancestry corresponding to this "PopulationINFOset" entry
	for every sample carrying a variant.
	this is required when sets[].length>1
	this should not be set when sets[].length=1 */
	key?: string
	/** required info field */
	infokey_AC: string
	/** required info field */
	infokey_AN: string
}

/* define method to retrieve allele AC/AN in a population, by using bcf INFO fields; population could be ancestry-stratified
two types of population are supported:
- ancestry-stratified
  allowto_adjust_race can be set to true
  sets[] has >1 elements
- not stratified
  allowto_adjust_race cannot be set to true
  sets[] has only 1 element
*/
type Population = {
	/** for identifying this element */
	key: string
	/** display, in fact it can replace key since label should also be unique*/
	label: string
	/** allow to set to true for race-stratified population, will adjust population AC/AN values based on admix coefficient for the dataset's cohort variants
	 * supposed to be "read-only" attribute and not modifiable in runtime */
	allowto_adjust_race?: boolean
	/** when above is true, this flag is flip switch for this adjustion */
	adjust_race?: boolean
	/** if AC/AN of the population is ancestry-stratified, will be multiple elements of this array; otherwise just one */
	sets: PopulationINFOset[]
}

/** primarily for prebuilding germline genetic association for survivorship portal
part of state of genomeBrowser plot
allowing for user modification
*/
type SnvindelComputeDetails = {
	/** in each element, type corresponds to same key in groups[]
	used for rendering choices in group data types; but content is read-only and should not be part of state
	*/
	groupTypes: {
		type: string
		name: string
	}[]
	/** a type of computing decides numeric values for each variant displayed in tk
    computing type is also determined by number of groups
    if only 1 group:
         type=info: use numeric info field
         type=filter: use AF
         type=population: use AF
    if there're two groups:
         both types are "filter": allow AF diff or fisher
         "filter" and "population": allow AF diff or fisher
         else: value difference
	*/
	groups: (SnvindelComputeGroup_filter | SnvindelComputeGroup_population | SnvindelComputeGroup_info)[]
	/** define lists of group-comparison methods to compute one numerical value per variant
	 */
	groupTestMethods: {
		/** method name. used both for display and identifier. cannot supply hardcoded values here as breaks tsc */
		name: string
		/** optional custom text to put on mds3 tk y axis */
		axisLabel?: string
	}[]
	/** array index of groupTestMethods[] */
	groupTestMethodsIdx: number
}
/** supplies a pp filter (or filter by cohort) to restrict to a subset of samples from which to compute AF for each variant.
the filter will be user-modifiable
*/
type SnvindelComputeGroup_filter = {
	// FIXME type value can only be 'filter' but breaks tsc
	type: string //'filter'
	/** a given filter applied to all cohorts */
	//filter?: object
	/** filter per cohort. use either filter or filterByCohort */
	filterByCohort?: { [key: string]: object }
}
/** a choice from snvindel.populations[]
 */
type SnvindelComputeGroup_population = {
	type: string //'population'
	/** used to identify corresponding population element */
	key: string
	/** redundant, should be copied over from snvindel.populations[] */
	label: string
	/** if true, can adjust race. may copy over instead of duplicating? */
	allowto_adjust_race: boolean
	/** if true, race adjustion is being applied */
	adjust_race: boolean
}
type SnvindelComputeGroup_info = {
	type: string //'info'
	/** numerical INFO field name from bcf, allows to retrieve numeric values for each variant in tk */
	infoKey: string
}

/** a data type under ds.queries{} */
type SnvIndelQuery = {
	forTrack?: boolean
	/** allow to query data by either isoform or range; either or both can be used; cannot be both missing */
	byisoform?: SnvindelByIsoform
	/** query data by range */
	byrange?: SnvindelByRange

	infoUrl?: URLEntry[]
	skewerRim?: SkewerRim
	format4filters?: string[]
	format?: SnvIndelFormat
	variant_filter?: VariantFilter
	populations?: Population[]
	/** NOTE **
this definition can appear either in queries.snvindel{} or termdb{}
so that it can work for a termdb-less ds, e.g. clinvar, where termdbConfig cannot be made */
	ssmUrl?: UrlTemplateSsm
	m2csq?: {
		gdcapi?: boolean
		by: string
	}
	allowSNPs?: boolean
	vcfid4skewerName?: boolean
	/** config on computing variant data and show as a custom mds3 tk */
	details?: SnvindelComputeDetails
	/** set to true to show mds3 tk by default when the ds have other genome browser track types besides this snvindel tk
	if ds has only snvindel tk, then the tk will always be shown and no need to set this
	*/
	shown?: boolean
}

type SvFusion = {
	byrange?: {
		/** gz BED file path for sv fusion data: chr \t start \t stop \t {}
		will only contain events with coordinates in both breakpoints
		TODO use string sample name
		*/
		file?: string
	}
	byname?: {
		/** file paths for sv fusion TXT data. will contain events lacking breakpoint coordinates and can only be matched by gene names
		should be tab seperated values with the following fields: (should leave as blank for values unknown)
		gene_a	refseq_a	chr_a	position_a	strand_a	gene_b	refseq_b	chr_b	position_b	strand_b	origin	sample_name	fusion_gene	event_type(fusion or sv)
		TODO use string sample name
		*/
		file?: string
	}
}

type SingleSampleMutationQuery = {
	src: 'native' | 'gdcapi' | string
	/** which property of client mutation object to retrieve sample identifier for
	 * querying single sample data with */
	sample_id_key: string
	/** only required for src=native */
	folder?: string
	/** disco plot will be launched when singleSampleMutation is enabled. supply customization options here */
	discoPlot?: {
		/** if true, disco plot will hide chrM, due to reason e.g. this dataset doesn't have data on chrM */
		skipChrM?: true
		/** if true, filter mutations by predefined geneset by default */
		prioritizeGeneLabelsByGeneSets?: true
	}
}

type NIdataQuery = {
	/** Reference obj for NI data query. */
	Ref1: NIdataQueryRef
}

type NIdataQueryRef = {
	/** file path for the reference file */
	referenceFile: string
	/** file path for the sample file */
	samples: string
	/** Parameters for slice indices in the mass brain imaging plot */
	parameters?: NIdataQueryRefParams
	/** optional terms to show as table columns and annotate samples */
	sampleColumns?: { termid: string }[]
}

type NIdataQueryRefParams = {
	/** index of slice for default sagittal plane */
	l: number
	/** index of slice for default coronal plane */
	f: number
	/** index of slice for default axial plane */
	t: number
}

/** used for the gene set edit ui */
export type GeneArgumentEntry = {
	/** Dom element id
	 * Use the cooresponding parameter name as the id
	 */
	id: string
	/** label/prompt for the checkbox, input, etc. */
	label: string
	/** Optional: Creates subtext below the main label */
	sublabel?: string
	/** 'boolean' has two options.
	 * 	- If .options[] is provided, it creates a 'submenu', a checkbox
	 * 		that expands to show additional inputs when checked. .options[]
	 * 		in this case is GeneArgumentEntry[]
	 *  - If !.options[] is provided, it creates a checkbox
	 * 'string' creates a checked checkbox if a .value is provided
	 * 'number' creates a text number input
	 * 'radio' creates a radio buttons, see options[] */
	type: 'boolean' | 'string' | 'number' | 'radio'
	/** value of the input or checkbox
	 * required if type is string. Otherwise, optional
	 */
	value?:
		| string
		| boolean
		| number
		| {
				type: string
				value: string[] | null
		  }
	options?: {
		/** Type of dom element to render underneath the radio
		 * 'text': creates a text area input
		 * 'tree': launches termdb app and the tree
		 * 'boolean': No element is created
		 *
		 * boolean is the default type
		 */
		type: 'text' | 'tree' | 'boolean' | string
		/** value used to construct the server argument
		 * also the element id in the gene set edit ui
		 */
		value: number | string
		/** radio label */
		label: string
		/** Optional: smaller text that appears underneath the label */
		sublabel?: string
	}[]
}

type TopVariablyExpressedGenesQuery = {
	/** Denotes either gdc specific data requests or common
	 * data request processing */
	src: 'gdcapi' | 'native' | string
	/** Specifies the dom element rendered in the menu */
	arguments?: GeneArgumentEntry[]
}

type TopMutatedGenes = {
	/** ds supplied getter. if not, dynamically adds one during launch */
	get?: (f: any) => void
	/** Specifies the dom element rendered in the menu */
	arguments?: GeneArgumentEntry[]
}

/** setup for a set of genome browser tracks and/or facet tables, that can be selected for genomebrowser display
 */
type TrackLst = {
	/** path to legacy json file containing a long array of 1 or more facets

	[
	  {
         "isfacet": true,
         "name": "PEDDEP Prepilot",
         "tracks": [
		   {
		     name:str // required. used as *identifer* for a track
			 sample:str // required. should match with a sample in db!
			 assay:str // required. free string not controlled in dictionary yet. if missing the track won't appear in facet table
			 type:str // properties inherent for each custom track
			 file:str
		   },
		   ... more tk
		 ]
	  },
	  { ... 2nd facet table }
	]

	*/
	jsonFile: string

	/*
	alternative format that's easier to maintain than a giant json file
	facetFiles:[
		{
			// name of this facet table
			name: str
			// a tabular file with columns "tkname/assay/sample/path/json"; last column json provides any customization for a track
			// e.g. "Track 1 \t h3k4me3 \t sample1 \t path/to/file.bw \t {"scale":{..}}"
			tabFile: string
		}
	]
	*/

	/** list of track names to show by default, should be found in json file
	in json content above, allow a name to be shared by multiple tracks!
	in such case, all tracks identified by given name will show/hide altogether
	*/
	activeTracks: string[]
}

/** cnv segments are queried by coordinates, and can be filtered by segment length and/or value
configs for types of cnv data

- log(ratio)
	{
		cnvMaxLength:10000000
		cnvGainCutoff:5
		cnvLossCutoff:-5
	}
- copy number
	{
		cnvMaxLength:1000000
		cnvMaxCopynumber:10
		cnvMinCopynumber:1
	}
- qualitative categories
	{
		cnvMaxLength?:? // abscent if ds doesn't allow filtering by max length (e.g. segments are actually gene bodies)
		//cnvCategories:['CNV_amp', 'CNV_loss'] // "CNV_amplification" and "CNV_homozygous_deletion" are optional depending on ds
	}
	may not need to declare cnvCategories[];
	cnv edit ui rendering can be entirely based on actual server-returned gene cnv data
	e.g. if CNV_amplification is present from getCategories() or cnv data, show its checkbox, otherwise do not show checkbox

important: presence of filtering properties indiate the type of cnv quantification
and will trigger rendering of ui controls
*/
type CnvSegmentQuery = {
	/** ds supplied or dynamically added getter
	todo properly type input/output
	returns:
		{
			cnvs:[]
				{ chr, start, stop, value?, class, samples[], occurrence=1, ssm_id }
			cnvMsg:string
		}
	*/
	get?: (q: any) => any
	/** either file or get is required. file is bgzipped with columns:
	1. chr
	2. start, 0-based
	3. stop
	4. {"dt": 4, "mattr": {"origin": "somatic"}, "sample": "3332", "value": -1.0}
	   "value" can be logratio (minus/positive number), copy number (non-negative integer), or qualitative call (gain/loss)
	*/
	file?: string

	/****** rendering parameters ****
	not used as query parameter to filter segments
	value range for color scaling. default to 5. cnv segment value>this will use solid color
	*/
	absoluteValueRenderMax?: number
	gainColor?: string
	lossColor?: string

	/** filter segments by max length to restrict to focal events;
	samples with all events filtered out should be treated as wildtype
	set to -1 to show all as a convenient solution, thus no need for UI to show a checkbox for filterbylength or not
	allow to be missing, in such case will always show all */
	cnvMaxLength?: number

	/// quick fix: following sets of properties are mutually exclusive. TODO may improve with "type" property

	/** presence of these properties indicate cnv is quantified as log(ratio) or similar
	filter segments by following two cutoffs only apply to log ratio, cnv gain value is positive, cnv loss value is negative
	samples with all events filtered out should be treated as wildtype

	- if m.value>0, skip m if m.value<this cutoff
	- set to 0 to not filtering and show all gain events
	- set to a large value e.g. 99 to hide all gain events
	*/
	cnvGainCutoff?: number
	/*
	- if m.value<0, skip m if m.value>this cutoff
	- set to 0 to not filtering and show all loss events
	- set to a large negative value e.g. -99 to hide all loss events
	*/
	cnvLossCutoff?: number

	/** presence of these properties indicate cnv is quantified as integer copy number
	* not in use yet *
	enable when there's such data
	cnvMinCopynumber?: number
	cnvMaxCopynumber?: number
	 */

	/** quick fix for gdc cnv tool:
	if not set, mds3 tk & matrix will load cnv segments and show them together with ssm & fusion
	if set: 
		- for mds3 tk loading via mds3.load.js, only when tk.hardcodeCnvOnly=true, this will be loaded and shown
		- for others using mayGetGeneVariantData(), this is always disabled, as request won't have this flag
	*/
	requiresHardcodeCnvOnlyFlag?: true

	/** CNV cutoffs (such as cnvGainCutoff, cnvLossCutoff, cnvMaxLength) that are applied to specific genes */
	cnvCutoffsByGene?: {
		[geneName: string]: {
			[key: string]: any
		}
	}

	/** in mds3 tk view and gdc cnv tool, when number of segments from view region exceeds this cutoff, it's piled up into density view to speed up
	overrides default 1000
	this cutoff does not apply to other uses beyond mds3 tk, including matrix and geneVariant
	*/
	densityViewCutoff?: number

	/** this cutoff is applied in ds.queries.cnv.get(), in that up to this number of segments will be returned
	overrides default 10k
	this applies to matrix, geneVariant, and mds3 tk
	todo there lacks a way for getter to message downstream code of exceeding limit
	*/
	maxReturnCutoff?: number
}

/*
no longer used!!
file content is a probe-by-sample matrix, values are signals
for a given region, the median signal from probes in the region is used to make a gain/loss call for each sample
this is alternative to CnvSegmentQuery

type Probe2Cnv = {
                file: string
}
*/

type RnaseqGeneCount = {
	/** Name of the HDF5 file */
	file: string
	samplesFile?: string
	/** Storage_type for storing data (HDF5) */
	storage_type: 'HDF5'
}

/** the metabolite query */
export type MetaboliteIntensityQueryNative = {
	src: 'native' | string
	file: string
	samples?: number[]
	/** _metabolites,used to dynamically built cache of metabolite names to speed up search */
	_metabolites?: string[]
	get?: (param: any) => void
	find?: (param: string[]) => void
	metaboliteIntensity2bins?: { [index: string]: any }
}

export type MetaboliteIntensityQuery = MetaboliteIntensityQueryNative

/** the geneExpression query */
export type GeneExpressionQueryGdc = {
	src: 'gdcapi'
	geneExpression2bins?: { [index: string]: any }
}

export type GeneExpressionQueryNative = {
	src: 'native'
	/** bgzip-compressed, tabix-index file.
	first line must be "#chr \t start \t stop \t gene \t sample1 \t ..." */
	file: string
	/** dynamically added during server launch, list of sample integer IDs from file */
	samples?: number[]
	/** dynamically added flag during launch */
	nochr?: boolean
	/** dynamically added getter */
	get?: (param: any) => void
	/** This dictionary is used to store/cache the default bins calculated for a geneExpression term when initialized in the fillTermWrapper */
	geneExpression2bins?: { [index: string]: any }
}

export type GeneExpressionQuery = GeneExpressionQueryGdc | GeneExpressionQueryNative

export type SingleCellGeneExpressionNative = {
	src: 'native'
	/** path to HDF5 files. for now only HDF5 is supported.
	each is a gene-by-cell matrix for a sample, with ".h5" suffix. missing files are detected and handled */
	folder: string
	/** dynamically added getter */
	get?: (q: any) => any
	/** cached gene exp bins */
	sample2gene2expressionBins?: { [sample: string]: { [gene: string]: any } }
}

export type SingleCellGeneExpressionGdc = {
	src: 'gdcapi'
}

export type SingleCellSamples = {
	/** if missing refer to the samples as 'sample', this provides override e.g. 'case' */
	/** logic to decide sample table columns (the one shown on singlecell app ui, displaying a table of samples with sc data)
	a sample table will always have a sample column, to show sample.sample value
	- use uiLabels.Sample to customize the name of the first column
	- the other two properties allow to declare additional columns to be shown in table, that are for display only
	when sample.experiments[] are used, a last column of experiment id will be auto added
	*/
	/** any columns to be added to sample table. each is a term id */
	sampleColumns?: { termid: string }[]
	/** used on client but not on ds */
	experimentColumns?: { label: string }[]
	/** getter function to return list of samples with single-cell data
	is either ds-supplied, to enclose ds-specific query details (gdc)
	or is missing, to be added at launch with built-in logic (samples are found by looking through singleCell.data.plots[].folder)
	*/
	get?: (q: any) => any
	/** extra label to show along with sample, must be a term id as in sampleColumns[] and allow to retrieve value from sample object */
	extraSampleTabLabel?: string
}

export type SingleCellDataGdc = {
	src: 'gdcapi'
	sameLegend: boolean
	get?: (q: any) => any
	refName?: string
	plots: GDCSingleCellPlot[]
	settings?: { [key: string]: string }
}

export type SingleCellDEgeneGdc = {
	src: 'gdcapi'
	/** Column name.
this must be the colorColumn from one of the plots. so that at the client app, as soon as the plot data have been loaded and maps rendered, client will find out the cell groups based on this columnName value, and show a drop down of these groups on UI. user selects a group, and pass it as request body to backend to get DE genes for this group
*/
	columnName: string
}

type GDCSingleCellPlot = {
	name: string
	colorColumns: ColorColumn[]
	coordsColumns: { x: number; y: number }
	/** if true the plot is shown by default. otherwise hidden */
	selected?: boolean
}

type ColorColumn = {
	/** 0-based column number in the tabular file */
	index?: number
	/** name of the column */
	name: string
	/** column values (categories) to color mapping */
	colorMap?: { [index: string]: string }
	aliases?: { [index: string]: string }
}

/** defines a tsne type of plot for cells from one sample */
type SingleCellPlot = {
	/** type of the plot, e.g. tsne or umap, also display as plot name on ui */
	name: string
	/** folder in which per-sample files are stored.
each file is a tabular text file with all cells (rows) from that sample.
all files must have same set of columns
file columns include cell types and x/y coords, as described by other parameters
*/
	folder: string
	/** optional suffix to locate the file for a sample, via ${folder}/${sampleName}${fileSuffix}
assumes that file name always start with sample name.
if not introduce filePrefix
*/
	fileSuffix?: string
	/** list of columns in tabular text file that define cell categories and can be used to color the cells in the plot. must have categorical values
	 */
	colorColumns: ColorColumn[]
	/** 0-based column number for x/y coordinate for this plot */
	coordsColumns: { x: number; y: number }
	/** if true the plot is shown by default. otherwise hidden */
	selected?: boolean
}
export type SingleCellDataNative = {
	src: 'native'
	/** when a sample has multiple tsne plots, this flag allows allows all plots to share one cell type legend */
	sameLegend: boolean
	/** available tsne type of plots for each sample */
	plots: SingleCellPlot[]
	/** name of ref cells? */
	refName?: string
	/** dynamically added getter */
	get?: (q: any) => any
	/** width and height of the plots */

	settings?: { [key: string]: any }
}

export type SingleCellQuery = {
	/** methods to identify samples with singlecell data,
	this data allows client-side to display a table with these samples for user to choose from
	also, sampleView uses this to determine if to invoke the sc plot for a sample
	*/
	samples: SingleCellSamples
	/** defines tsne/umap type of clustering maps for each sample
	 */
	data: SingleCellDataGdc | SingleCellDataNative
	/** defines available gene-level expression values for each cell of each sample */
	geneExpression?: SingleCellGeneExpressionGdc | SingleCellGeneExpressionNative
	/** Precomputed top differentialy expressed genes for a cell cluster, against rest of cells */
	DEgenes?: SingleCellDEgeneGdc
	/** supplies per-sample images. will create a new tab on the ui. one image per sample */
	images?: SCImages
}

type SCImages = {
	/** folder where the per-sample image files are stored, as "SCImages/<folder>/<sample>/<fileName>" */
	folder: string
	/** see above */
	fileName: string
	/**Used to name the image tab in the single cell plot */
	label: string
}

/** genome browser LD track */
type LdQuery = {
	/** each track obj defines a ld track */
	tracks: {
		/** for displaying and identifying a track. must not duplicate */
		name: string
		/** relative path of ld .gz file */
		file: string
		/** dynamically added */
		nochr?: boolean
		/** if to show by default */
		shown: boolean
		/** max range allowed to show data */
		viewrangelimit: number
	}[]
	/** color scale when LD is used to overlay on variants of a locus  */
	overlay: {
		/** color for r2 value 1 */
		color_1: string
		/** Color for r2 value 0 */
		color_0: string
	}
}

/** one more multiple sets of genome-wide plots per sample, e.g. dna meth probe beta values. the plot has a Y axis and shows all chromosomes. each key is one set of such plot. there could be multiple sets */
type SingleSampleGenomeQuantification = {
	[index: string]: {
		/** description of this data */
		description: string
		/** min value of Y axis */
		min: number
		/** max value of Y axis */
		max: number
		sample_id_key: string
		/** folder path of data files per sample */
		folder: string
		/** plot color for positive values */
		positiveColor: string
		/** plot color for negative values */
		negativeColor: string
		/** optionally, link the plot to singleSampleGbtk, in that clicking on the plot will luanch a detailed block view defined by singleSampleGbtk */
		singleSampleGbtk?: string
	}
}

/** single sample genome browser track. each key corresponds to one track. currently hardcoded to "<sampleId>.gz" bedgraph files in the folder  */
type SingleSampleGbtk = {
	[index: string]: {
		/** description of this data */
		description: string
		/** min value of Y axis */
		min: number
		/** max value of Y axis */
		max: number
		/** */
		sample_id_key: string
		/** folder path of data files per sample */
		folder: string
	}
}

type Mds3Queries = {
	/** (gb=genomebrowser) controls gb chart button menu genesearchbox behavior, 
	add some additional options after a gene is found, and mode of gb launched from the menu

	- "protein":
		genesearchbox only allow searching gene and not coord
		launched gb goes into protein-mode
		this is used for ds with only coding mutations over some protein-coding genes, and only want to show protein view for such
	- "genomic":
		searching either gene/coord will result in coord
		gb will always be in genomic mode
		this is used for ds with genome-wide variants only shown in genomic views, but not protein view
	- none:
		meaning gb can be shown in either protein or genomic mode
		when searching coord, gb goes into genomic mode
		when searching gene, show an option in chart btn menu to select protein or genomic view
	*/
	gbRestrictMode?: 'protein' | 'genomic'
	snvindel?: SnvIndelQuery
	svfusion?: SvFusion
	cnv?: CnvSegmentQuery
	/** gene-level cnv, only available on gdc; query by gene symbol, ds must define getter
	 */
	geneCnv?: {
		bygene: {
			get: (q: any) => any
		}
	}
	trackLst?: TrackLst
	ld?: LdQuery
	defaultCoord?: string
	singleSampleMutation?: SingleSampleMutationQuery
	NIdata?: NIdataQuery
	geneExpression?: GeneExpressionQuery
	rnaseqGeneCount?: RnaseqGeneCount
	/** Used to create the top mutated genes UI in the gene
	 * set edit ui and data requests. */
	topMutatedGenes?: TopMutatedGenes
	/** Used to create the top variably expressed UI in the gene
	 * set edit ui. Also used for data requests */
	topVariablyExpressedGenes?: TopVariablyExpressedGenesQuery
	metaboliteIntensity?: {
		src: 'native' | 'gdc'
		file: string
	}
	singleCell?: SingleCellQuery
	singleSampleGenomeQuantification?: SingleSampleGenomeQuantification
	singleSampleGbtk?: SingleSampleGbtk
	/** depreciated. replaced by WSImages */
	DZImages?: DZImages
	WSImages?: WSImages
	images?: Images
}

/** non-zoom small images
iamge file to sample mapping is stored in images table
*/
type Images = {
	/** folder where the per-sample image files are stored */
	folder: string
}

/** Depreciated. deep zoom image shown via openseadragon, with precomputed tiles.
 * this is replaced by WSImages and should not be used anymore */
export type DZImages = {
	// type of the image, e.g. H&E
	type: string
	// path to the folder where sample images are stored
	imageBySampleFolder: string
}

/** deep zoom image shown via tiatoolbox, covers any big image files including whole-slide image. 
image file to sample mapping is stored in wsimages table
*/
export type WSImages = {
	// type of the image, e.g. H&E
	type: string

	/* path to the folder where sample images are stored
	required; for both cases where image files are hosted locally, or loaded from remote via ds-supplied getter
	*/
	imageBySampleFolder: string

	annotationsColor?: Array<number>

	/** either ds supplied or dynamically added on launch with built in logic (retrieve the sample list from the wsimages table) */
	getSamples?: () => Promise<Array<WSISample>>
	/** either ds supplied or dynamically added on launch with built in logic */
	getWSImages?: (sampleName: string) => Promise<WSImage[]>
	/**  ds supplied */
	getWSIAnnotations?: (sampleName: string, wsiImage: string) => Promise<string[]>
	/**  ds supplied */
	getZoomInPoints?: (sampleName: string, wsiImage: string) => Promise<Array<[number, number]>>
}

/*** types supporting Termdb ***/

type TermIds = {
	[index: string]: string
}

type SelectCohortValuesEntry = {
	keys: string[]
	label: string
	shortLabel: string
	isdefault?: boolean
	note?: string
}

export type SelectCohortEntry = {
	/** subcohort term in db. uses hardcoded type=multivalue */
	term: { id: string; type: string }
	/** Title above the cohort introduction/content in the about tab */
	title?: string
	/** Text above radio cohort options in the about tab. */
	prompt: string
	values: SelectCohortValuesEntry[]
	/** cohort-related static html shown in about tab */
	description?: string
	descriptionByCohort?: { [index: string]: string }
	/** If the description is dependent on the user's role, 
	define this callback to return description based on auth
	returns a static description
	*/
	descriptionByUser?: (auth: any) => string
	/** similar to descriptionByUser but returns an object with one description per cohort,
	about tab will switch description based on user-selected cohort
	*/
	descriptionByCohortBasedOnUserRole?: (auth: any) => object
	/** subtext shown at the very bottom of the cohort/about tab subheader */
	asterisk?: string
	//The profile has clearOnChange. The terms used in the plots are not always the same for the profile.
	//Therefore when switching cohorts, it is necessary to delete the plots opened and the global filter
	clearOnChange?: { [index: string]: boolean }
}

type MissingAccess = {
	message: string
	links: { [index: string]: string }
}

type DataDownloadCatch = {
	helpLink: string
	missingAccess: MissingAccess
	jwt: { [index: string]: string }
}

//Plots

type ScatterPlotsEntry = {
	name: string
	dimension: number
	file: string
	coordsColumns?: { x: number; y: number; z?: number }
	settings?: { [index: string]: any }
	/** by default the dots are called "samples" on the plot, use this to call it by diff name e.g. "cells" */
	sampleType?: string
	/** a termsetting to supply dot color */
	colorTW?: { id: string }
	/** a termsetting to supply dot shape */
	shapeTW?: { id: string } // TODO replace with tw type
	colorColumn?: ColorColumn
	/** provide a sampletype term to filter for specific type of samples for subjects with multiple samples and show in the plot.
e.g. to only show D samples from all patients
this is limited to only one term and doesn't allow switching between multiple terms
*/
	sampleCategory?: {
		/** categorical term like "sampleType" which describes types of multiple samples from the same subject */
		tw: { id: string }
		/** default category */
		defaultValue: string
		/** order of categories */
		order: string[]
	}
}

type Scatterplots = {
	plots: ScatterPlotsEntry[]
}
/** this plot compares correlation of one feature against a bunch of variables across samples
 */
type CorrelationVolcano = {
	/** fixed feature, is one numeric term */
	feature: {
		/** later expand to other types */
		termType: 'geneExpression'
	}
	/** list of numeric variables to be compared against fixed feature*/
	variables: {
		/** later can expand */
		type: 'dictionaryTerm'
		/** when type=dictionaryTerm, is array of numeric term ids */
		termIds?: string[]
	}
}

type UiLabels = {
	samples?: string
	sample?: string
	Samples?: string
	Sample?: string
	Mutations?: string
	Mutation?: string
}

type SurvPlotsEntry = {
	name: string
	serialtimekey: string
	iscensoredkey: string
	timelabel: string
}

type SurvPlots = {
	[index: string]: SurvPlotsEntry
}

type sampleGroupAttrLstEntry = { key: string }

type SurvivalPlot = {
	plots: SurvPlots
	samplegroupattrlst: sampleGroupAttrLstEntry[]
}

type TieBreakerFilterValuesEntry = {
	dt: number
}

type TieBreakerFilter = {
	values: TieBreakerFilterValuesEntry[]
}

type TieBreakersEntry = {
	by: string
	order?: (string | number)[]
	filter?: TieBreakerFilter
}

type SortPriorityEntry = {
	types: string[]
	tiebreakers: TieBreakersEntry[]
}

type SurvivalSettings = {
	/** The max time-to-event to be displayed in plot, hide all the samples with Time-to-Event longer than this maxTimeToEvent */
	maxTimeToEvent?: number
	/** The time unit (months, years, etc) displayed in the x-axis of survival plot */
	timeUnit?: string
	/** the customized x-axis tick values of survival plot */
	xTickValues?: number[]
}

type RegressionSettings = {
	/** Disclaimer message shown under the cofficient table when
	 * regression type is cox. */
	coxDisclaimer?: string
	/** disable interactions */
	disableInteractions?: boolean
	/** hide type III statistics table in results */
	hideType3?: boolean
	/** hide statistical tests table in results */
	hideTests?: boolean
}

type MatrixSettings = {
	maxSample?: number
	svgCanvasSwitch?: number
	cellEncoding?: string
	cellbg?: string
	controlLabels?: UiLabels
	sortSamplesBy?: string
	sortPriority?: SortPriorityEntry[]
	ignoreCnvValues?: boolean
	geneVariantCountSamplesSkipMclass?: string[]
	/** all the truncating mutations exist in the dataset */
	truncatingMutations?: string[]
	/** all the protein-changing mutations mutations exist in the dataset */
	proteinChangingMutations?: string[]
	/** all the mutation classes exist in the dataset */
	mutationClasses?: string[]
	/** all the CNV classes exist in the dataset */
	CNVClasses?: string[]
	/** all the synonymous mutations exist in the dataset */
	synonymousMutations?: string[]
	showHints?: string[]
	displayDictRowWithNoValues?: boolean
	/** allow to add two buttons (CNV and mutation) to control panel for selecting
	 * mclasses displayed on oncoMatrix */
	addMutationCNVButtons?: boolean
	/** this is now computed from sortPriority[x].tiebreakers.find(tb =>
	 * tb.filter?.values[0]?.dt === 1) ... */
	sortByMutation?: string
	/** this is now computed from sortPriority[x].tiebreakers.find(tb =>
	 * tb.filter?.values[0]?.dt === 4).isOrdered */
	sortByCNV?: boolean
	cnvUnit?: 'log2ratio' | 'segmedian'
	/** whether to show white cell border for SNVindel in oncoPrint mode */
	oncoPrintSNVindelCellBorder?: boolean
}

type NumericDictTermClusterSettings = {
	/** default hiercluster group name */
	termGroupName?: string
	zScoreTransformation?: boolean
	colorScale?: string
}

type Matrix = {
	/** alternative name, e.g. the plot is called "oncomatrix" in gdc; by default it's called "matrix" */
	appName?: string
	/** default settings for matrix plot */
	settings?: MatrixSettings
	/** matrix-specific mclass override? */
	mclass?: Mclass
	/** filter to hide entire legend group, e.g. hide all CNV */
	legendGrpFilter?: any
	/** filter to hide categories or mclass, e.g. hide male, hide MISSENSE */
	legendValueFilter?: any
	/** matrix criteria for a CNV alteration */
	cnvCutoffs?: any
}

// specific hierCluster type settings, should be named as "dataTYpe + Cluster"
type NumericDictTermCluster = {
	/** alternative name, e.g. the plot is called "drug sensitivity" in ALL-pharmacotyping; by default it's called "Numeric Dictionary Term cluster" */
	appName?: string
	/** default settings for numericDictTermCluster plot */
	settings?: NumericDictTermClusterSettings
	/** list of numeric term ids that will be excluded from the numeric dictionary term cluster, add to usecase.detail to exclude terms*/
	exclude?: string[]
	/** list of pre-built numericDictTermcluster plots */
	plots?: NumericDictTermClusterPlotsEntry[]
}

type Survival = {
	/** default settings for survival plot */
	settings?: SurvivalSettings
}

type Regression = {
	/** default settings for regression */
	settings?: RegressionSettings
}

type MatrixPlotsEntry = {
	name: string
	file: string
	settings?: {
		[key: string]: any
	}
	getConfig?: (f: any) => void
}

type NumericDictTermClusterPlotsEntry = {
	name: string
	file: string
	settings?: {
		[key: string]: any
	}
	/** helper function to get plot config from saved session file */
	getConfig?: (f: any) => void
}

type MatrixPlots = {
	plots: MatrixPlotsEntry[]
}

type AllowCaseDetails = {
	sample_id_key: string
	terms: string[]
}

type MultipleTestingCorrection = {
	method: string
	skipLowSampleSize: boolean
}

type TvsTerm = {
	id: string
	type: string
	name: string
}

type TvsValues = {
	key?: string
	label: string
}

type Tvs = {
	term: TvsTerm
	values: TvsValues[]
}

type RestrictAncestriesEntry = {
	name: string
	tvs: Tvs
	PCcount: number

	// TODO declare that either PCTermId or PCBySubcohort is required
	PCTermId?: string
	PCBySubcohort?: {
		[subcohortId: string]: any
	}
}

/*
base type for deriving new types with new attributes

*/
type UrlTemplateBase = {
	/** must end with '/' */
	base: string
	namekey: string
	defaultText?: string
}
export type UrlTemplateSsm = UrlTemplateBase & {
	/** to create separate link, but not directly on chr.pos.ref.alt string.
    name of link is determined by either namekey or linkText. former allows to retrieve a name per m that's different from chr.pos.xx */
	shownSeparately?: boolean
	/** optional name of link, if set, same name will be used for all links. e.g. "ClinVar".
if missing, name is value of m[url.namekey], as used in url itself (e.g. snp rsid) */
	linkText?: string
}

/*** type of ds.cohort.termdb{} ***/
type Termdb = {
	/** Terms */
	termIds?: TermIds
	/** if true, backend is allowed to send sample names to client in charts */
	displaySampleIds?: (clientAuthResult: any) => boolean
	converSampleIds?: boolean
	alwaysShowBranchTerms?: boolean
	minimumSampleAllowed4filter?: number
	minTimeSinceDx?: number
	timeUnit?: string
	ageEndOffset?: number
	cohortStartTimeMsg?: string
	alwaysRefillCategoricalTermValues?: boolean
	restrictAncestries?: RestrictAncestriesEntry[]
	/** Cohort specific */
	selectCohort?: SelectCohortEntry
	/* When a dataset uses login this property allows to configure the login logic */
	invalidTokenErrorHandling?: {
		//Affected charts contains the list of charts that require a login, if * is present, all charts require a login
		affectedCharts: string[]
		//Error message that will be displayed in the UI when the login fails or the token is invalid
		errorMessage: string
	}

	/** quick fix to convert category values from a term to lower cases for comparison (case insensitive comparison)
for gdc, graphql and rest apis return case-mismatching strings for the same category e.g. "Breast/breast"
keep this setting here for reason of:
- in mds3.gdc.js, when received all-lowercase values from graphql, it's hard to convert them to Title case for comparison
- mds3.variant2samples consider this setting, allows to handle other datasets of same issue
  */
	useLower?: boolean
	matrix?: Matrix
	numericDictTermCluster?: NumericDictTermCluster
	survival?: Survival
	regression?: Regression
	logscaleBase2?: boolean
	plotConfigByCohort?: PlotConfigByCohort
	/** Functionality */
	dataDownloadCatch?: DataDownloadCatch
	helpPages?: URLEntry[]
	multipleTestingCorrection?: MultipleTestingCorrection
	urlTemplates?: {
		/** gene link definition */
		gene?: UrlTemplateBase
		/** sample link definition */
		sample?: UrlTemplateBase
		/** ssm link definition */
		ssm?: UrlTemplateSsm | UrlTemplateSsm[]
		/** allow to add link to "Experiment" field of singlecell app sample table */
		scrnaExperimentId?: UrlTemplateBase
	}

	termtypeByCohort?: any // FIXME see below
	/** TODO not declared due to tsc err
	ds-defined or dynamically created. the array has an extra "nested" property
	only describes dictionary terms,
	non-dict terms are dynamically generated in getAllowedTermTypes() of termdb.config.ts based on query types
	termtypeByCohort?: {
		cohort: string
		termType: string
		termCount: number
	}[] & {
		nested: {
			[cohort: string]: {
				[termType: string]: number
			}
		}
	}
	*/

	/** ds defined add on to termtypeByCohort; note that this is not cohort-specific!
	this is combined with termtypeByCohort in getAllowedTermTypes()
	for now is used to support following types which lacks good way to auto generate them:

	- geneVariant
		for somatic events. works for snvindel/svfusion/cnv.
		since all these datatypes are optional, cannot define it in snvindel.termTypes which could be missing
		** must be defined via allowedTermTypes[] **

	- snp, snplst, snplocus
		for germline markers
	*/
	allowedTermTypes?: string[]

	/** ds-defined or dynamically created callbacks 
	{
		getSupportedChartTypes: (a: any) => any
	}
	*/
	q?: any
	termMatch2geneSet?: any
	mclass?: Mclass
	lollipop?: any
	hasAncestry?: boolean

	//GDC
	termid2totalsize2?: GdcApi
	dictionary?: GdcApi
	allowCaseDetails?: AllowCaseDetails
	isGeneSetTermdb?: boolean
	/** Searches the genedb alias list to return the genecode ID */
	getGeneAlias?: (q: any, tw: any) => { gencodeId: any }
	convertSampleId?: GdcApi
	hierCluster?: any

	/** ds customization of rules in TermTypeSelect on what term type to exclude for a usecase.
    used by gdc in that gene exp cannot be used for filtering
    note this applies to left-side term type tabs, but not terms in dict tree. latter is controlled by excludeTermtypeByTarget
    */
	useCasesExcluded?: {
		/** key is target name (todo restrict values), value is array of 1 or more term
		 * types (todo restrict values) */
		[useCaseTarget: string]: string[]
	}
	/** ds customization to rules in isUsableTerm(). this applies to what's showing in dict tree
	 */
	excludedTermtypeByTarget?: {
		/** key is usecase target (todo restrict). value is array of term type (todo restrict) */
		[useCaseTarget: string]: string[]
	}
	/** in development!
	 * Supports the About tab in mass UI
	 */
	hasSampleAncestry?: boolean
	sampleTypes?: SampleType[]

	tracks?: {
		/** allow color or shape changes in the lollipop */
		allowSkewerChanges: boolean
	}
	//* specify color map per module/group of terms. Used in the profile dataset.
	/** For example "National Context" is a profile module, that groups some multivalue terms for wich the category colors are the ones shown below: 
	 colorMap: {
				['*']: {
					['Not applicable for my role']: '#aaa',
					['Not Available/Do Not Know']: '#aaa',
					["I don't know"]: '#aaa',
					['Almost Never']: '#595959',
					['Infrequently']: '#747474',
					['No']: '#aaa'
				},
				['National Context']: {
					['Almost Always']: '#15557C',
					['Frequently']: '#1E77BB',
					['Sometimes']: '#2FA9F4',
					['Yes']: '#1E77BB'
				},
	}
	If the colors are the same for all the categories, use the wildcard '*' to define the color for all the modules.
	**/
	colorMap?: {
		/** colors for a category multivalues */
		[index: string]: { [index: string]: string }
	}
	//terms  are shown in the dictionary based on term and user role.
	isTermVisible?: (clientAuthResult: any, id: string) => boolean
}

type SampleType = {
	name: string
	plural_name: string
	parent_id: string
}

/** predefined configuration objects per subcohort per plot type */
type PlotConfigByCohort = {
	/** key is subcohort string */
	[index: string]: {
		/** key is plot type as in mass/charts.js */
		[key: string]: object
	}
}

/** modified version of termwrapper*/
type Tw = {
	id: string
	q: unknown
	baseURL?: string //Only appears as a quick fix in SAMD9-SAMD9L.hg19?
}

type Variant2Samples = GdcApi & {
	variantkey: string
	twLst?: Tw[]
	sunburst_twLst?: Tw[]
}

type MutationSet = {
	snvindel: string
	cnv: string
	fusion: string
}

/** different methods to return samples with assay availability info */
type DtAssayAvailability = DtAssayAvailabilityGetter | DtAssayAvailabilityTerm

/** using ds-supplied getter */
type DtAssayAvailabilityGetter = {
	/** define q
	returns:
	{
		yesSamples: Set() of sample ids
		noSamples: Set() of sample ids
	}
	*/
	get: (q: any) => any
}
/** using dictionary term */
type DtAssayAvailabilityTerm = {
	/** id of this assay term for this dt */
	term_id: string
	/** optional label */
	label?: string
	/** categories meaning the sample has this assay */
	yes: { value: string[] }
	/** categories meaning the sample doesn't have this assay */
	no: { value: string[] }
}

type DtAssayAvailabilityByOrigin = {
	byOrigin: {
		/** each key is an origin value or category */
		[index: string]: DtAssayAvailability
	}
}

type Mds3AssayAvailability = {
	/** object of key-value pairs. keys are dt values */
	byDt: {
		/** each index is a dt value */
		[index: number]: DtAssayAvailabilityByOrigin | DtAssayAvailability
	}
}

// mds legacy; delete when all are migrated to mds3
type LegacyAssayAvailability = {
	file?: string
	assays?: {
		id: string
		name: string
		type: string
		values?: {
			[index: string]: { label: string; color: string }
		}
	}[]
}

export type CumBurdenData = {
	/** directory containing cumulative burden data */
	dir: string
	files: {
		fit: string
		surv: string
		sample: string
	}
	/** subdirectory containing bootstrap data */
	bootsubdir: string
	db: {
		/** db file created by separate repo, pcb/utils/create.sql */
		file: string
		/** sqlite connection */
		connection?: any
	}
}

//Shared with genome.ts
export type Cohort = {
	/** if present, means correlation volcano plot analysis is enabled */
	correlationVolcano?: CorrelationVolcano
	cumburden?: CumBurdenData
	db?: FileObj
	/** customize the default chart to open on mass ui when there's no charts. if
	 * missing it opens dictionary ui */
	defaultChartType?: string
	massNav?: MassNav
	matrixplots?: MatrixPlots
	mutationset?: MutationSet[]
	renamedChartTypes?: { singleCellPlot?: string; sampleScatter?: string }
	/** if present, supplies premade scatter plots */
	scatterplots?: Scatterplots
	termdb: Termdb
	hiddenTermIds?: string[]
}

/** Customizations specific to the mass nav component */
type MassNav = {
	/** Customization for the tabs*/
	tabs?: {
		/** supported keys: about, charts, groups, filter
		invalid key is ignored
		when dslabel is too long to show in about tab middl row or to define alternative label, do .tabs:{about:{mid:'alt label'}}
		*/
		[index: string]: {
			/** show in a specific order of tabs */
			order?: number
			/** label appearing in the top row in upper case */
			top?: string
			/** biggest label appearing in the middle row */
			mid?: string
			/** label appearing in the bottom row*/
			btm?: string
			/** if true, does not show the tab */
			hide?: boolean
			/** static html contents to show specifically in "about" tab subheader
			 * maybe used for other tabs as well.
			 */
			html?: string
			/** declare data release. should only use for "about" */
			dataRelease?: {
				/** data release version */
				version: string
				/** link to data release page */
				link: string
			}
			/** html string, can include links to other
			 * pages (e.g., tutorials, google group) */
			additionalInfo?: string
			/** "active" items, shown as clickable buttons in about tab. click an item to launch a plot */
			activeItems?: {
				items: ActiveItem[]
				// can add holderStyle to customize
			}
		}
	}
	/** customize background color of active navigation tab */
	activeColor?: string
	/** customize background color of active navigation tab on hover */
	activeColorHover?: string
}

type ActiveItem = {
	/** string or html to show inside the button for the item, potentially allow to include <image> as logo */
	title: string
	/** plot object describing the plot to be launched */
	plot: object
}

type Title = {
	text: string
	link?: string
}
/*** types supporting MdsCohort type ***/
type SampleAttribute = {
	attributes: Attributes
}

type HierarchiesLstEntry = {
	name: string
	levels: KeyLabelFull[]
}

type Hierarchies = {
	lst: HierarchiesLstEntry[]
}

type SetSamples = {
	file: string
	valuename: string
	skipzero: boolean
}

type SetSignatures = {
	[index: number]: { name: string; color: string }
}

type MutSigSets = {
	[index: string]: {
		name: string
		samples: SetSamples
		signatures: SetSignatures
	}
}

type MutationSignature = {
	sets: MutSigSets
}

type MdsCohort = {
	//Does not apply to Mds3 or genomes!
	files: FileObj[]
	samplenamekey: string
	tohash: (item: any, ds: any) => void //Fix later
	sampleAttribute?: SampleAttribute
	hierarchies?: Hierarchies
	survivalplot?: SurvivalPlot
	mutation_signature?: MutationSignature
	//scatterplot - skipping b/c codes to the old scatterplot, not mass
}

/*** types supporting MdsQueries type ***/
type BaseTrack = {
	name?: string
	istrack?: boolean
	type?: string
	file?: string
	hideforthemoment?: number
	viewrangeupperlimit?: number
}

type LegendVOrigin = {
	key: string
	somatic: string
	germline: string
}

type GroupSampleByAttr = {
	attrlst: KeyLabelFull[]
	sortgroupby?: {
		key: string
		order: string[]
	}
	attrnamespacer?: string
}

type Svcnv = BaseTrack & {
	valueCutoff: number
	bplengthUpperLimit: number
	segmeanValueCutoff?: number
	no_loh?: number
	lohLengthUpperLimit?: number
	hideLOHwithCNVoverlap?: boolean
	vcf_querykey?: string
	expressionrank_querykey?: string
	multihidelabel_vcf: boolean
	multihidelabel_fusion?: boolean
	multihidelabel_sv: boolean
	legend_vorigin?: LegendVOrigin
	groupsamplebyattr?: GroupSampleByAttr
}

type KeyLabelFull = {
	/* Used in: 
                queries.genefpkm.boxplotbysamplegroup.attributes
                cohort.hierarchies.lst[i].levels
*/
	k: string
	label: string
	full?: string
}

type ASE = {
	qvalue: number
	meandelta_monoallelic: number
	asemarkernumber_biallelic: number
	color_noinfo: string
	color_notsure: string
	color_biallelic: string
	color_monoallelic: string
}

type GeneFpkmOutlier = {
	pvalue: number
	color: string
}

type BoxPlotAdditionalsEntry = {
	label: string
	attributes: KeyVal[]
}

type BoxPlotBySampleGroup = {
	attributes: KeyLabelFull[]
	additionals?: BoxPlotAdditionalsEntry[]
}

type Fpkm = BaseTrack & {
	datatype: string
	itemcolor: string
}

type GeneFpkm = Fpkm & {
	isgenenumeric: boolean
	boxplotbysamplegroup?: BoxPlotBySampleGroup
	ase?: ASE
	outlier?: GeneFpkmOutlier
}

type CutoffValueLstEntry = {
	/** '<' or '>' to add to the label */
	side: string
	value: number
	label: string
}

type ValuePerSample = KeyLabel & {
	cutoffValueLst: CutoffValueLstEntry[]
}

type InfoFilterCatEntry = {
	label: string
	color: string
	valuePerSample?: ValuePerSample
}

type InfoFilterCat = {
	[index: string]: InfoFilterCatEntry
}

type InfoFilterLstEntry = KeyLabel & {
	categories: InfoFilterCat
	hiddenCategories: { Unannotated: number }
}

type InfoFilter = {
	lst: InfoFilterLstEntry[]
}

type ReadCountBoxPlotPerCohort = {
	groups: KeyLabel[]
}

type SingleJunctionSummary = {
	readcountboxplotpercohort: ReadCountBoxPlotPerCohort
}

type Junction = BaseTrack & {
	readcountCutoff: number
	infoFilter: InfoFilter
	singlejunctionsummary: SingleJunctionSummary
}

type MdsSnvindel = BaseTrack & {
	tracks: BaseTrack[]
	singlesamples?: {
		tablefile: string
	}
}

type SomaticCnv = BaseTrack & {
	valueLabel: string
	valueCutoff: number
	bplengthUpperLimit: number
}

type Vcf = BaseTrack & {
	tracks: BaseTrack[]
}

type MdsQueries = {
	svcnv?: Svcnv
	genefpkm?: GeneFpkm
	junction?: Junction
	snvindel?: MdsSnvindel
	somaticcnv?: SomaticCnv
	vcf?: Vcf
	fpkm?: Fpkm
}

type AttrValues = {
	[index: string]: {
		name?: string
		label?: string
		color?: string
	}
}

type AttributesEntry = {
	label: string
	values?: AttrValues
	hidden?: number
	filter?: number
	appendto_link?: string
	isfloat?: number | boolean
	isinteger?: number | boolean
	clientnoshow?: number
	showintrack?: boolean
}

type Attributes = {
	[index: string]: AttributesEntry
}

type MutationAttribute = {
	attributes: Attributes
}

type MutationTypesEntry = {
	db_col: string
	label?: string
	default: number
	sizecutoff?: string
	log2cutoff?: number
}

type Gene2MutCount = {
	dbfile: string
	mutationTypes: MutationTypesEntry[]
}

type LocusAttribute = {
	attributes: Attributes
}

type ViewMode = {
	byAttribute?: string
	byInfo?: string
	inuse?: boolean
}

/*** types supporting Mds Dataset types ***/
type BaseMds = {
	genome?: string //Not declared in TermdbTest
	assayAvailability?: Mds3AssayAvailability | LegacyAssayAvailability
}

export type Mds = BaseMds & {
	isMds: boolean
	about?: KeyVal[]
	sampleAssayTrack?: FileObj
	singlesamplemutationjson?: FileObj
	cohort?: MdsCohort
	queries?: MdsQueries
	mutationAttribute?: MutationAttribute
	dbFile?: string
	version?: { label: string; link: string }
	gene2mutcount?: Gene2MutCount
	locusAttribute?: LocusAttribute
	alleleAttribute?: {
		attributes: {
			[attrName: string]: {
				label: string
				isnumeric: number
				filter: number
			}
		}
	}
}

type PreInitStatus = {
	/**
	 * status: 'OK' indicates a valid response
	 *
	 * status: 'recoverableError' may cause the server code to retry until the response is healthy,
	 * depending on the server startup code flow
	 *
	 * other status will be considered fatal error
	 * */
	status: string
	/** response message as related to the status */
	message?: string
	/** arbitrary response payload properties that is specific to a dataset */
	[props: string]: any
}

export type PreInit = {
	/**
	  getStatus() is used to make sure that data sources are ready before starting to query data;
		for example, wait on GDC API server to be healthy before starting to initialize, 
		or wait for intermittent network errors to clear on a network mount; 
		HTTP connection timeout errors or status 5xx are considered recoverable,
		status 4xx are not considered recoverable (client-related request errors)
	*/
	getStatus: () => Promise<PreInitStatus>
	/**
	 * dev only, used to test preInit handling by simulating different
	 * responses in a known sequence of steps that may edit the preInit
	 * response
	 */
	test?: {
		/** the current number of calls to preInit.getStatus() */
		numCalls: number
		/**
		 * an arbitrary response payload property that is edited in mayEditResponse()
		 * for example, this is used to simulate a stale or current GDC version
		 * */
		minor: number
		/**
		 * a callback to potentially edit the preInit.getStatus() response
		 */
		mayEditResponse: (response: any) => any
	}
}

/** see details in termdb.server.init.ts
 */
export type isSupportedChartCallbacks = {
	[chartType: string]: (f: any) => boolean | undefined
}

export type Mds3 = BaseMds & {
	/** set in initGenomesDs.js during launch, should use .genomename instead of .genome */
	genomename?: string // use this
	genome?: string // avoid using it
	/** server-side genome obj to which this ds belongs to is attached here in initGenomesDs.js during launch, 
	so this obj can be conveniently available to server side functions without having to introduce extra param
	TODO apply Genome type
	*/
	genomeObj?: any
	label?: Title
	isMds3: boolean
	loadWithoutBlocking?: boolean
	preInit?: PreInit
	init?: {
		/** number of milliseconds to wait before calling th preInit.getStatus() again */
		retryDelay?: number
		/** maximum number of tries to complete initialization, including preInit.getStatus() before validation steps
		 * and the nonblocking steps after validation. Before the retryMax is reached, errors are considered recoverable;
		 * errors when retryMax is reached will be fatal. */
		retryMax?: number
		/** option to trigger mds3InitNonblocking() on this dataset */
		hasNonblockingSteps?: boolean
		/** server-computed cumulative count of the attempted init retries */
		currentRetry?: number
		/**
		 * optional callback to send notifications of pre-init errors
		 * for St. Jude, this may reuse code that post to Slack channel;
		 * in dev and other portals, this may use custom callbacks
		 * */
		errorCallback?: (response: PreInitStatus) => void
	}
	/** optional callback to invoke non-blocking code after dataset query validation in mds3.init.js;
	 * for GDC, this callback is created after buildDictionary in initGdc.js
	 **/
	initNonblocking?: (a: any) => void
	viewModes?: ViewMode[]
	dsinfo?: KeyVal[]
	queries?: Mds3Queries
	cohort?: Cohort
	isSupportedChartOverride?: isSupportedChartCallbacks
	// TODO FIXME nest termdb under cohort
	termdb?: Termdb
	validate_filter0?: (f: any) => void
	ssm2canonicalisoform?: GdcApi
	variant2samples?: Variant2Samples
	/** disables switching to genomic mode for the protein view mds3 tk of this ds
	works by preventing block gmmode menu from showing "genomic" option
	is only passed via mds3 adhoc ds copy, but not termdbConfig
	for lack of a better place to put this attribute, as it's not appropriate to put in queries.snvindel{}
	as snvindel is optional so even a cnv-only ds can disable genomic mode
	*/
	noGenomicMode4lollipopTk?: true
	/** if ds.queries{} exists, server launch adds this convenient getter to wrap multiple queries data types
	 */
	mayGetGeneVariantData?: (f: any) => void
	/** optional key-value pairs to pass to genomic queries getter when called in mayGetGeneVariantData() 
	- only used in mayGetGeneVariantData! not in mds3.load.js
	- for now only passed to snvindel.*.get and not yet other data types; add when needed
	the param contents will be assessed by ds specific getter
	this is serverside only, not passed to termdbConfig
	*/
	mayGetGeneVariantDataParam?: { [key: string]: any }
	// !!! TODO: improve these type definitions below !!!
	getHostHeaders?: (q?: any) => any
	serverconfigFeatures?: any
	getHealth?: (ds: any) => {
		[key: string]: any
	}
}

export type Mds3WithCohort = Mds3 & {
	cohort: Cohort
}
