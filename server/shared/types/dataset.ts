/********* server/dataset interfaces ********
 
--------EXPORTED--------
ClinvarClinsig
ClinvarAF
Cohort
Mds3

*/

interface ClinvarCategoriesEntry {
	color: string
	label: string
	desc: string
	textcolor?: string
}

//Shared with genome.ts
export interface ClinvarClinsig {
	[index: string]: ClinvarCategoriesEntry
}

interface NumericFilterEntry {
    side: string,
    value: number
}

interface AFEntry {
    name: string
    locusinfo: { key: string },
    numericfilter: NumericFilterEntry[]
}

export interface ClinvarAF {
    [index: string]: AFEntry
}

interface DsinfoEntry {
    k: string
    v: string
}

/*** types and interfaces supporting Termdb interface ***/

interface InfoFieldsEntry {
    name: string,
    key: string,
    categories: ClinvarClinsig,
    separator: string
}

interface GenomicPositionEntry {
    chr: string,
    start: number,
    stop: number
}

interface VariablesRange2VariantsArgs {
    set_id: string,
    rglst: GenomicPositionEntry[]
}

type Chr2bcffile = { [index: string]: string }

interface GDCRangeEntry {
    query: string,
    variables: (p: VariablesRange2VariantsArgs) => void
}

interface ByRangeEntry {
    bcffile?: string,
    file?: string
    infoFields?: InfoFieldsEntry[],
    chr2bcffile?: Chr2bcffile,
    //GDC
    gdcapi?: GDCRangeEntry
}

interface VariantUrl {
    base: string, 
    key: string,
    linkText?: string,
    shownSeparately?: boolean
}

interface URLEntry {
    base?: string,
    key?: string,
    namekey?: string,
    label?: string,
    url?: string
}

interface SkewerRim {
    type: string,
    formatKey: string,
    rim1value: string,
    noRimValue: string
}

interface GdcApi { gdcapi?: boolean }

interface M2Csq extends GdcApi {
    by: string
}

interface SnvIndelFormatEntry {
    ID: string,
    Description: string,
    Number: string | number,
    Type: string
}

interface SnvIndelFormat {
    [index: string]: SnvIndelFormatEntry
}

interface FilterValues {
    [ index: string | number ]: { label: string }
}

interface RangesEntry {
    start: number, 
    startinclusive: boolean,
    stopunbounded: boolean
}

interface BaseTvsFilter {
    isnot?: boolean,
    ranges?: RangesEntry[]
}

interface TvsFilter extends BaseTvsFilter {
    values?: (string | number)[]
}

interface FilterTermEntry extends BaseTvsFilter {
    parent_id: string | null, 
    isleaf: boolean, 
    values?: FilterValues,
    tvs?: TvsFilter,
    min?: number,
    max?: number
}

interface FilterLstTvs extends BaseTvsFilter {
    term: FilterTermEntry,
    values: (string | number | FilterValues )[]
}

interface FilterLstEntry {
    type: string,
    tvs: FilterLstTvs
}

interface Filter {
    type: string,
    join: string,
    in: boolean,
    lst?: FilterLstEntry[],
}

type VariantFilterOpts = { joinWith: string[] }

interface VariantFilter {
    opts: VariantFilterOpts,
    filter: Filter,
    terms: FilterTermEntry[]
}

interface SnvIndel {
    forTrack?: boolean,
    byrange: ByRangeEntry,
    variantUrl?: VariantUrl,
    infoUrl?: URLEntry[],
    skewerRim?: SkewerRim
    format4filters?: Array<string>,
    byisoform?: GdcApi,
    m2csp?: M2Csq,
    format?: SnvIndelFormat,
    variant_filter?: VariantFilter
}

interface SvFusion {
    byrange: ByRangeEntry
}

interface SingleSampleMutation extends GdcApi {
    sample_id?: string,
    folder?: string
    //For the GDC
    sample_id_key?: string,
}

interface ArgumentsEntry {
    id: string,
    label: string,
    type: string,
    value: boolean
}

interface TopMutatedGenes {
    arguments: ArgumentsEntry[]
}

interface TklstEntry {
    assay?: string,
    type: string,
    name: string,
    sample?: string,
    file: string,
    defaultShown?: boolean
}

interface TrackLstEntry {
    isfacet: boolean,
    name: string,
    tklst: TklstEntry[]
}

interface Queries{
    defaultBlock2GeneMode?: boolean
    snvindel?: SnvIndel,
    svfusion?: SvFusion,
    singleSampleMutation?: SingleSampleMutation
    geneExpression?: { file: string },
    topMutatedGenes?: TopMutatedGenes,
    trackLst?: TrackLstEntry[]
}

/*** types and interfaces supporting Termdb ***/

interface TermIds {
    [index: string]: string
}

