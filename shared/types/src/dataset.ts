import type { Mclass } from './Mclass.ts'

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

type Chr2bcffile = {
	/** index is the chr (e.g. 'chr1', 'chr2', etc.)
	 * value is the bcf file path */
	[index: string]: string
}

type bcfMafFile = {
	/** bcf file for only variants, no samples and FORMAT */
	bcffile: string
	/** maf file for sample mutations. bcf header contents with FORMAT and list of samples are
	 * copied into this maf as headers followed by the maf header starting with #chr, pos, ref,
	 * alt and sample. Each column after sample corresponds to the information in FORMAT. file
	 * is bgzipped and tabix indexed (tabix -c"#" -s 1 -b 2 -e 2 <maf.gz>) */
	maffile: string
}

type SnvindelByRange = {
	/** if true, served from gdc. no other parameters TODO change to src='gdc/native' */
	gdcapi?: boolean

	//local ds can have following different setup

	/** one single bcf file */
	bcffile?: string
	/** one bcf file per chr */
	chr2bcffile?: Chr2bcffile
	/** bcf+maf combined */
	bcfMafFile?: bcfMafFile
	/** allow to apply special configurations to certain INFO fields of the bcf file */
	infoFields?: InfoFieldEntry[]
	/** if true, bcf or chr2bcf uses string sample name in header. to be used during this migrating so the code can deal with old files with integer sample ids and new ones; TODO once all datasets are migrated, delete the flag */
	tempflag_sampleNameInVcfHeader?: boolean
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
	filter: Filter
	terms: FilterTermEntry[]
}

/** one set of AC and AN info fields to retrieve data for this population */
type PopulationINFOset = {
	/** optional name for identifying this set, when the population is ancestry-stratified and a population has multiple sets */
	key?: string
	/** required info field */
	infokey_AC: string
	/** required info field */
	infokey_AN: string
	/** Optional */
	termfilter_value?: string
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
	/** optional term id used for race adjusting, must correspond to a term in dataset db */
	termfilter?: string
	/** if AC/AN of the population is ancestry-stratified, will be multiple elements of this array; otherwise just one */
	sets: PopulationINFOset[]
}

/** primarily for prebuilding germline genetic association for survivorship portal
accessible to client via termdb.js?for=mds3queryDetails
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
	/** allow to query data by either isoform or range
	 * isoform query is only used for gdc api
	 */
	byisoform?: GdcApi
	/** query data by range */
	byrange: SnvindelByRange

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
	details?: SnvindelComputeDetails
}

