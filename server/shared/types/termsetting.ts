import { VocabApi } from './vocab'

interface Dom {
    holder: any, 
    tip: any, 
    tip2: any
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

export interface TermSettingOpts {
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
    vocabApi: any
    activeCohort: number
    disable_terms?: string[]
    usecase?: UseCase
    abbrCutoff?: number
    durations: { exit: number}
    numqByTermIdModeType?: any //{}
    dom: Dom,
    error: any
    handler: any
}