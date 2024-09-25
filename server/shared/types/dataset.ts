import { Mclass } from './Mclass.ts'

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
	[index: string]: {
		color: string
		label?: string
		desc: string
		textcolor?: string
		name?: string
	}
}

type NumericFilterEntry = {
	side: string
	value: number
}

type AFEntry = {
	name: string
	locusinfo: { key: string }
	numericfilter: NumericFilterEntry[]
}

export type ClinvarAF = {
	[index: string]: AFEntry
}

/*** types supporting Queries type ***/

type InfoFieldEntry = {
	name: string
	key: string
	categories?: InfoFieldCategories
	separator?: string
}

/*
type GenomicPositionEntry = {
        chr: string
        start: number
        stop: number
}
*/

type Chr2bcffile = { [index: string]: string }
type bcfMafFile = {
	/** bcf file for only variants, no samples and FORMAT */
	bcffile: string
	/** maf file for sample mutations. bcf header contents with FORMAT and list of samples are copied into this maf as headers followed by the maf header starting with #chr, pos, ref, alt and sample. Each column after sample corresponds to the information in FORMAT. file is bgzipped and tabix indexed (tabix -c"#" -s 1 -b 2 -e 2 <maf.gz>) */
	maffile: string
}

type SnvindelByRange = {
	/** if true, served from gdc. no other parameters TODO change to src='gdc/native' */
	gdcapi?: boolean
	/**local file can have following different setup
	 * one single bcf file */
	bcffile?: string
	/** one bcf file per chr */
	chr2bcffile?: Chr2bcffile
	/** bcf+maf combined */
	bcfMafFile?: bcfMafFile
	/** allow to apply special configurations to certain INFO fields of the bcf file */
	infoFields?: InfoFieldEntry[]
}

type SvfusionByRange = {
	file?: string
}

type URLEntry = {
	base?: string
	key?: string
	namekey?: string
	label?: string
	url?: string
}

type SkewerRim = {
	type: string
	formatKey: string
	rim1value: string
	noRimValue: string
}

type GdcApi = {
	gdcapi?: boolean
}

type M2Csq = GdcApi & {
	by: string
}

type SnvIndelFormatEntry = {
	ID: string
	Description: string
	Number: string | number
	Type: string
}

type SnvIndelFormat = {
	[index: string]: SnvIndelFormatEntry
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
	m2csp?: M2Csq
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
	details?: any
}

type SvFusion = {
	byrange: SvfusionByRange
}

type SingleSampleMutationQuery = {
	src: 'native' | 'gdcapi' | string
	/** which property of client mutation object to retrieve sample identifier for querying single sample data with */
	sample_id_key: string
	/** only required for src=native */
	folder?: string
	/** quick fix to hide chrM from disco, due to reason e.g. this dataset doesn't have data on chrM */
	discoSkipChrM?: true
}

type NIdataQuery = {
	Ref1: NIdataQueryRef
}

type NIdataQueryRef = {
	referenceFile: string
	samples: string
	parameters?: NIdataQueryRefParams
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
	value?: string | boolean | number | { type: string; value: string[] | null }
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
	src: 'gdcapi' | 'native' | string
	arguments?: GeneArgumentEntry[]
}

type TopMutatedGenes = {
	arguments?: GeneArgumentEntry[]
}

type TklstEntry = {
	assay?: string
	type: string
	name: string
	sample?: string
	file: string
	level1?: string
	defaultShown?: boolean
	stackheight?: number
	stackspace?: number
	toppad?: number
	bottompad?: number
	onerow?: number // should be boolean???
}

type TrackLstEntry = {
	isfacet: boolean
	name: string
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
	file: string
	samplesFile?: string
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

	/** logic to decide sample table columns (the one shown on singlecell app ui, displaying a table of samples with sc data)
    a sample table will always have a sample column, to show sample.sample value
    firstColumnName allow to change name of 1st column from "Sample" to different, e.g. "Case" for gdc
    the other two properties allow to declare additional columns to be shown in table, that are for display only
    when sample.experiments[] are used, a last column of experiment id will be auto added
	*/
	firstColumnName?: string

	/** do not use for native ds! gdc-only property. kept as optional to avoid tsc err */
	experimentColumns?: string

	/** any other columns to be added to sample table. each is a term id */
	sampleColumns?: { termid: string }[]

	/** dynamically added getter */
	get?: (q: any) => any
}
export type SingleCellSamplesGdc = {
	src: 'gdcapi'
	get?: (q: any) => any
	/** if missing refer to the samples as 'sample', this provides override e.g. 'case' */
	firstColumnName?: string
	sampleColumns?: { termid: string }[]
	experimentColumns?: { label: string }[]
}

