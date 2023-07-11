/********* private and public datasets ********
 
--------EXPORTED--------
ClinvarClinsig
ClinvarAF
Cohort
Mds3

Termdb
*/

/*** General usage types and interfaces ***/
type FileObj = { file: string }

interface KeyVal {
	k: string
	v?: string
}

interface KeyLabel {
	key: string
	label: string
}

/*** interfaces specific to ClinVar ***/

interface ClinvarCategoriesEntry {
	color: string
	label?: string
	desc: string
	textcolor?: string
	name?: string
}

//Shared with genome.ts
export interface ClinvarClinsig {
	[index: string]: ClinvarCategoriesEntry
}

interface NumericFilterEntry {
	side: string
	value: number
}

interface AFEntry {
	name: string
	locusinfo: { key: string }
	numericfilter: NumericFilterEntry[]
}

export interface ClinvarAF {
	[index: string]: AFEntry
}

/*** types and interfaces supporting Queries interface ***/

interface InfoFieldsEntry {
	name: string
	key: string
	categories: ClinvarClinsig
	separator: string
}

interface GenomicPositionEntry {
	chr: string
	start: number
	stop: number
}

interface VariablesRange2VariantsArgs {
	set_id: string
	rglst: GenomicPositionEntry[]
}

type Chr2bcffile = { [index: string]: string }

interface GDCRangeEntry {
	query: string
	variables: (p: VariablesRange2VariantsArgs) => void
}

interface ByRangeEntry {
	bcffile?: string
	file?: string
	infoFields?: InfoFieldsEntry[]
	chr2bcffile?: Chr2bcffile
	//GDC
	gdcapi?: GDCRangeEntry
}

interface VariantUrl {
	base: string
	key: string
	linkText?: string
	shownSeparately?: boolean
}

interface URLEntry {
	base?: string
	key?: string
	namekey?: string
	label?: string
	url?: string
}

interface SkewerRim {
	type: string
	formatKey: string
	rim1value: string
	noRimValue: string
}

interface GdcApi {
	gdcapi?: boolean
}

interface M2Csq extends GdcApi {
	by: string
}

interface SnvIndelFormatEntry {
	ID: string
	Description: string
	Number: string | number
	Type: string
}

interface SnvIndelFormat {
	[index: string]: SnvIndelFormatEntry
}

interface FilterValues {
	[index: string | number]: { label: string }
}

interface RangesEntry {
	start: number
	startinclusive: boolean
	stopunbounded: boolean
}

interface BaseTvsFilter {
	isnot?: boolean
	ranges?: RangesEntry[]
}

interface TvsFilter extends BaseTvsFilter {
	values?: (string | number)[]
}

interface FilterTermEntry extends BaseTvsFilter {
	parent_id: string | null
	isleaf: boolean
	values?: FilterValues
	tvs?: TvsFilter
	min?: number
	max?: number
}

interface FilterLstTvs extends BaseTvsFilter {
	term: FilterTermEntry
	values: (string | number | FilterValues)[]
}

interface FilterLstEntry {
	type: string
	tvs: FilterLstTvs
}

interface Filter {
	type: string
	join: string
	in: boolean
	lst?: FilterLstEntry[]
}

type VariantFilterOpts = { joinWith: string[] }

interface VariantFilter {
	opts: VariantFilterOpts
	filter: Filter
	terms: FilterTermEntry[]
}

interface SnvIndel {
	forTrack?: boolean
	byrange: ByRangeEntry
	variantUrl?: VariantUrl
	infoUrl?: URLEntry[]
	skewerRim?: SkewerRim
	format4filters?: string[]
	byisoform?: GdcApi
	m2csp?: M2Csq
	format?: SnvIndelFormat
	variant_filter?: VariantFilter
}

interface SvFusion {
	byrange: ByRangeEntry
}

interface SingleSampleMutation extends GdcApi {
	sample_id?: string
	folder?: string
	sample_id_key?: string
	discoSkipChrM?: boolean
}

interface ArgumentsEntry {
	id: string
	label: string
	type: string
	value: boolean
}

interface TopMutatedGenes {
	arguments: ArgumentsEntry[]
}

interface TklstEntry {
	assay?: string
	type: string
	name: string
	sample?: string
	file: string
	defaultShown?: boolean
}

interface TrackLstEntry {
	isfacet: boolean
	name: string
	tklst: TklstEntry[]
}

interface CnvSegment {
	byrange?: CnvSegmentByRange
	gdcapi?: boolean
}
interface CnvSegmentByRange {
	file: string
}

/*
file content is a probe-by-sample matrix, values are signals
for a given region, the median signal from probes in the region is used to make a gain/loss call for each sample
this is alternative to CnvSegment
*/
interface Probe2Cnv {
	file: string
}

