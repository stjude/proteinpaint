interface Dom {
    holder: any, 
    tip: any, 
    tip2: any
}

export interface Api {
    main: (f: any) => void,
    runCallback: (f: any) => void
    showTree: boolean
    showMenu: boolean
    showGeneSearch: boolean
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

interface TermSettingOpts {
    placeholder?: string,
    placeholderIcon?: string,
    vocabApi: any,
    activeCohort: number,
    disable_terms?: string[],
    usecase?: UseCase,
    abbrCutoff?: number,
}

export interface Input extends TermSettingOpts{
    holder: any
    tip?: any,
    genomeObj?: any,
    menuOptions: string,
    menuLayout?: string,
    noTermPromptOptions?: NoTermPromptOptions,
    buttons?: string[],
    callback?: (f:any) => void,
    defaultQ4fillTW?: DefaultQ4fillTW,
    customFillTW?: CustomFillTW
    use_bins_less?: boolean,
    numericEditMenuVersion?: string[],
    numericContinuousEditOptions: string[]
    showTimeScale?: boolean,
    renderAs: string
}

export interface Return extends TermSettingOpts {
    durations: { exit: number}
    numqByTermIdModeType: {}
    dom: Dom
}
