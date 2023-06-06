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

interface GDCRangeEntry {
    query: string,
    variables: (p: VariablesRange2VariantsArgs) => void
}

interface ByRangeEntry {
    bcffile?: string,
    file?: string
    infoFields?: InfoFieldsEntry[],
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
    base: string,
    key?: string,
    namekey?: string
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

interface SnvIndel {
    forTrack: boolean,
    byrange: ByRangeEntry,
    variantUrl?: VariantUrl,
    infoUrl?: URLEntry[],
    skewerRim?: SkewerRim
    format4filters?: Array<string>,
    byisoform?: GdcApi,
    m2csp?: M2Csq,
    format?: SnvIndelFormat
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
    values: SelectCohortValuesEntry[]
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

interface FilterValuesEntry {
    dt: number
}

interface TieBreakerFilter {
    values: FilterValuesEntry[]
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

interface Termdb {
    displaySampleIds?: boolean,
    minTimeSinceDx?: number,
    ageEndOffset?: number,
    coxTimeMsg?: string,
    coxStartTimeMsg?: string,
    termIds?: TermIds,
    selectCohort?: SelectCohortEntry,
    dataDownloadCatch?: DataDownloadCatch,
    scatterplots?: Scatterplots,
    termid2totalsize2?: GdcApi,
    additionalSampleAttributes?: Array<string>,
    useLower?: boolean,
    alwaysShowBranchTerms?: boolean,
    matrix?: Matrix,
    matrixplots?: MatrixPlots
    allowedTermTypes?: Array<string>,
    multipleTestingCorrection?: MultipleTestingCorrection
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
	termdb?: Termdb
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