interface Queries {
	defaultBlock2GeneMode?: boolean
	snvindel?: SnvIndel
	svfusion?: SvFusion
	probe2cnv?: Probe2Cnv
	cnv?: CnvSegment
	singleSampleMutation?: SingleSampleMutation
	geneExpression?: FileObj
	topMutatedGenes?: TopMutatedGenes
	trackLst?: TrackLstEntry[]
}

/*** types and interfaces supporting Termdb ***/

interface TermIds {
	[index: string]: string
}

interface SelectCohortValuesEntry {
	keys: string[]
	label: string
	shortLabel: string
	isdefault?: boolean
	note?: string
}

interface SelectCohortEntry {
	term: { id: string; type: string }
	prompt: string
	values: SelectCohortValuesEntry[]
	description?: string
	asterisk?: string
}

interface MissingAccess {
	message: string
	links: { [index: string]: string }
}

interface DataDownloadCatch {
	helpLink: string
	missingAccess: MissingAccess
	jwt: { [index: string]: string }
}

//Plots

interface ScatterPlotsEntry {
	name: string
	dimension: number
	file: string
	colorTW: { id: string }
}

interface Scatterplots {
	plots: ScatterPlotsEntry[]
}

interface MatrixSettingsControlLabels {
	samples: string
	sample: string
}

interface ExcludeClasses {
	[index: string]: number
}

type FeatureAttrs = {
	valuecutoff?: number
	focalsizelimit?: number
	excludeclasses?: ExcludeClasses
}

