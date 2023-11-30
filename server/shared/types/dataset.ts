/*** General usage types ***/
type FileObj = { file: string }

type KeyVal = {
	k: string
	v?: string
}

type KeyLabel = {
	key: string
	label: string
}

/*** types specific to ClinVar ***/

type ClinvarCategoriesEntry = {
	color: string
	label?: string
	desc: string
	textcolor?: string
	name?: string
}

//Shared with genome.ts
export type ClinvarClinsig = {
	[index: string]: ClinvarCategoriesEntry
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

type InfoFieldsEntry = {
	name: string
	key: string
	categories: ClinvarClinsig
	separator: string
}

/*
type GenomicPositionEntry = {
	chr: string
	start: number
	stop: number
}
*/

type Chr2bcffile = { [index: string]: string }

type ByRangeEntry = {
	bcffile?: string
	file?: string
	infoFields?: InfoFieldsEntry[]
	chr2bcffile?: Chr2bcffile
	gdcapi?: boolean
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
	[index: string | number]: { label: string }
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
	values?: (string | number)[]
}

type FilterTermEntry = BaseTvsFilter & {
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

type VariantFilterOpts = { joinWith: string[] }

type VariantFilter = {
	opts: VariantFilterOpts
	filter: Filter
	terms: FilterTermEntry[]
}

// one set of AC and AN info fields to retrieve data for this population
type PopulationINFOset = {
	key?: string // optional name for identifying this set, when the population is ancestry-stratified and a population has multiple sets
	infokey_AC: string // required info field
	infokey_AN: string // required info field
	termfilter_value?: string // optional ...
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
	key: string // for identifying this element
	label: string // display, in fact it can replace key since label should also be unique
	// allow to set to true for race-stratified population, will adjust population AC/AN values based on admix coefficient for the dataset's cohort variants
	// supposed to be "read-only" attribute and not modifiable in runtime
	allowto_adjust_race?: boolean
	adjust_race?: boolean // when above is true, this flag is flip switch for this adjustion
	termfilter?: string // optional term id used for race adjusting, must correspond to a term in dataset db
	sets: PopulationINFOset[] // if AC/AN of the population is ancestry-stratified, will be multiple elements of this array; otherwise just one
}

// a data type under ds.queries{}
type SnvIndelQuery = {
	forTrack?: boolean
	byrange: ByRangeEntry
	infoUrl?: URLEntry[]
	skewerRim?: SkewerRim
	format4filters?: string[]
	byisoform?: GdcApi
	m2csp?: M2Csq
	format?: SnvIndelFormat
	variant_filter?: VariantFilter
	populations?: Population[]
	/** this definition can appear either in queries.snvindel{} or termdb{}
	so that it can work for a termdb-less ds, e.g. clinvar, where termdbConfig cannot be made */
	ssmUrl?: UrlTemplateSsm
}

type SvFusion = {
	byrange: ByRangeEntry
}

type SingleSampleMutation = GdcApi & {
	sample_id?: string
	folder?: string
	sample_id_key?: string
	discoSkipChrM?: boolean
}

type TopVariablyExpressedGenes = {
	args?: any
}

type TopMutatedGenes = {
	arguments?: {
		id: string
		label: string
		type: string
		value: string
	}[]
}

type TklstEntry = {
	assay?: string
	type: string
	name: string
	sample?: string
	file: string
	defaultShown?: boolean
}

type TrackLstEntry = {
	isfacet: boolean
	name: string
	tklst: TklstEntry[]
}

type CnvSegment = {
	byrange?: CnvSegmentByRange
	gdcapi?: boolean
}
type CnvSegmentByRange = {
	file: string
}

/*
no longer used!!
file content is a probe-by-sample matrix, values are signals
for a given region, the median signal from probes in the region is used to make a gain/loss call for each sample
this is alternative to CnvSegment
*/
type Probe2Cnv = {
	file: string
}

type RnaseqGeneCount = {
	file: string
}

// the geneExpression query. if file is set, it loads data from local file; otherwise gdcapi should be set to true
type GeneExpressionQuery = {
	file?: string
	gdcapi?: boolean
	/* set to true if the value is already transformed across samples
	e.g. gdc data returned by /values endpoint is transformed as "(expression - median) / stdev"
	and should not be further transformed during clustering analysis
	*/
	valueIsTransformed?: boolean
}

export type SingleCellSamplesGdc = {
	src: 'gdcapi'
}
export type SingleCellSamplesNative = {
	src: 'native'
	/*
	a way to query anno_cat table to find those samples labeled with this term for having sc data
	TODO change to hasScTerm:string
	*/
	isSampleTerm: string
	get: () => { sample: string }[]
}
export type SingleCellDataGdc = {
	src: 'gdcapi'
}
type SingleCellPlot = {
	name: string
	folder: string
	fileSuffix: string
}
export type SingleCellDataNative = {
	src: 'native'
	plots: SingleCellPlot[]
	termIds: string[]
	get: (sample: any) => any
}

export type SingleCellQuery = {
	samples: SingleCellSamplesGdc | SingleCellSamplesNative
	data: SingleCellDataGdc | SingleCellDataNative
}

type Queries = {
	defaultBlock2GeneMode?: boolean
	snvindel?: SnvIndelQuery
	svfusion?: SvFusion
	probe2cnv?: Probe2Cnv // this is no longer used
	cnv?: CnvSegment
	singleSampleMutation?: SingleSampleMutation
	geneExpression?: GeneExpressionQuery
	rnaseqGeneCount?: RnaseqGeneCount
	topMutatedGenes?: TopMutatedGenes
	topVariablyExpressedGenes?: TopVariablyExpressedGenes
	trackLst?: TrackLstEntry[]
	// TODO singleSampleGbtk
	singleCell?: SingleCellQuery
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
	colorTW: { id: string }
}

type Scatterplots = {
	plots: ScatterPlotsEntry[]
}

type MatrixSettingsControlLabels = {
	samples: string
	sample: string
}

type ExcludeClasses = {
	[index: string]: number
}

type FeatureAttrs = {
	valuecutoff?: number
	focalsizelimit?: number
	excludeclasses?: ExcludeClasses
}

type CommonFeatureAttributes = {
	querykeylst: string[]
	cnv: FeatureAttrs
	loh: FeatureAttrs
	snvindel: FeatureAttrs
}

type MatrixConfigFeaturesEntry = {
	ismutation: number
	label: string
	position: string
}

type LimitSampleByEitherAnnotationEntry = {
	key: string
	value: string
}

type MatrixConfig = {
	header: string
	hidelegend_features: number
	features: MatrixConfigFeaturesEntry[]
	limitsamplebyeitherannotation: LimitSampleByEitherAnnotationEntry[]
}

type GroupsEntry = {
	name: string
	matrixconfig: MatrixConfig
}

type Group = {
	groups: GroupsEntry[]
}

type AnnotationSampleGroups = {
	[index: string]: Group
}

type AaaAnnotationSampleset2Matrix = {
	key: string
	commonfeatureattributes: CommonFeatureAttributes
	groups: AnnotationSampleGroups
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

type MatrixSettings = {
	maxSample?: number
	svgCanvasSwitch?: number
	cellEncoding?: string
	cellbg?: string
	controlLabels?: MatrixSettingsControlLabels
	sortSamplesBy?: string
	sortPriority?: SortPriorityEntry[]
	ignoreCnvValues?: boolean
	geneVariantCountSamplesSkipMclass?: Array<string>
	truncatingMutations?: Array<string>
	proteinChangingMutations?: Array<string>
}

type Mclass = {
	[index: string]: { color: string }
}

type Matrix = {
	settings?: MatrixSettings
	mclass?: Mclass
}

type MatrixPlotsEntry = {
	name: string
	file: string
	getConfig: (f: any) => void
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
	base: string // must end with '/'
	namekey: string
	defaultText?: string
}
type UrlTemplateSsm = UrlTemplateBase & {
	/** to create separate link, but not directly on chr.pos.ref.alt string.
	name of link is determined by either namekey or linkText. former allows to retrieve a name per m that's different from chr.pos.xx */
	shownSeparately?: true
	/** optional name of link, same name will be used for all links. e.g. "ClinVar" */
	linkText?: string
}

/*** types supporting Cohort type ***/
type Termdb = {
	//Terms
	termIds?: TermIds
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
	//Cohort specific
	selectCohort?: SelectCohortEntry
	additionalSampleAttributes?: string[]
	//Plots
	useLower?: boolean
	scatterplots?: Scatterplots
	matrix?: Matrix
	matrixplots?: MatrixPlots
	logscaleBase2?: boolean
	chartConfigByType?: ChartConfigByType
	//Functionality
	dataDownloadCatch?: DataDownloadCatch
	helpPages?: URLEntry[]
	multipleTestingCorrection?: MultipleTestingCorrection
	urlTemplates?: {
		gene?: UrlTemplateBase // gene link definition
		sample?: UrlTemplateBase // sample link definition
		ssm?: UrlTemplateSsm // ssm link definition
	}

	//GDC
	termid2totalsize2?: GdcApi
	dictionary?: GdcApi
	allowCaseDetails?: AllowCaseDetails
}

type ChartConfigByType = {
	[index: string]: ChartConfig
}

type ChartConfig = {
	[key: string]: any
}

type SimpleTermEntry = {
	id: string
	q: unknown
	baseURL?: string //Only appears as a quick fix in SAMD9-SAMD9L.hg19?
}

type Variant2Samples = GdcApi & {
	variantkey: string
	twLst: SimpleTermEntry[]
	sunburst_twLst?: SimpleTermEntry[]
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
}

type SNVByOrigin = {
	[index: string]: BaseDtEntry
}

type DtEntrySNV = {
	byOrigin: SNVByOrigin
}

type ByDt = {
	//SNVs differentiate by sample origin. Non-SNV, no differentiation
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
	allowedChartTypes?: string[]
	mutationset?: MutationSet[]
	db: FileObj
	termdb?: Termdb
	scatterplots?: Scatterplots
	cumburden?: {
		files: {
			fit: string
			surv: string
			sample: string
		}
	}
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
	inuse: boolean
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
	aaaannotationsampleset2matrix?: AaaAnnotationSampleset2Matrix
	locusAttribute?: LocusAttribute
}

export type Mds3 = BaseMds & {
	isMds3: boolean
	viewModes?: ViewMode[]
	dsinfo?: KeyVal[]
	queries?: Queries
	cohort?: Cohort
	termdb?: Termdb
	validate_filter0?: (f: any) => void
	ssm2canonicalisoform?: GdcApi
	variant2samples?: Variant2Samples
}
