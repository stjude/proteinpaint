import type {
	TermSettingOpts,
	PillData,
	UseCase,
	SampleCountsEntry,
	NoTermPromptOptsEntry,
	VocabApi,
	Handler
} from './types'
import type { TermSettingApi } from './TermSettingApi.ts'
import type { Term, Filter, Q, TermWrapper } from '#types'
import { TwBase /*CatValues, CatPredefinedGS, CatCustomGS*/ } from '#tw'
import { Menu } from '#dom'
import { TermTypes, isDictionaryType } from '#shared/terms.js'
import { minimatch } from 'minimatch'
import { HandlerBase } from './HandlerBase.ts'
import { TermSettingView } from './TermSettingView.ts'
import { TermSettingActions } from './TermSettingActions.ts'

type MenuOptions = string // 'edit|replace|save|remove|reuse'
type MenuLayout = 'vertical' | 'horizontal'
type CustomMenuOptions = { label: string; callback: (tw: TermWrapper) => void }

const defaultOpts = {
	menuOptions: 'edit' satisfies MenuOptions,
	menuLayout: 'vertical' satisfies MenuLayout,
	customMenuOptions: [] satisfies CustomMenuOptions[]
}

export class TermSetting {
	opts: any // Required<TermSettingOpts>
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
	numqByTermIdModeType: { [twId: string]: { [mode: string]: any /* should be numeric q */ } } = {}

	//tw: TermWrapper
	view: TermSettingView
	actions: TermSettingActions

	handler: Handler
	handlerByType: {
		[termType: string]: any // TODO: define handler api
	} = {}
	// showTree: any
	// showGeneSearch: any
	// showMenu: any
	// initUI: any
	// updateUI: any

	//Pill data
	tw!: TwBase //CatValues | CatPredefinedGS | CatCustomGS
	term: any
	q!: Q
	data: any
	error: string | undefined
	filter: Filter | undefined
	groups?: any

	constructor(opts: TermSettingOpts) {
		this.opts = this.validateOpts(opts)
		this.api = opts.api
		this.vocabApi = opts.vocabApi
		this.dom = this.getDom(opts)

		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder as string
		this.durations = { exit: 0 }
		this.disable_terms = opts.disable_terms
		this.usecase = opts.usecase
		this.abbrCutoff = opts.abbrCutoff

		this.handler = new HandlerBase({ termsetting: this })
		this.handlerByType.default = this.handler
		//this.tw = opts.tw
		this.actions = new TermSettingActions({ termsetting: this })
		this.view = new TermSettingView({ termsetting: this })
	}

	validateOpts(_opts: TermSettingOpts) {
		const o = {
			...defaultOpts,
			..._opts
		}
		if (!o.holder && o.renderAs != 'none') throw '.holder missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if (!o.vocabApi) throw '.vocabApi missing'
		if (typeof o.vocabApi != 'object') throw '.vocabApi{} is not object'
		if ('placeholder' in o && !o.placeholder && 'placeholderIcon' in o && !o.placeholderIcon)
			throw 'must specify a non-empty opts.placeholder and/or .placeholderIcon'
		if (!('placeholder' in o)) o.placeholder = 'Select term&nbsp;'
		if (!('placeholderIcon' in o)) o.placeholderIcon = '+'
		if (!Number.isInteger(o.abbrCutoff)) o.abbrCutoff = 18 //set the default to 18
		this.validateMenuOptions(o)
		if (!o.numericEditMenuVersion) o.numericEditMenuVersion = ['discrete']
		this.mayValidate_noTermPromptOptions(o)
		return o
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
				parent_menu: tip.d.node()
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

	async setHandler(termtype: string | undefined | null, tw?: TermWrapper) {
		if (tw instanceof TwBase) {
			switch (tw.type) {
				case 'CatTWValues':
				case 'CatTWPredefinedGS':
				case 'CatTWCustomGS':
				case 'QualTWValues':
				case 'QualTWPredefinedGS':
				case 'QualTWCustomGS': {
					const { GroupSet } = await import('./handlers/GroupSet.ts')
					this.handler = new GroupSet({ termsetting: this })
					return
					//break
				}
				// TODO: should reinstate throw once all migrated tw's have strict handlers for each tw type
				// default:
				// 	throw `unsupported tw.type='${tw.type}'`
			}
			//return
		}

		// TODO: should use TwRouter here??? or expect tw to be already filled-in/instantiated???
		if (!termtype) {
			this.handler = this.handlerByType.default as Handler
			return
		}
		const type = termtype == 'integer' || termtype == 'float' || termtype == 'date' ? 'numeric' : termtype // 'categorical', 'condition', 'survival', etc
		if (!this.handlerByType[type]) {
			try {
				const _ = await import(`./handlers/${type}.ts`)
				this.handlerByType[type] = await _.getHandler(this)
			} catch (e) {
				throw `error with handler='./handlers/${type}.ts': ${e}`
			}
		}
		this.handler = this.handlerByType[type] as Handler
	}
}