interface SelectCohortValuesEntry {
    keys: Array<string>,
    label: string,
    shortLabel: string,
    isdefault?: boolean,
    note?: string
}

interface SelectCohortEntry {
    term: { id: string, type: string },
    prompt: string,
    values: SelectCohortValuesEntry[],
    description?: string,
    asterisk?: string
}

interface MissingAccess{
    message: string,
    links: { [index:string]: string }
}

interface DataDownloadCatch {
    helpLink: string,
    missingAccess: MissingAccess,
    jwt: { [index:string]: string }
}

interface ScatterPlotsEntry {
    name: string,
    dimension: number, 
    file: string, 
    colorTW: { id: string }
}

interface Scatterplots {
    plots: ScatterPlotsEntry[]
}

interface MatrixSettingsControlLabels {
    samples: string,
    sample: string
}

interface TieBreakerFilterValuesEntry {
    dt: number
}

interface TieBreakerFilter {
    values: TieBreakerFilterValuesEntry[]
}

interface TieBreakersEntry {
    by: string,
    order?: Array<string | number>
    filter?: TieBreakerFilter
}

interface SortPriorityEntry {
    types: Array<string>,
    tiebreakers: TieBreakersEntry[]
}

interface MatrixSettings {
    maxSample: number,
    svgCanvasSwitch: number,
    cellEncoding: string,
    cellbg: string,
    controlLabels: MatrixSettingsControlLabels,
    sortSamplesBy: string,
    sortPriority: SortPriorityEntry[]
}

interface Mclass {
    [index: string]: { color: string }
}

interface Matrix {
    settings: MatrixSettings,
    geneVariantCountSamplesSkipMclass: Array<string>,
    mclass: Mclass
}

interface MatrixPlotsEntry {
    name: string,
    file: string,
    getConfig: (f: any) => void,
}

interface MatrixPlots {
    plots: MatrixPlotsEntry[]
}

interface AllowCaseDetails {
    sample_id_key: string,
    terms: Array<string>
}

interface MultipleTestingCorrection {
    method: string,
    skipLowSampleSize: boolean
}

interface TvsTerm {
    id: string, 
    type: string,
    name: string
}

interface TvsValues {
    key?: string,
    label: string
}

interface Tvs {
    term: TvsTerm,
    values: TvsValues[],
}

interface PCfileBySubcohort {
    [index: string]: { file: string }
}

interface RestrictAncestriesEntry {
    name: string
    tvs: Tvs,
    PCcount: number,
    PCfileBySubcohort: PCfileBySubcohort
}

/*** types and interfaces supporting Cohort interface ***/
interface Termdb { 
    displaySampleIds?: boolean,
    minTimeSinceDx?: number,
    ageEndOffset?: number,
    //Cox
    coxTimeMsg?: string,
    coxStartTimeMsg?: string,
    termIds?: TermIds,
    selectCohort?: SelectCohortEntry,
    dataDownloadCatch?: DataDownloadCatch,
    termid2totalsize2?: GdcApi,
    additionalSampleAttributes?: Array<string>,
    useLower?: boolean,
    alwaysShowBranchTerms?: boolean,
    //Plots
    scatterplots?: Scatterplots,
    matrix?: Matrix,
    matrixplots?: MatrixPlots
    allowedTermTypes?: Array<string>,
    multipleTestingCorrection?: MultipleTestingCorrection,
    logscaleBase2?: boolean,
    minimumSampleAllowed4filter?: number
    restrictAncestries?: RestrictAncestriesEntry[],
    helpPages?: URLEntry[],
    //For the GDC
    dictionary?: GdcApi,
    allowCaseDetails?: AllowCaseDetails
}

type SimpleTermEntry = { 
    id: string, 
    q: {}, 
    baseURL?: string //Only appears as a quick fix in SAMD9-SAMD9L.hg19?
}

interface Variant2Samples extends GdcApi {
    variantkey: string,
    twLst: SimpleTermEntry[],
    sunburst_twLst?: SimpleTermEntry[],
    url?: URLEntry,
}

interface MutationSet {
    snvindel: string,
    cnv: string,
    fusion: string
}

interface BaseDtEntry {
    term_id: string,
    yes: { value: Array<string> },
    no: { value: Array<string> }
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

interface AssayAvailability {
    byDt: ByDt
}

//Shared with genome.ts
export interface Cohort {
    allowedChartTypes?: Array<string>,
    mutationset?: MutationSet[],
	db: { file: string }
	termdb?: Termdb,
    scatterplots?: Scatterplots
}

export interface Mds3 {
    isMds3: boolean,
    dsinfo?: DsinfoEntry[],
    genome?: string,
    queries?: Queries,
    cohort?: Cohort,
    termdb?: Termdb,
    validate_filter0?: (f: any) => void,
    ssm2canonicalisoform?: GdcApi,
    variant2samples?: Variant2Samples,
    assayAvailability?: AssayAvailability
}