export type SingleCellDataGdc = {
	src: 'gdcapi'
	sameLegend: boolean
	get?: (q: any) => any
	refName: string
	plots: GDCSingleCellPlot[]
	width?: number
	height?: number
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
	colorColumn: ColorColumn
	coordsColumns: { x: number; y: number }
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
	/** specify which column to color the cells in the plot. must have categorical values
	TODO define a set of color columns and specify a default one, and let ui to switch from
	*/
	colorColumn: ColorColumn
	/** 0-based column number for x/y coordinate for this plot */
	coordsColumns: { x: number; y: number }
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

	width?: number
	height?: number
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
	overlay: {
		color_1: string
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
		/** */
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
	topMutatedGenes?: TopMutatedGenes
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

/** deep zoom image shown via openseadragon, with precomputed tiles. this is replaced by WSImages and should not be used anymore */
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

type SelectCohortEntry = {
	term: { id: string; type: string }
	prompt: string
	values: SelectCohortValuesEntry[]
	description?: string
	asterisk?: string
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
	maxTimeToEvent?: number
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
	/** allow to add two buttons (CNV and mutation) to control panel for selecting mclasses displayed on oncoMatrix */
	addMutationCNVButtons?: boolean
	/** this is now computed from sortPriority[x].tiebreakers.find(tb => tb.filter?.values[0]?.dt === 1) ... */
	sortByMutation?: string
	/** this is now computed from sortPriority[x].tiebreakers.find(tb => tb.filter?.values[0]?.dt === 4).isOrdered */
	sortByCNV?: boolean
	cnvUnit?: 'log2ratio' | 'segmedian'
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
	survival?: Survival
	logscaleBase2?: boolean
	chartConfigByType?: ChartConfigByType
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
	// !!! TODO: improve this type definition !!!
	getGeneAlias?: (q: any, tw: any) => any
	convertSampleId?: {
		gdcapi: boolean
	}
	hierCluster?: any

	/** ds customization of rules in TermTypeSelect on what term type to exclude for a usecase.
	used by gdc in that gene exp cannot be used for filtering 
	note this applies to left-side term type tabs, but not terms in dict tree. latter is controlled by excludeTermtypeByTarget
	*/
	useCasesExcluded?: {
		/** key is target name (todo restrict values), value is array of 1 or more term types (todo restrict values) */
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
	about?: {
		/** Customization for the tab */
		tab?: {
			/** show in a specific order of tabs */
			order?: number
			/** label appearing in the top row in upper case */
			topLabel?: string
			/** biggest label appearing in the middle row in upper case */
			midLabel?: string
			/** label appearing in the bottom row*/
			btmLabel?: string
		}
		/** html code */
		html: string
	}
}

type ChartConfigByType = {
	[index: string]: ChartConfig
}

type ChartConfig = {
	[key: string]: any
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
	hideGroupsTab?: boolean
	allowedChartTypes?: string[]
	hiddenChartTypes?: string[]
	renamedChartTypes?: { singleCellPlot?: string; sampleScatter?: string }
	mutationset?: MutationSet[]
	db: FileObj
	termdb: Termdb
	scatterplots?: Scatterplots
	matrixplots?: MatrixPlots
	/** optional title of this ds, if missing use ds.label. shown on mass nav header. use blank string to not to show a label*/
	title?: Title
	cumburden?: {
		files: {
			fit: string
			surv: string
			sample: string
		}
	}
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

export type Mds3 = BaseMds & {
	label?: Title
	isMds3: boolean
	viewModes?: ViewMode[]
	dsinfo?: KeyVal[]
	queries?: Mds3Queries
	cohort?: Cohort
	// TODO: termdb should be nested under cohort
	termdb?: Termdb
	validate_filter0?: (f: any) => void
	ssm2canonicalisoform?: GdcApi
	variant2samples?: Variant2Samples
	// !!! TODO: improve these type definitions below !!!
	getHostHeaders?: (q: any) => any
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
