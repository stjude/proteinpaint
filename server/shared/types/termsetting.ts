import { VocabApi } from './vocab'
import { Term, Q, TW, BinConfig } from './termdb'
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

export type Dom = {
	holder: Selection
	tip: any //TODO Menu type??
	tip2: any //same as above
	nopilldiv?: Selection
	pilldiv?: Selection
	btnDiv?: Selection
}

export type Api = {
	main: (d: PillData) => void
	runCallback: () => void
	showTree: (holder: Selection, event: MouseEvent) => boolean
	showMenu: (event: MouseEvent, clickedElem: Selection | null, menuHolder: Selection | null) => void
	showGeneSearch: (clickedElem: Element | null, event: MouseEvent) => void
	hasError: () => boolean
	validateQ: (d: Q) => void
}

export type NoTermPromptOptsEntry = {
	isDictionary?: boolean
	termtype?: string
	text?: string
	html?: string
	q?: Q
}

type NumericContEditOptsEntry = {
	scale: string
	transform: string
}

export type UseCase = {
	target: string
	detail?: string //Maybe?
	regressionType?: string //Maybe?
	term1type?: string //Maybe? not documented
}

type DefaultQ4fillTW = {
	[index: string]: Q
}

export type SampleCountsEntry = {
	key: string
	value: number //This maybe a string???
	label?: string //Not documented?? in key or no?
}

export type Handler = {
	getPillName: (d: any) => string
	getPillStatus: (f?: any) => any
	showEditMenu: (div: Selection) => void
	validateQ?: (d: Q) => void
	postMain?: () => void
}

interface BaseTermSettingOpts {
	//Optional
	abbrCutoff?: number
	activeCohort?: number
	disable_terms?: string[]
	handler: Handler
	noTermPromptOptions?: NoTermPromptOptsEntry[]
}

export interface PillData extends BaseTermSettingOpts {
	$id?: string
	doNotHideTipInMain: boolean
	dom: Dom
	error?: string
	filter?: Filter
	q?: Q
	sampleCounts?: SampleCountsEntry[]
	term?: Term
}

export interface TermSettingOpts extends BaseTermSettingOpts {
	//Required
	holder: any
	vocabApi: VocabApi
	//Optional
	$id?: string
	buttons?: string[] //replace, delete, info
	defaultQ4fillTW?: DefaultQ4fillTW
	menuOptions: string //all, edit, replace, remove
	menuLayout?: string //horizonal, all
	numericEditMenuVersion?: string[]
	numericContinuousEditOptions?: NumericContEditOptsEntry[]
	placeholder?: string
	placeholderIcon?: string //default '+'
	renderAs: string //none
	showTimeScale?: boolean //Not used?
	tip?: any //TODO: Menu type?
	use_bins_less?: boolean
	usecase?: UseCase
	debug?: boolean | number //true or 1
	//'snplocus' types
	genomeObj?: any
	//getBodyParams used but not documented??
	//vocab??

	//Methods
	callback?: (f: TW | null) => void
	customFillTw?: (f: TW) => void
	getBodyParams: () => any
}

/*** types and interfaces supporting TermSettingInstance type ***/
type NumObjRangeEntry = any //{}

export type BrushEntry = {
	//No documentation!
	orig: string
	range: {
		start: number
		stop: number
	}
	init: () => void
}

type DensityData = {
	maxvalue: number
	minvalue: number
}

type PlotSize = {
	width: number
	height: number
	xpad: number
	ypad: number
}

export type NumberObj = {
	binsize_g?: any //dom element??
	brushes?: BrushEntry[]
	density_data?: DensityData
	no_density_data?: true
	plot_size?: PlotSize
	ranges?: NumObjRangeEntry[]
	svg?: any
	xscale?: any
}

type InstanceDom = {
	//Separate from the Dom outlined in termsetting.ts?????
	//Required
	holder: any
	tip: any //TODO Menu type??
	tip2: any //same as above
	nopilldiv?: any
	pilldiv?: any
	btnDiv?: any
	//Optional
	bins_div?: any
	bins_table?: any
	boundaryInput?: any
	customBinBoundaryInput?: any
	customBinBoundaryPercentileCheckbox?: any
	customBinLabelInput?: any
	customBinRanges?: any
	cutoff_div?: any
	num_holder?: any
	pill_termname?: any
	rangeAndLabelDiv?: any
}

export type TermSettingInstance = {
	activeCohort?: number
	clickNoPillDiv?: any
	dom: InstanceDom
	doNotHideTipInMain?: boolean
	disable_terms?: string[]
	durations: { exit: number }
	filter?: Filter
	handler?: Handler
	handlerByType?: { [index: string]: Handler }
	hasError?: boolean
	noTermPromptOptions?: NoTermPromptOptsEntry[]
	num_obj?: NumberObj
	numqByTermIdModeType?: any
	opts: TermSettingOpts
	placeholder: string | undefined
	q: Q
	term: Term
	usecase?: UseCase
	vocabApi: VocabApi
	//Methods
	cancelGroupsetting?: () => void
	enterPill?: () => void
	exitPill?: () => void
	initUI: () => void
	removeTerm?: () => void
	renderBinLines?: (self: any, q: Q) => void
	runCallback?: (f?: any) => any
	setHandler?: (f: string) => any
	showGeneSearch: (clickedElem: Element | null, event: MouseEvent) => void
	showMenu: (event: MouseEvent, clickedElem: string | null, menuHolder: any) => void
	showReuseMenu?: (div: any) => void
	showTree: (holder: Selection, event?: MouseEvent) => void
	tabCallback?: (event: any, tab: any) => void
	updatePill?: () => void
	updateUI: () => void
}
