/********* server/dataset interfaces *********/

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

interface ByRangeEntry {
    bcffile: string,
    infoFields: InfoFieldsEntry[]
}

interface VariantUrl {
    base: string, 
    key: string,
    linkText: string,
    shownSeparately: boolean
}

interface InfoURLEntry {
    base: string,
    key: string
}

interface SnvIndel {
    forTrack: boolean,
    byrange: ByRangeEntry,
    variantUrl: VariantUrl,
    infoUrl: InfoURLEntry[]
}

interface Queries{
    snvindel: SnvIndel
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

interface Termdb {
    displaySampleIds: boolean,
    minTimeSinceDx: number,
    ageEndOffset: number,
    coxTimeMsg: string,
    coxStartTimeMsg: string,
    termIds: TermIds,
    selectCohort: SelectCohortEntry,
    dataDownloadCatch: DataDownloadCatch,
    scatterplots?: Scatterplots
}

//Shared with genome.ts
export interface Cohort {
	db: { file: string }
	termdb?: Termdb
}

//Separated because throwing error related to cohort
export interface TestMds3 {
    isMds3: boolean,
    cohort: Cohort
}

export interface Mds3 {
    isMds3: boolean,
    dsinfo: DsinfoEntry[],
    genome: string,
    queries: Queries
}