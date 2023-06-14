import { Tvs } from './filter'

type kv = {
    k: string
    v: string
}

interface HiddenValues {
    [index: string]: number
}

export type RangeEntry = {
    start?: number
    startunbounded?: boolean
    startinclusive?: boolean
    stop?: number
    stopunbounded?: boolean
    stopinclusive?: boolean
    label?: string
    value?: string
}

interface BinConfig extends BaseQ {
    termtype?: string
    //regular-sized bins
    bin_size?: number
    startinclusive?: boolean
    stopinclusive?: boolean
    first_bin?: {
        startunbounded: boolean
        stop: number
    },
    last_bin?: {
        start: number
        stopunbounded: boolean
    }
    //binary
    scale?: number //0.1, 0.01 or 0.001.
    lst?: RangeEntry[]
}

interface NumericalBins {
    label_offset?: number
    label_offset_ignored?: boolean
    rounding?: string
    default: BinConfig
    less: BinConfig
}

type LstGroupsEntry = {
    name: string
    type?: string //values or filter
    color?: string
    values: { key: number, label: string }[]
    filter: any //TODO
}

interface GroupSettingLstEntry {
    name: string
    is_grade?: boolean
    is_subcondition?: boolean
    groups: LstGroupsEntry[]
}

interface GroupSetting {
    inuse: boolean
    disabled?: boolean
    useIndex?: number
    predefined_groupset_idx?: number
    lst?: GroupSettingLstEntry[]
    customset?: any //{}
}

interface Gt2Count {
    k: string
    v: number
}

type AllelesEntry = {
    allele: string
    isRef: boolean
    count: number
}

type SnpsEntry = {
    snpid: string
    invalid?: boolean
    effectAllele?: string
    referenceAllele?: string
    altAlleles?: string[]
    alleles?: AllelesEntry[],
    gt2count?: Gt2Count,
    chr?: string
    pos?: number
    alt2csq?: any //{}

}

interface RestrictAncestry {
    name: string
    tvs: Tvs
}

interface BaseQ {
    mode?: string //discrete, binary, continuous, spline, cuminc, cox
    type?: string //values, regular-bin, custom-bin, predefined-groupset, custom-groupset
    modeBinaryCutoffType?: string //normal, percentile
    modeBinaryCutoffPercentile?: number
}

export interface Q extends BaseQ{
    name?: string
    reuseId?: string
    isAtomic?: boolean 
    hiddenValues?: HiddenValues
    knots?: []
    groupsetting?: GroupSetting
    //Condition terms 
    breaks?: number[]
    groupNames?: string[]
    timeScale?: string
    showTimeScale?: boolean
    bar_by_children?: boolean
    bar_by_grade?: boolean
    value_by_max_grade?: boolean
    value_by_most_recent?: boolean
    value_by_computable_grade?: boolean
    computableValuesOnly?: boolean
    //geneVariant
    cnvMaxLength?: number
    cnvMinAbsValue?: number
    //snplst
    cacheid?: string
    AFcutoff?: number
    alleleType?: number
    geneticModel?: number
    missingGenotype?: number
    numOfSampleWithAnyValidGT?: number
    snp2effAle?: kv
    snp2refGrp?: kv
    restrictAncestry?: RestrictAncestry
    //snplocus
    info_fields?: any //[]
    chr?: string
    start?: number
    stop?: number
    //variant_filter???????? No documentation
}

interface TermValues {
    [index: string | number]: {
        uncomputable?: boolean
        label?: string
        order?: string
        color?: string

        //Samplelst values
        key?: string
        inuse?: boolean
        list?: { sampleId: string, sample: string}[]
        filter?: any //{}
    }
}

export interface Term {
    id?: string
    type?: string //samplelst, geneVariant, categorical, integer, float, condition, survival
    name?: string
    min?: number
    max?: number
    tvs?: Tvs
    values?: TermValues,
    unit?: string,
    hashtmldetail?: boolean,
    logScale?: string | number //2, 10, or e only
    child_types?: any //[],
    included_types?: any //[],
    skip0forPercentile?: boolean,
    densityNotAvailable?: boolean //Not used?
    bins?: NumericalBins,
    subconditions?: any //{}
    //snplocus
    reachedVariantLimit?: boolean
    //snplist
    snps?: SnpsEntry[]
}

export interface TW { //Term wrapper aka.. term:{term:{...}, q:{...}...}
    id?: string
    $id?: string
    isAtomic?: boolean
    term: Term
    q: Q
}