interface CommonFeatureAttributes {
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

interface MatrixConfig {
	header: string
	hidelegend_features: number
	features: MatrixConfigFeaturesEntry[]
	limitsamplebyeitherannotation: LimitSampleByEitherAnnotationEntry[]
}

interface GroupsEntry {
	name: string
	matrixconfig: MatrixConfig
}

interface Group {
	groups: GroupsEntry[]
}

interface AnnotationSampleGroups {
	[index: string]: Group
}

interface AaaAnnotationSampleset2Matrix {
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

interface SurvPlots {
	[index: string]: SurvPlotsEntry
}

type sampleGroupAttrLstEntry = { key: string }

interface SurvivalPlot {
	plots: SurvPlots
	samplegroupattrlst: sampleGroupAttrLstEntry[]
}

interface TieBreakerFilterValuesEntry {
	dt: number
}

interface TieBreakerFilter {
	values: TieBreakerFilterValuesEntry[]
}

interface TieBreakersEntry {
	by: string
	order?: (string | number)[]
	filter?: TieBreakerFilter
}

interface SortPriorityEntry {
	types: string[]
	tiebreakers: TieBreakersEntry[]
}

interface MatrixSettings {
	maxSample: number
	svgCanvasSwitch: number
	cellEncoding: string
	cellbg: string
	controlLabels: MatrixSettingsControlLabels
	sortSamplesBy: string
	sortPriority: SortPriorityEntry[]
}

interface Mclass {
	[index: string]: { color: string }
}

interface Matrix {
	settings: MatrixSettings
	geneVariantCountSamplesSkipMclass: Array<string>
	mclass: Mclass
}

interface MatrixPlotsEntry {
	name: string
	file: string
	getConfig: (f: any) => void
}

interface MatrixPlots {
	plots: MatrixPlotsEntry[]
}

interface AllowCaseDetails {
	sample_id_key: string
	terms: string[]
}

interface MultipleTestingCorrection {
	method: string
	skipLowSampleSize: boolean
}

interface TvsTerm {
	id: string
	type: string
	name: string
}

interface TvsValues {
	key?: string
	label: string
}

interface Tvs {
	term: TvsTerm
	values: TvsValues[]
}

interface PCfileBySubcohort {
	[index: string]: FileObj
}

interface RestrictAncestriesEntry {
	name: string
	tvs: Tvs
	PCcount: number
	PCfileBySubcohort: PCfileBySubcohort
}

/*** types and interfaces supporting Cohort interface ***/
interface Termdb {
	//Terms
	termIds?: TermIds
	displaySampleIds?: boolean
	allowedTermTypes?: string[]
	alwaysShowBranchTerms?: boolean
	minimumSampleAllowed4filter?: number
	minTimeSinceDx?: number
	ageEndOffset?: number
	alwaysRefillCategoricalTermValues?: boolean
	restrictAncestries?: RestrictAncestriesEntry[]
	//Cohort specific
	selectCohort?: SelectCohortEntry
	additionalSampleAttributes?: string[]
	//Cox
	coxTimeMsg?: string
	coxStartTimeMsg?: string
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

interface Variant2Samples extends GdcApi {
	variantkey: string
	twLst: SimpleTermEntry[]
	sunburst_twLst?: SimpleTermEntry[]
	url?: URLEntry
}

interface MutationSet {
	snvindel: string
	cnv: string
	fusion: string
}

interface BaseDtEntry {
	term_id: string
	yes: { value: string[] }
	no: { value: string[] }
}

interface SNVByOrigin {
	[index: string]: BaseDtEntry
}

interface SNVByOrigin {
	[index: string]: BaseDtEntry
}

interface DtEntrySNV {
	byOrigin: SNVByOrigin
}

interface ByDt {
	//SNVs differentiate by sample origin. Non-SNV, no differentiation
	[index: number]: DtEntrySNV | BaseDtEntry
}

interface AssayValuesEntry {
	[index: string]: { label: string; color: string }
}

type AssaysEntry = {
	id: string
	name: string
	type: string
	values?: AssayValuesEntry
}

interface AssayAvailability {
	byDt?: ByDt
	file?: string
	assays?: AssaysEntry[]
}

//Shared with genome.ts
export interface Cohort {
	allowedChartTypes?: string[]
	mutationset?: MutationSet[]
	db: FileObj
	termdb?: Termdb
	scatterplots?: Scatterplots
}
/*** types and interfaces supporting MdsCohort interface ***/
interface SampleAttribute {
	attributes: Attributes
}

type HierarchiesLstEntry = {
	name: string
	levels: KeyLabelFull[]
}

interface Hierarchies {
	lst: HierarchiesLstEntry[]
}

type SetSamples = {
	file: string
	valuename: string
	skipzero: boolean
}

interface SetSignatures {
	[index: number]: { name: string; color: string }
}

interface MutSigSets {
	[index: string]: {
		name: string
		samples: SetSamples
		signatures: SetSignatures
	}
}

interface MutationSignature {
	sets: MutSigSets
}

interface MdsCohort {
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

/*** types and interfaces supporting MdsQueries interface ***/
interface BaseTrack {
	name?: string
	istrack?: boolean
	type?: string
	file?: string
	hideforthemoment?: number
	viewrangeupperlimit?: number
}

interface LegendVOrigin {
	key: string
	somatic: string
	germline: string
}

interface GroupSampleByAttr {
	attrlst: KeyLabelFull[]
	sortgroupby?: {
		key: string
		order: string[]
	}
	attrnamespacer?: string
}

interface Svcnv extends BaseTrack {
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

interface BoxPlotAdditionalsEntry {
	label: string
	attributes: KeyVal[]
}

interface BoxPlotBySampleGroup {
	attributes: KeyLabelFull[]
	additionals?: BoxPlotAdditionalsEntry[]
}

interface Fpkm extends BaseTrack {
	datatype: string
	itemcolor: string
}

interface GeneFpkm extends Fpkm {
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

interface ValuePerSample extends KeyLabel {
	cutoffValueLst: CutoffValueLstEntry[]
}

interface InfoFilterCatEntry {
	label: string
	color: string
	valuePerSample?: ValuePerSample
}

interface InfoFilterCat {
	[index: string]: InfoFilterCatEntry
}

interface InfoFilterLstEntry extends KeyLabel {
	categories: InfoFilterCat
	hiddenCategories: { Unannotated: number }
}

interface InfoFilter {
	lst: InfoFilterLstEntry[]
}

interface ReadCountBoxPlotPerCohort {
	groups: KeyLabel[]
}

interface SingleJunctionSummary {
	readcountboxplotpercohort: ReadCountBoxPlotPerCohort
}

interface Junction extends BaseTrack {
	readcountCutoff: number
	infoFilter: InfoFilter
	singlejunctionsummary: SingleJunctionSummary
}

interface MdsSnvindel extends BaseTrack {
	tracks: BaseTrack[]
	singlesamples?: {
		tablefile: string
	}
}

interface SomaticCnv extends BaseTrack {
	valueLabel: string
	valueCutoff: number
	bplengthUpperLimit: number
}

interface Vcf extends BaseTrack {
	tracks: BaseTrack[]
}

interface MdsQueries {
	svcnv?: Svcnv
	genefpkm?: GeneFpkm
	junction?: Junction
	snvindel?: MdsSnvindel
	somaticcnv?: SomaticCnv
	vcf?: Vcf
	fpkm?: Fpkm
}

interface AttrValues {
	[index: string]: {
		name?: string
		label?: string
		color?: string
	}
}

interface AttributesEntry {
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

interface Attributes {
	[index: string]: AttributesEntry
}

interface MutationAttribute {
	attributes: Attributes
}

type MutationTypesEntry = {
	db_col: string
	label?: string
	default: number
	sizecutoff?: string
	log2cutoff?: number
}

interface Gene2MutCount {
	dbfile: string
	mutationTypes: MutationTypesEntry[]
}

interface LocusAttribute {
	attributes: Attributes
}

/*** types and interfaces supporting Mds Dataset interfaces ***/
interface BaseMds {
	genome?: string //Not declared in TermdbTest
	assayAvailability?: AssayAvailability
}

export interface Mds extends BaseMds {
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

export interface Mds3 extends BaseMds {
	isMds3: boolean
	dsinfo?: KeyVal[]
	queries?: Queries
	cohort?: Cohort
	termdb?: Termdb
	validate_filter0?: (f: any) => void
	ssm2canonicalisoform?: GdcApi
	variant2samples?: Variant2Samples
}
