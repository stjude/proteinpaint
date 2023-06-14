import { VocabApi } from './vocab'
import { Term, Q } from './termdb'
import { Filter } from './filter'

interface Dom {
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
    showTree: (f: any) => void
    showMenu: (f: any) => void
    showGeneSearch: (f: any) => void
    hasError: () => boolean
    validateQ: (d: any) => void
}

interface NoTermPromptOptions {
    isDictionary?: boolean,
    text?: string,
    termType?: string,
    html?: string
    q?: any
}

interface UseCase {
    target: string
}

interface DefaultQ4fillTW {

}

interface CustomFillTW {

}

type SampleCountsEntry = {
    k: string
    v: number //This maybe a string???
}

type Handler = {
    defaultHandler?: string
}

interface BaseTermSettingData {
    activeCohort?: number
    disable_terms?: string[]
    handler: Handler
    abbrCutoff?: number
}

export interface Data extends BaseTermSettingData {
    doNotHideTipInMain: boolean
    dom: Dom
    hasError: boolean
    term: Term
    q: Q
    $id?: string
    filter?: Filter
    sampleCounts?: SampleCountsEntry[]
}

export interface TermSettingOpts extends BaseTermSettingData{
    holder: any
    tip?: any
    genomeObj?: any
    menuOptions: string
    menuLayout?: string
    noTermPromptOptions?: NoTermPromptOptions
    buttons?: string[],
    callback?: (f:any) => void
    defaultQ4fillTW?: DefaultQ4fillTW
    customFillTW?: CustomFillTW
    use_bins_less?: boolean
    numericEditMenuVersion?: string[]
    numericContinuousEditOptions: string[]
    showTimeScale?: boolean
    renderAs: string
    placeholder?: string
    placeholderIcon?: string
    vocabApi: VocabApi
    usecase?: UseCase
    durations: { exit: number}
    numqByTermIdModeType?: any //{}
    dom: Dom,
    error: any
}