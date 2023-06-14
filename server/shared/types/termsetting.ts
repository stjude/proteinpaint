import { VocabApi } from './vocab'
import { Term, Q, TW } from './termdb'
import { Filter } from './filter'

export interface Dom {
    holder: any, 
    tip: any, 
    tip2: any
    nopilldiv?: any
    pilldiv?: any
    btnDiv?: any
}

export interface Api {
    main: (f: any) => void,
    runCallback: (f: any) => void
    showTree: () => boolean
    showMenu: (f: any) => void
    showGeneSearch: (f: any) => void
    hasError: () => boolean
    validateQ: (d: Q) => void
}

export type NoTermPromptOptions = {
    isDictionary?: boolean,
    termType?: string,
    text?: string,
    html?: string
    q?: Q
}

interface NumericContEditOptsEntry{
    scale: string
    transform: string
}

export interface UseCase {
    target: string
    detail?: string //Maybe?
    regressionType?: string //Maybe?
    term1type?: string //Maybe? not documented
}

interface DefaultQ4fillTW {
    [index: string]: Q
}

type SampleCountsEntry = {
    k: string
    v: number //This maybe a string???
}

type Handler = {
    defaultHandler?: string
}

interface BaseTermSettingOpts {
    //Optional
    activeCohort?: number
    disable_terms?: string[]
    handler: Handler
    abbrCutoff?: number
    noTermPromptOptions?: NoTermPromptOptions
}

export interface PillData extends BaseTermSettingOpts {
    doNotHideTipInMain: boolean
    dom: Dom
    term?: Term
    q?: Q
    $id?: string
    filter?: Filter
    sampleCounts?: SampleCountsEntry[]
    error?: string
}

export interface TermSettingOpts extends BaseTermSettingOpts{
    //Required
    holder: any
    vocabApi: VocabApi
    //Optional 
    tip?: any
    genomeObj?: any
    menuOptions: string //all, edit, replace, remove
    menuLayout?: string //horizonal, all
    buttons?: string[] //replace, delete, info
    callback?: (f:TW) => void
    defaultQ4fillTW?: DefaultQ4fillTW
    customFillTW?: (f:TW) => void
    use_bins_less?: boolean
    numericEditMenuVersion?: string[]
    numericContinuousEditOptions?: NumericContEditOptsEntry[]
    showTimeScale?: boolean //Not used?
    renderAs: string //none
    placeholder?: string
    placeholderIcon?: string
    usecase?: UseCase
    debug?: boolean | number //true or 1
    $id?: string
}