import type {
	TermSettingOpts,
	PillData,
	UseCase,
	SampleCountsEntry,
	NoTermPromptOptsEntry,
	VocabApi,
	TermSettingApi
} from './types'
import type { Term, Filter, Q } from '#types'
import { Menu } from '#dom'
import { TermTypes, isDictionaryType } from '#shared/terms.js'
import { minimatch } from 'minimatch'

export class TermSettingInner {
	opts: TermSettingOpts
	vocabApi: VocabApi
	dom: {
		[name: string]: any // d3-selection
	} // Dom //opts.holder is required

	//Optional opts, hence undefined type
	activeCohort?: number
	placeholder?: string
	durations: { exit: number } = { exit: 0 }
	disable_terms?: Term[] = []
	usecase?: UseCase
	abbrCutoff?: number
	$id?: string
	sampleCounts?: SampleCountsEntry[]
	noTermPromptOptions?: NoTermPromptOptsEntry[]

	//Optional opts in script, not init()
	doNotHideTipInMain: boolean = false

	//Created
	hasError: boolean = false
	api: TermSettingApi
	numqByTermIdModeType: any //{}
	handlerByType: {
		[termType: string]: any // TODO: define handler api
	} = {}
	showTree: any
	showGeneSearch: any
	showMenu: any
	initUI: any
	updateUI: any

	//Pill data
	term: any
	q!: Q
	data: any
	error: string | undefined
	filter: Filter | undefined

	constructor(opts: TermSettingOpts) {
		this.opts = opts
		this.api = opts.api
		this.vocabApi = opts.vocabApi
		this.dom = this.getDom(opts)
	}

	getDom(opts) {
		const tip =
			opts.tip ||
			new Menu({
				padding: '0px',
				parent_menu: this.opts.holder && this.opts.holder.node() && this.opts.holder.node().closest('.sja_menu_div')
			})

		return {
			holder: opts.holder,
			tip,
			// tip2 is for showing inside tip, e.g. in snplocus UI
			tip2: new Menu({
				padding: '0px',
				parent_menu: this.dom.tip.d.node()
			})
		}
	}

	validateMainData(d: PillData) {
		if (d.term) {
			// term is optional
			if (!d.term.type) throw 'data.term.type missing'
			// hardcode non
			if (isDictionaryType(d.term.type)) {
				if (!d.term.id && d.term.type != TermTypes.SAMPLELST) throw 'data.term.id missing'
				if (!d.term.name) throw 'data.term.name missing'
			}
		}
		if (!d.q) d.q = {}
		if (typeof d.q != 'object') throw 'data.q{} is not object'
		if (d.disable_terms) {
			if (!Array.isArray(d.disable_terms)) throw 'data.disable_terms[] is not array'
		}
		this.mayValidate_noTermPromptOptions(d)
	}

	validateMenuOptions(o: TermSettingOpts) {
		if (!o.menuOptions) o.menuOptions = defaultOpts.menuOptions
		// support legacy options, now converted to use glob-style pattern matching
		if (o.menuOptions == 'all') o.menuOptions = '*'
		// skip reuse option
		for (const opt of ['edit', /*'reuse',*/ 'replace', 'remove']) {
			if (minimatch(opt, o.menuOptions)) return // matched at least one menu option
		}
		throw `no matches found for termsetting opts.menuOptions='${o.menuOptions}'`
	}

	mayValidate_noTermPromptOptions(o) {
		//: TermSettingOpts | PillData) {
		if (!o.noTermPromptOptions) return
		if (!Array.isArray(o.noTermPromptOptions)) throw 'noTermPromptOptions[] is not array'
		// allow empty array
		for (const t of o.noTermPromptOptions) {
			if (t.isDictionary) {
				// allowed
			} else {
				// otherwise, must be a non-dict term type
				if (!t.termtype) throw 'element of noTermPromptOptions[] missing both isDictionary=true and .termtype'
			}
			if (!t.text && !t.html) throw 'element of noTermPromptOptions[] missing both .text and .html'
			if (t.q && typeof t.q != 'object') throw 'type.q{} is not object'
		}
		this.noTermPromptOptions = o.noTermPromptOptions
	}
}

type MenuOptions = string // 'edit|replace|save|remove|reuse'
type MenuLayout = 'vertical' | 'horizontal'

const defaultOpts: { menuOptions: MenuOptions; menuLayout: MenuLayout } = {
	menuOptions: 'edit',
	menuLayout: 'vertical'
}