type SvFusion = {
	byrange: {
		/** file paths for sv fusion data */
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
	/** boolean and string creates a checkbox
	 * number creates a text input
	 */
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
	/** Specifies the dom element rendered in the menu */
	arguments?: GeneArgumentEntry[]
}

type TklstEntry = {
	/** Determines the column to add the track via the assay names
	 * shown at the top of the facet table.*/
	assay?: string
	/** track type (e.g. bigwig, bedj, etc.) */
	type: string
	/** Human readable name */
	name: string
	/** Corresponding sample id in the data file */
	sampleID?: string
	/** data file path */
	file: string
	/** The key for the second tier of the facet table*/
	level1?: string
	/** The key for the third tier of the facet table*/
	level2?: string
	/** Whether the track is shown by default */
	defaultShown?: boolean
	/** Track height */
	stackheight?: number
	/** Space added to the height of the track */
	stackspace?: number
	/** padding-top for the track */
	toppad?: number
	/** padding-bottom for the track */
	bottompad?: number
	/** Specifically for bedj tracks. if true, will render all items in a
	 * single row and do not stack them */
	onerow?: number | boolean
}

type TrackLstEntry = {
	/** creates a facet table if true. */
	isfacet: boolean
	/** name shown for the facet table button from Tracks button*/
	name: string
	/** tk objs to show on click of the facet table */
	tklst: TklstEntry[]
}

type CnvSegment = {
	byrange: CnvSegmentByRange
	/****** rendering parameters ****
not used as query parameter to filter segments
value range for color scaling. default to 5. cnv segment value>this will use solid color
*/
	absoluteValueRenderMax?: number
	gainColor?: string
	lossColor?: string

	/*** filtering parameters ***
default max length setting to restrict to focal events; if missing show all */
	cnvMaxLength?: number

	/** TODO define value type, if logratio, or copy number */

	/** following two cutoffs only apply to log ratio, cnv gain value is positive, cnv loss value is negative
if cnv is gain, skip if value<this cutoff */
	cnvGainCutoff?: number
	/** if cnv is loss, skip if value>this cutoff */
	cnvLossCutoff?: number
}

type CnvSegmentByRange = {
	src: 'native' | 'gdcapi' | string
	/** only for src=native */
	file?: string
}

/*
no longer used!!
file content is a probe-by-sample matrix, values are signals
for a given region, the median signal from probes in the region is used to make a gain/loss call for each sample
this is alternative to CnvSegment

type Probe2Cnv = {
                file: string
}
*/

type RnaseqGeneCount = {
	/** Name of the HDF5 or text file */
	file: string
	samplesFile?: string
	/** Storage_type for storing data (HDF5 or text). Will deprecate text files in the future */
	storage_type: 'text' | 'HDF5'
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
	src: 'gdcapi' | string
	geneExpression2bins?: { [index: string]: any }
}

export type GeneExpressionQueryNative = {
	src: 'native' | string
	file: string
	/** dynamically added during server launch, list of sample integer IDs from file */
	samples?: number[]
	nochr?: boolean
	get?: (param: any) => void
	/** This dictionary is used to store/cache the default bins calculated for a geneExpression term when initialized in the fillTermWrapper */
	geneExpression2bins?: { [index: string]: any }
	/** Type of data format HDF5 or bed */
	storage_type?: 'HDF5' | 'bed'
}

export type GeneExpressionQuery = GeneExpressionQueryGdc | GeneExpressionQueryNative

export type SingleCellGeneExpressionNative = {
	src: 'native'
	/** path to R rds or HDF5 files, each is a gene-by-cell matrix for a sample, with ".rdx" suffix. missing files are detected and handled */
	folder: string
	/** HDF5 or RDS file, will deprecate RDS file later */
	storage_type: 'HDF5' | 'RDS'
	/** dynamically added getter */
	get?: (q: any) => any
	/** cached gene exp bins */
	sample2gene2expressionBins?: { [sample: string]: { [gene: string]: any } }
}

export type SingleCellGeneExpressionGdc = {
	src: 'gdcapi'
}

export type SingleCellSamplesNative = {
	src: 'native'
	/** kept to prevent tsc err */
	firstColumnName?: string
	/** any columns to be added to sample table. each is a term id */
	sampleColumns?: { termid: string }[]
	/** used on client but not on ds */
	experimentColumns?: { label: string }[]
	get?: (q: any) => any
}

export type SingleCellSamplesGdc = {
	src: 'gdcapi'
	/** if missing refer to the samples as 'sample', this provides override e.g. 'case' */
	/** logic to decide sample table columns (the one shown on singlecell app ui, displaying a table of samples with sc data)
a sample table will always have a sample column, to show sample.sample value
firstColumnName allow to change name of 1st column from "Sample" to different, e.g. "Case" for gdc
the other two properties allow to declare additional columns to be shown in table, that are for display only
when sample.experiments[] are used, a last column of experiment id will be auto added
*/
	firstColumnName?: string
	/** same as SingleCellSamplesNative */
	sampleColumns?: { termid: string }[]
	/** used on client but not on ds */
	experimentColumns?: { label: string }[]
	get?: (q: any) => any
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
	samples: SingleCellSamplesGdc | SingleCellSamplesNative
	/** defines tsne/umap type of clustering maps for each sample
	 */
	data: SingleCellDataGdc | SingleCellDataNative
	/** defines available gene-level expression values for each cell of each sample */
	geneExpression?: SingleCellGeneExpressionGdc | SingleCellGeneExpressionNative
	/** Precomputed top differentialy expressed genes for a cell cluster, against rest of cells */
	DEgenes?: SingleCellDEgeneGdc
}

type LdQuery = {
	/** each track obj defines a ld track */
	tracks: {
		/** for displaying and identifying a track. must not duplicate */
		name: string
		/** relative path of ld .gz file */
		file: string
		/** dynamically added full path */
		file0?: string
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
	defaultBlock2GeneMode?: boolean
	snvindel?: SnvIndelQuery
	svfusion?: SvFusion
	cnv?: CnvSegment
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
	trackLst?: TrackLstEntry[]
	singleCell?: SingleCellQuery
	geneCnv?: {
		bygene?: {
			gdcapi: true
		}
	}
	defaultCoord?: string
	ld?: LdQuery
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
	// path to the folder where sample images are stored
	imageBySampleFolder: string
	// TODO extend to support multiple sources
	//sources?: []
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
	term: { id: string; type: string }
	/** Title above the cohort introduction/content in the about tab */
	title?: string
	/** Text above radio cohort options in the about tab. */
	prompt: string
	values: SelectCohortValuesEntry[]
	description?: string
	/* If the description is dependent on the user pass a descriptionByUser dict instead */
	descriptionByUser?: { [index: string]: string }
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
	/** a plot can be colored by either a dict term termsetting (colorTW) or file column values (colorColumn) */
	colorTW?: { id: string }
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

type MatrixSettingsControlLabels = {
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

type MatrixSettings = {
	maxSample?: number
	svgCanvasSwitch?: number
	cellEncoding?: string
	cellbg?: string
	controlLabels?: MatrixSettingsControlLabels
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
	// TODO: improve definitions below
	legendGrpFilter?: any
	legendValueFilter?: any
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
	displaySampleIds?: boolean
	converSampleIds?: boolean
	allowedTermTypes?: string[]
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

	/** quick fix to convert category values from a term to lower cases for comparison (case insensitive comparison)
for gdc, graphql and rest apis return case-mismatching strings for the same category e.g. "Breast/breast"
keep this setting here for reason of:
- in mds3.gdc.js, when received all-lowercase values from graphql, it's hard to convert them to Title case for comparison
- mds3.variant2samples consider this setting, allows to handle other datasets of same issue
  */
	useLower?: boolean

	scatterplots?: Scatterplots
	matrix?: Matrix
	numericDictTermCluster?: NumericDictTermCluster
	survival?: Survival
	logscaleBase2?: boolean
	plotConfigByCohort?: PlotConfigByCohort
	/** Functionality */
	dataDownloadCatch?: DataDownloadCatch
	helpPages?: URLEntry[]
	multipleTestingCorrection?: MultipleTestingCorrection
	/** regression settings for neuro-oncology portals:
- no interaction terms
- report event counts of cox coefficients
- hide type III stats and miscellaneous statistical tests */
	neuroOncRegression?: boolean
	urlTemplates?: {
		/** gene link definition */
		gene?: UrlTemplateBase
		/** sample link definition */
		sample?: UrlTemplateBase
		/** ssm link definition */
		ssm?: UrlTemplateSsm | UrlTemplateSsm[]
	}

	q?: {
		getSupportedChartTypes: (a: any) => any
	}
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

type BaseDtEntry = {
	term_id: string
	yes: { value: string[] }
	no: { value: string[] }
	label?: string
}

type SNVByOrigin = {
	[index: string]: BaseDtEntry
}

type DtEntrySNV = {
	byOrigin: SNVByOrigin
}

type ByDt = {
	/** SNVs differentiate by sample origin. Non-SNV, no differentiation*/
	[index: number]: DtEntrySNV | BaseDtEntry
}

type AssayValuesEntry = {
	[index: string]: { label: string; color: string }
}

type AssaysEntry = {
	id: string
	name: string
	type: string
	values?: AssayValuesEntry
}

type AssayAvailability = {
	byDt?: ByDt
	file?: string
	assays?: AssaysEntry[]
}

//Shared with genome.ts
export type Cohort = {
	cumburden?: {
		files: {
			fit: string
			surv: string
			sample: string
		}
	}
	db: FileObj
	/** customize the default chart to open on mass ui when there's no charts. if
	 * missing it opens dictionary ui */
	defaultChartType?: string
	massNav?: MassNav
	matrixplots?: MatrixPlots
	mutationset?: MutationSet[]
	renamedChartTypes?: { singleCellPlot?: string; sampleScatter?: string }
	scatterplots?: Scatterplots
	termdb: Termdb
}

/** Customizations specific to the mass nav component */
type MassNav = {
	/** optional title of this ds, if missing use ds.label. shown on mass nav header.
	 * use blank string to not to show a label*/
	title?: Title
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
			/** "active" items, shown as clickable buttons in about tab. click an item to launch a plot */
			activeItems?: {
				items: ActiveItem[]
				// can add holderStyle to customize
			}
		}
	}
	/** customize background color of active navigation tab */
	activeColor?: string
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
	assayAvailability?: AssayAvailability
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
	/** number of milliseconds to wait before calling th preInit.getStatus() again */
	retryDelay?: number
	/** maximum number of times to call preInit.getStatus() before giving up */
	retryMax?: number
	/**
	 * optional callback to send notifications of pre-init errors
	 * for St. Jude, this may reuse code that post to Slack channel;
	 * in dev and other portals, this may use custom callbacks
	 * */
	errorCallback?: (response: PreInitStatus) => void
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

/** supply "isSupported()" kind of callback per chart type,
	that will overwrite default logic in getSupportedChartTypes()
	- the callback can have arbitrary logic based on requirements from this ds
	- can supply ()=>false to hide charts that will otherwise shown
	- can define arbitrary chart type names for purpose-specific charts
*/

export type isSupportedChartCallbacks = {
	[chartType: string]: (f: any, auth: any) => boolean | undefined
}

export type Mds3 = BaseMds & {
	label?: Title
	isMds3: boolean
	loadWithoutBlocking?: boolean
	preInit?: PreInit
	initErrorCallback?: (a: any) => void
	viewModes?: ViewMode[]
	dsinfo?: KeyVal[]
	queries?: Mds3Queries
	cohort?: Cohort
	isSupportedChartOverride?: isSupportedChartCallbacks
	// TODO: termdb should be nested under cohort
	termdb?: Termdb
	validate_filter0?: (f: any) => void
	ssm2canonicalisoform?: GdcApi
	variant2samples?: Variant2Samples
	// !!! TODO: improve these type definitions below !!!
	getHostHeaders?: (q?: any) => any
	serverconfigFeatures?: any
	customTwQByType?: {
		[termType: string]: {
			[key: string]: any
		}
	}
	getHealth?: (ds: any) => {
		[key: string]: any
	}
}

export type Mds3WithCohort = Mds3 & {
	cohort: Cohort
}
