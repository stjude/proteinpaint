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

interface Queries{
    defaultBlock2GeneMode?: boolean
    snvindel: SnvIndel,
    svfusion?: SvFusion,
    singleSampleMutation?: SingleSampleMutation
    geneExpression?: { file: string },
    topMutatedGenes?: TopMutatedGenes
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

interface PlotsEntry {
    name: string,
    dimension: number, 
    file: string, 
    colorTW: { id: string }
}

interface Scatterplots {
    plots: PlotsEntry[]
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

interface AllowCaseDetails {
    sample_id_key: string,
    terms: Array<string>
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
    termid2totalsize2: {}, //Empty in ash.hg38
    additionalSampleAttributes?: Array<string>,
    useLower?: boolean,
    alwaysShowBranchTerms?: boolean,
    matrix?: Matrix
    //For the GDC
    termid2totalsize?: GdcApi,
    dictionary?: GdcApi,
    allowCaseDetails?: AllowCaseDetails
}

type BaseTermEntry = { id: string, q: {} }

interface Variant2Samples extends GdcApi {
    variantkey: string,
    twLst: BaseTermEntry[],
    sunburst_twLst: BaseTermEntry[],
    url?: URLEntry,
}

//Shared with genome.ts
export interface Cohort {
    allowedChartTypes: Array<string>
	db: { file: string }
	termdb?: Termdb
}

export interface Mds3 {
    isMds3: boolean,
    dsinfo?: DsinfoEntry[],
    genome?: string,
    queries?: Queries,
    termdb?: Termdb,
    validate_filter0?: (f: any) => void,
    ssm2canonicalisoform?: GdcApi,
    variant2samples?: Variant2Samples
}

