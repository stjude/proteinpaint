import { VocabApi } from './vocab'
import { Term, Q, TW } from './termdb'
import { Filter } from './filter'

/*
--------EXPORTED--------
Dom
Api
NoTermPromptOptsEntry
UseCase
Handler
PillData
TermSettingOpts

*/

/*** interfaces supporting TermSettingOpts & PillData interfaces ***/

export interface Dom {
    holder: Selection
    tip: any //TODO Menu type??
    tip2: any
    nopilldiv?: Selection
    pilldiv?: Selection
    btnDiv?: Selection
}

export interface Api {
    main: (d: PillData) => void,
    runCallback: (f: any) => void
    showTree: (holder: Selection, event: any) => boolean
    showMenu: (event: any, clickedElem: Selection | null, menuHolder: Selection | null) => void
    showGeneSearch: (event: any, clickedElem: Selection | null) => void
    hasError: () => boolean
    validateQ: (d: Q) => void
}

export type NoTermPromptOptsEntry = {
    isDictionary?: boolean,
    termtype?: string,
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

export interface Handler {
    getPillName: (d: PillData) => string
    showEditMenu: (div: Selection) => void
    validateQ?: (d: Q) => void
    postMain?: () => void
}

interface BaseTermSettingOpts {
    //Optional
    activeCohort?: number
    disable_terms?: string[]
    handler: Handler
    abbrCutoff?: number
    noTermPromptOptions?: NoTermPromptOptsEntry[]
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
    holder: Selection
    vocabApi: VocabApi
    //Optional 
    tip?: any //TODO: Menu type?
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
    $id?: string,
    //'snplocus' types
    genomeObj?: any
    //getBodyParams used but not documented??
    //vocab??
}