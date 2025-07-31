import { getInitFxn, copyMerge, deepEqual } from '#rx'
import { Menu } from '#dom'
import { select, type BaseType } from 'd3-selection'
import { minimatch } from 'minimatch'
import type {
	CategoricalQ,
	Q,
	TermWrapper,
	TwLst,
	NumericQ,
	SnpsQ,
	VocabApi,
	Dom,
	UseCase,
	NoTermPromptOptsEntry,
	Filter,
	SampleCountsEntry,
	Term
} from '#types'
import type { TermSettingOpts, Handler, PillData } from './types'
import { TermTypes, isDictionaryType, isNumericTerm } from '#shared/terms.js'
import { TwRouter } from '#tw/TwRouter'

/*
********************* EXPORTED
termsettingInit()
getPillNameDefault()
fillTermWrapper()
	call_fillTW
	mayValidateQmode
set_hiddenvalues()
********************* Instance methods
clickNoPillDiv
showTree

opts{}

*/

// append the common ID substring,
// so that the first characters of $id is more indexable
const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}`
let $id = 0

export async function get$id(minTwCopy) {
	if (!minTwCopy) return <string>`${$id++}${idSuffix}`
	delete minTwCopy.$id
	const i = window.location.pathname == '/testrun.html' || window.location.pathname == '/puppet.html' ? '' : $id++
	// TODO: may need to distinguish between unique tw $id and id for caching server response
	// for now, just append unique $id++ to ensure unique $id
	return await digestMessage(JSON.stringify(minTwCopy) + i)
}

const encoder = new TextEncoder()

// may replace with hash() helper from shared/utils
export async function digestMessage(message) {
	const msgUint8 = encoder.encode(message) // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8) // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
	return hexToBase64(hashHex).replace('=', '-') // shorten from 40 to 28 chars
}

function hexToBase64(hexStr) {
	return btoa(
		[...hexStr].reduce(
			(acc, _, i) => (acc += !((i - 1) & 1) ? String.fromCharCode(parseInt(hexStr.substring(i - 1, i + 1), 16)) : ''),
			''
		)
	)
}

const defaultOpts: { menuOptions: string; menuLayout: string } = {
	menuOptions: 'edit', // ['edit', 'replace', 'save', 'remove', 'reuse'],
	menuLayout: 'vertical'
}

//type HandlerByType = { [index: string]: Handler }
type HandlerByType = {
	default: Handler
	[termType: string]: Handler
	//categorical: CategoricalHandler
	//numeric: NumericHandler
}

interface TermSettingApi {
	main: (d: PillData) => void
	runCallback: () => void
	showTree: (holder, event: MouseEvent) => boolean
	showMenu: (event: MouseEvent, clickedElem, menuHolder: Selection | null) => void
	showGeneSearch: (clickedElem: Element | null, event: MouseEvent) => void
	hasError: () => boolean
	validateQ: (d: PillData) => void
}

export class TermSetting {
	opts: TermSettingOpts
	vocabApi: VocabApi
	dom: Dom //opts.holder is required

	//Optional opts, hence undefined type
	activeCohort?: number
	placeholder?: string
	durations: { exit: number }
	disable_terms?: Term[]
	usecase?: UseCase
	abbrCutoff?: number
	$id?: string
	sampleCounts?: SampleCountsEntry[]
	noTermPromptOptions?: NoTermPromptOptsEntry[]

	//Optional opts in script, not init()
	doNotHideTipInMain: boolean | undefined

	//Created
	hasError: boolean
	api: TermSettingApi
	numqByTermIdModeType: any //{}
	handlerByType: HandlerByType
	showTree: any
	showGeneSearch: any
	showMenu: any
	initUI: any
	updateUI: any
	handler: Handler

	//Pill data
	term: any
	q!: Q
	data: any
	error: string | undefined
	filter: Filter | undefined

	constructor(opts: TermSettingOpts) {
		this.opts = this.validateOpts(opts)
		this.vocabApi = opts.vocabApi
		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder as string
		this.durations = { exit: 0 }
		this.disable_terms = opts.disable_terms
		this.usecase = opts.usecase
		this.abbrCutoff = opts.abbrCutoff

		// numqByTermIdModeType is used if/when a numeric pill term type changes:
		// it will track numeric term.q by term.id, q.mode, and q.type to enable
		// the "remember" input values when switching between
		// discrete, continuous, and binary edit menus for the same term
		this.numqByTermIdModeType = {}

		// parent_menu is for detecting if the holder is contained within a floating client Menu instance;
		// this will be useful in preventing premature closure of the menu in case
		// a submenu is clicked and is still visible
		// NOTE: the parent_menu value may be empty (undefined)
		this.dom = {
			holder: opts.holder,
			tip:
				opts.tip ||
				new Menu({
					padding: '0px',
					parent_menu: this.opts.holder && this.opts.holder.node() && this.opts.holder.node().closest('.sja_menu_div')
				})
		} as Dom
		// tip2 is for showing inside tip, e.g. in snplocus UI
		this.dom.tip2 = new Menu({
			padding: '0px',
			parent_menu: this.dom.tip.d.node()
		})

		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		const defaultHandler = getDefaultHandler(this)
		this.handlerByType = {
			default: defaultHandler
		}
		this.handler = defaultHandler

		this.hasError = false

		// this api will be frozen and returned by termsettingInit()
		this.api = {
			// bind the 'this' context of api.main() to the Termsetting instance
			// instead of to the this.api object
			main: this.main.bind(this),
			runCallback: this.runCallback.bind(this),
			// do not change the this context of showTree, d3 sets it to the DOM element
			showTree: this.showTree,
			showMenu: this.showMenu.bind(this),
			showGeneSearch: this.showGeneSearch,
			hasError: () => this.hasError,
			validateQ: (d: PillData) => {
				if (!this.handler || !this.handler.validateQ) return
				try {
					this.handler.validateQ(d)
				} catch (e) {
					this.hasError = true
					throw e
				}
			}
		} as TermSettingApi
	}

	runCallback(overrideTw = null) {
		/* optional termwrapper (tw) to override attributes of this.term{} and this.q{}
		the override tw serves the "atypical" termsetting usage
		as used in snplocus block pan/zoom update in regression.results.js
		*/
		const arg: any = this.term ? { term: this.term, q: this.q, isAtomic: true } : {}
		if ('$id' in this) arg.$id = this.$id
		if (arg.q?.reuseId && arg.q.reuseId === this.data.q?.reuseId) {
			if (!deepEqual(arg.q, this.data.q)) {
				delete arg.q.reuseId
				delete arg.q.name
			}
		}
		const otw = overrideTw ? JSON.parse(JSON.stringify(overrideTw)) : {}
		if (this.opts.callback) this.opts.callback(overrideTw ? copyMerge(JSON.stringify(arg), otw) : arg)
	}

	validateOpts(_opts: TermSettingOpts) {
		const o = Object.assign({}, defaultOpts, _opts)
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

	async main(data = {} as PillData) {
		try {
			if (this.doNotHideTipInMain) {
				// single use: if true then delete
				delete this.doNotHideTipInMain
			} else {
				this.dom.tip.hide()
			}
			this.hasError = false
			delete this.error
			this.validateMainData(data)
			// may need original values for comparing edited settings
			this.data = data as PillData
			// term is read-only if it comes from state, let it remain read-only
			this.term = data.term as Term
			this.q = JSON.parse(JSON.stringify(data.q)) // q{} will be altered here and must not be read-only
			if ('$id' in data) this.$id = data.$id
			if ('disable_terms' in data) this.disable_terms = data.disable_terms
			if ('filter' in data) this.filter = data.filter as Filter
			if ('activeCohort' in data) this.activeCohort = data.activeCohort
			if ('sampleCounts' in data) this.sampleCounts = data.sampleCounts
			if ('menuOptions' in data) this.opts.menuOptions = data.menuOptions
			await this.setHandler(this.term ? this.term.type : null)
			if (data.term && this.handler && this.handler.validateQ) this.handler.validateQ(data)
			if (this.handler.postMain) await this.handler.postMain()
			if (this.opts.renderAs != 'none') this.updateUI()
		} catch (e) {
			this.hasError = true
			throw e
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

	async setHandler(termtype: string | undefined | null) {
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

export const termsettingInit = getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		// run only once, upon init
		if (self.opts.$id) {
			self.dom.tip.d.attr('id', self.opts.$id + '-ts-tip')
		}

		if (!self.dom.holder) return // toggle the display of pilldiv and nopilldiv with availability of this.term
		;(self.dom.nopilldiv as HTMLElement) = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', self.clickNoPillDiv)
			.on(`keyup.sjpp-termdb`, event => {
				if (event.key == 'Enter') self.showTree(event)
			})
		self.dom.pilldiv = self.dom.holder.append('div')

		// nopilldiv - placeholder label
		if (self.opts.placeholder) {
			self.dom.nopilldiv
				.append('div')
				.html(self.placeholder)
				.attr('class', 'sja_clbtext2')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
		}

		// nopilldiv - plus button
		if (self.opts.placeholderIcon) {
			self.dom.nopilldiv
				.append('div')
				.attr('class', 'sja_filter_tag_btn add_term_btn')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
				.style('border-radius', '6px')
				.style('background-color', '#4888BF')
				.text(self.opts.placeholderIcon)
		}

		self.dom.btnDiv = self.dom.holder.append('div')
		self.dom.content_holder = select(self.dom.holder.node().parentNode).append('div')
	}

	self.updateUI = async () => {
		self.dom.btnDiv.selectAll('*').remove() //remove info button
		self.dom.content_holder.selectAll('*').remove() //remove info content

		if (!self.term) {
			// no term
			self.dom.nopilldiv.style('display', 'block')
			self.dom.pilldiv.style('display', 'none')
			self.dom.btnDiv.style('display', 'none')
			return
		}

		// has term
		// add info button for terms with meta data
		if (self.term.hashtmldetail) {
			if (self.opts.buttons && !self.opts.buttons.includes('info')) self.opts.buttons.unshift('info')
			else self.opts.buttons = ['info']
		} else {
			self.opts.buttons = []
		}

		if (self.opts.buttons.length) {
			self.dom.btnDiv
				.selectAll('div')
				.data(self.opts.buttons)
				.enter()
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '0px 5px')
				.style('cursor', 'pointer')
				.style('color', '#999')
				.style('font-size', '.8em')
				.html((d: string) => d.toUpperCase())
				.on('click', (event: any, d: string) => {
					if (d == 'delete') self.removeTerm!()
					else if (d == 'replace') {
						self.showTree(event.target)
					} else throw 'unknown button'
				})

			// render info button only if term has html details
			if (self.term.hashtmldetail) {
				const infoIcon_div = self.dom.btnDiv.selectAll('div').filter(function (this: BaseType) {
					return select(this).text() === 'INFO'
				})

				// TODO: modify termInfoInit() to display term info in tip rather than in div
				// can be content_tip: self.dom.tip.d to separate it from content_holder
				const termInfo = await import('../termdb/termInfo.js')
				termInfo.termInfoInit({
					vocabApi: self.opts.vocabApi,
					icon_holder: infoIcon_div,
					content_holder: self.dom.content_holder,
					id: self.term.id,
					state: { term: self.term }
				})
			}
		}

		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', self.opts.buttons ? 'inline-block' : 'block')
		self.dom.btnDiv.style('display', self.opts.buttons ? 'inline-block' : 'none')

		//Gene expression terms do not have an id. Use the name if an id is not available.
		const pills = self.dom.pilldiv.selectAll('.ts_pill').data([self.term], (d: any) => d.id || d.name)

		// this exit is really nice
		pills.exit().each(self.exitPill)

		pills.transition().duration(200).each(self.updatePill)

		pills
			.enter()
			.append('div')
			.attr('class', 'ts_pill')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto')
			.style('grid-template-areas', '"left right"')
			.style('cursor', 'pointer')
			.style('margin', '2px')
			.on('click', self.showMenu)
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function (this: string) {
		const one_term_div = select(this)

		// left half of blue pill
		self.dom.pill_termname = one_term_div
			.append('div')
			.attr('class', 'term_name_btn  sja_filter_tag_btn')
			.attr('tabindex', 0)
			.style('display', 'flex')
			.style('grid-area', 'left')
			.style('position', 'relative')
			.style('align-items', 'center')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.html(self.handler!.getPillName)
			.on(`keyup.sjpp-termdb`, event => {
				if (event.key == 'Enter') event.target.click()
			})

		self.updatePill!.call(this)
	}

	self.updatePill = async function (this: string) {
		// decide if to show/hide the right half based on term status, and modify pill
		const one_term_div = select(this)

		const pillstat: { text: string; bgcolor?: string } = self.handler!.getPillStatus() || {}
		// { text, bgcolor }

		self.dom.pill_termname.style('border-radius', pillstat.text ? '6px 0 0 6px' : '6px').html(self.handler!.getPillName)

		const pill_settingSummary = one_term_div
			.selectAll('.ts_summary_btn')
			// bind d.txt to dom, is important in making sure the same text label won't trigger the dom update
			.data(pillstat.text ? [{ txt: pillstat.text }] : [], (d: any) => d.txt as string)

		// because of using d.txt of binding data, exitPill cannot be used here
		// as two different labels will create the undesirable effect of two right halves
		pill_settingSummary.exit().remove()

		const righthalf = pill_settingSummary
			.enter()
			.append('div')
			.attr('class', 'ts_summary_btn sja_filter_tag_btn')
			.style('display', 'flex')
			.style('grid-area', 'right')
			.style('position', 'relative')
			.style('align-items', 'center')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html((d: any) => d.txt)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)

		if (pillstat.bgcolor) {
			righthalf.transition().duration(200).style('background-color', pillstat.bgcolor)
		}
	}

	self.exitPill = function (this: string) {
		select(this).style('opacity', 1).transition().duration(self.durations.exit).style('opacity', 0).remove()
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback!(null)
	}

	self.cancelGroupsetting = () => {
		self.opts.callback!({
			id: self.term.id,
			term: self.term,
			q: { mode: 'discrete', type: 'values', isAtomic: true }
		})
	}

	self.clickNoPillDiv = async () => {
		// support various behaviors upon clicking nopilldiv
		if (!self.noTermPromptOptions || self.noTermPromptOptions.length == 0) {
			// show tree to select a dictionary term
			await self.showTree(self.dom.nopilldiv.node())
			return
		}
		self.dom.tip.clear().showunder(self.dom.nopilldiv.node())
		// create small menu, one option for each ele in noTermPromptOptions[]
		const optionTip = new Menu()
		for (const option of self.noTermPromptOptions) {
			// {isDictionary, termtype, text, html, q{}}
			const item = self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.on('click', async event => {
					optionTip.clear().hide()
					if (option.invalid) {
						// invalid option, display message
						optionTip.show(event.clientX, event.clientY).d.append('div').text(option.invalidMsg)
						return
					}
					self.dom.tip.clear()
					if (option.isDictionary) {
						await self.showTree(self.dom.tip.d.node())
					} else if (option.termtype) {
						// pass in default q{} to customize settings in edit menu
						if (option.q) self.q = structuredClone(option.q)
						await self.setHandler!(option.termtype)
						if (isNumericTerm(self.term) && !self.term.bins && self.term.type != 'survival') {
							await self.vocabApi.setTermBins({ term: self.term, q: self.q })
						}
						if (!self.$id) self.$id = await get$id(self.vocabApi.getTwMinCopy({ term: self.term, q: self.q }))
						self.handler!.showEditMenu(self.dom.tip.d)
					} else {
						throw 'termtype missing'
					}
				})
			if (option.text) item.text(option.text)
			else if (option.html) item.html(option.html)
		}
		// load the input ui for this term type
	}

	self.showTree = async function (holder, event: MouseEvent | undefined) {
		self.dom.tip.clear()
		if (holder)
			self.dom.tip.showunder(
				holder instanceof Element ? holder : this instanceof Element ? this : self.dom.holder.node()
			)
		else self.dom.tip.show(event!.clientX, event!.clientY)
		if (!self.usecase) self.usecase = { target: 'default' }
		const termdb = await import('../termdb/app.js')
		termdb.appInit({
			holder: self.dom.tip.d,
			vocabApi: self.vocabApi,
			state: {
				activeCohort: self.activeCohort,
				tree: {
					usecase: self.usecase
				}
			},
			tree: {
				disable_terms: self.disable_terms,
				click_term: async t => {
					self.dom.tip.hide()

					let tw
					if (t.term) tw = t as TermWrapper
					else {
						const term = t as Term
						tw = { term, q: { isAtomic: true }, isAtomic: true }
					}

					if (self.opts.customFillTw) self.opts.customFillTw(tw)
					await call_fillTW(tw, self.vocabApi, self.opts.defaultQ4fillTW)
					// tw is now furbished

					self.opts.callback!(tw)
				}
			}
		})
	}

	self.showMenu = (event: MouseEvent, clickedElem = null, menuHolder = null) => {
		const tip = self.dom.tip
		tip.clear()
		// self.dom.holder really is set to clickedElem because
		// handler showEditMenu() use if for tip.showunder(self.dom.holder)
		if (self.opts.renderAs == 'none' && clickedElem) self.dom.holder = select(clickedElem)
		if (self.dom.holder) {
			const elem = self.dom.holder?.node()
			if (elem) tip.showunder(elem)
			else tip.show(event.clientX, event.clientY)
		}

		type opt = { label: string; callback: (f?: any) => void }
		const options: opt[] = []

		if (self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset') {
			// term is using groupsetting
			// should provide option to cancel it
			if (self.q.mode != 'binary' && self.term.type != 'geneVariant') {
				// mode=binary will never use groupsetting
				// geneVariant term can cancel groupsetting within edit menu
				options.push({ label: 'Cancel grouping', callback: self.cancelGroupsetting } as opt)
			}
		}

		if (self.q && !self.term.groupsetting?.disabled && minimatch('edit', self.opts.menuOptions)) {
			// hide edit option for survival term because its showEditMenu() is disabled
			options.push({
				label: 'Edit',
				callback: async div => {
					if (self.term && isNumericTerm(self.term) && !self.term.bins && self.term.type != 'survival') {
						await self.vocabApi.setTermBins({ term: self.term, q: self.q })
					}
					self.handler!.showEditMenu(div)
				}
			} as opt)
		}

		if (self.term.type == 'geneVariant' && self.q.type == 'predefined-groupset') {
			// display predefined groupsets of geneVariant term
			// for quick access
			const groupsets = self.term.groupsetting?.lst
			if (!groupsets || !groupsets.length) throw 'predefined groupsets not found'
			for (const [i, groupset] of groupsets.entries()) {
				options.push({
					label: groupset.name,
					callback: async () => {
						const tw: TermWrapper = {
							isAtomic: true,
							term: self.term,
							q: { type: 'predefined-groupset', predefined_groupset_idx: i, isAtomic: true }
						}
						await call_fillTW(tw, self.vocabApi)
						self.opts.callback!(tw)
					}
				})
			}
		}

		// Restored the reuse menu option for now, due to failing integration tests that will require more code changes to fix
		// Instead of deleting the reuse code, may move the Reuse to the edit menu for recovering saved grouping/bin config
		// if (minimatch('reuse', self.opts.menuOptions)) {
		// 	options.push({ label: 'Reuse', callback: self.showReuseMenu } as opt)
		// }

		if (minimatch('replace', self.opts.menuOptions)) {
			options.push({ label: 'Replace', callback: self.showTree } as opt)
		}

		if (minimatch('remove', self.opts.menuOptions)) {
			options.push({ label: 'Remove', callback: self.removeTerm } as opt)
		}

		if (self.opts.customMenuOptions) options.push(...self.opts.customMenuOptions)

		self.openMenu = menuHolder || tip.d
		self.openMenu
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('tabindex', (d, i) => i + 1)
			.style('display', self.opts.menuLayout == 'horizontal' ? 'inline-block' : 'block')
			.text((d: opt) => d.label)
			.on('click', (event: MouseEvent, d: opt) => {
				self.dom.tip.clear()
				d.callback(self.dom.tip.d)
			})
			.on('keyup', event => {
				if (event.key == 'Enter') event.target.click()
			})

		self.openMenu.select('.sja_menuoption').node()?.focus()
		//self.showFullMenu(tip.d, self.opts.menuOptions)
	}

	// TODO: deprecate the reuse option???
	self.showReuseMenu = async function (_div: any) {
		const saveDiv = _div.append('div')
		saveDiv
			.style('display', 'block')
			.style('padding', '10px')
			.append('span')
			.style('color', '#aaa')
			.html('Save current setting as ')

		const qlst = self.vocabApi.getCustomTermQLst(self.term)
		const qNameInput = saveDiv
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', qlst.nextReuseId)
			.attr('value', self.q.reuseId || qlst.nextReuseId)
		//.style('width', '300px')

		saveDiv
			.append('button')
			.style('margin-left', '5px')
			.html('Save')
			.on('click', () => {
				const reuseId = qNameInput.property('value').trim() || qlst.nextReuseId
				self.q.reuseId = reuseId
				//self.q.name = self.q.reuseId
				self.vocabApi.cacheTermQ(self.term, self.q)
				self.runCallback!()
				self.dom.tip.hide()
			})

		const tableWrapper = _div.append('div').style('margin', '10px')
		// TODO: may use a more specific type, if the reuse menu option is not deprecated
		const defaultTw: any = { term: self.term, q: {} }
		await fillTermWrapper(defaultTw, self.vocabApi)
		defaultTw.q.reuseId = 'Default'
		qlst.push(defaultTw.q)
		if (qlst.length > 1) {
			tableWrapper.append('div').style('color', '#aaa').html('Previously saved settings')
		}

		tableWrapper
			.append('table')
			.selectAll('tr')
			.data(qlst)
			.enter()
			.append('tr')
			.style('margin', '2px 5px')
			.each(function (this: BaseType, q: Q) {
				const tr = select(this)
				const inuse = equivalentQs(self.q, q)
				const html2Use = q.name || (q.reuseId as string)
				tr.append('td')
					.style('min-width', '180px')
					//.style('border-bottom', '1px solid #eee')
					.style('text-align', 'center')
					.html(html2Use)

				const useTd = tr.append('td').style('text-align', 'center')
				if (inuse) {
					useTd.html(`In use <span style='color:#5a5;font-weight:600'>&check;</span>`)
				} else {
					useTd
						.append('button')
						.style('min-width', '80px')
						.html('Use')
						.on('click', () => {
							if (q.reuseId === 'Default') {
								delete q.reuseId
								delete q.name
							}
							self.q = q
							self.dom.tip.hide()
							self.runCallback!()
						})
				}

				const deleteTd = tr.append('td').style('text-align', 'center')
				if (!inuse && q.reuseId != 'Default') {
					deleteTd
						.append('button')
						.style('min-width', '80px')
						.html('Delete')
						.on('click', async () => {
							await self.vocabApi.uncacheTermQ(self.term!, q)
							self.dom.tip.hide()
							self.runCallback!()
						})
				}
			})

		_div
			.append('div')
			.style('margin', '20px 5px 5px 5px')
			.style('padding', '5px')
			.style('font-size', '0.8em')
			.style('color', '#aaa')
			.html(
				`Saving the setting will allow it to be reused at another chart.<br/>` +
					`The setting will be reusable in your current or saved session.`
			)
	}

	self.showGeneSearch = function (clickedElem: Element | null, event: MouseEvent) {
		self.dom.tip.clear()
		if (clickedElem)
			self.dom.tip.showunder(
				clickedElem instanceof Element ? clickedElem : this instanceof Element ? this : self.dom.holder.node()
			)
		else self.dom.tip.show(event.clientX, event.clientY)

		const selectedGenes = new Set()
		const searchDiv = self.dom.tip.d.append('div').style('padding', '5px')
		const label = searchDiv.append('label')
		label.append('span').text('Search: ')
		const input = label
			.append('input')
			.attr('type', 'text')
			.on('input', async () => {
				const str = input.property('value')
				try {
					const results = !str
						? { lst: [] }
						: await self.vocabApi.findTerm(str, self.activeCohort!, self.usecase!, 'gene')
					resultsDiv.selectAll('*').remove()
					resultsDiv
						.selectAll('div')
						.data(results.lst.filter((g: any) => !selectedGenes.has(g)))
						.enter()
						.append('div')
						.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
						.style('display', 'block')
						.style('margin', '2px 3px')
						.style('width', 'fit-content')
						.text((gene: any) => gene.name)
						.on('click', (gene: any) => {
							self.dom.tip.hide()
							self.runCallback!({
								term: {
									name: gene.name,
									type: 'geneVariant'
								},
								q: {
									exclude: []
								}
							})
						})
				} catch (e) {
					alert('Search error: ' + e)
				}
			})

		const resultsDiv = self.dom.tip.d
			.append('div')
			.style('margin', '5px')
			.style('padding-left', '5px')
			.style('border-left', '2px solid #ccc')
	}
}

// do not consider irrelevant q attributes when
// computing the deep equality of two term.q's
function equivalentQs(q0: Q, q1: Q) {
	const qlst = [q0, q1].map(q => JSON.parse(JSON.stringify(q)))
	for (const q of qlst) {
		delete q.binLabelFormatter
		if (q.reuseId === 'Default') delete q.reuseId
		// TODO: may need to delete non-relevant q attributes
		// when setting defaults in regression.inputs.term.js
		if (q.mode === 'continuous') delete q.mode
		if (q.mode === 'discrete' && q.type == 'custom-bin' && q.lst) {
			for (const bin of q.lst) {
				delete bin.range
			}
		}
	}
	return deepEqual(...qlst)
}

function getDefaultHandler(self): Handler {
	return {
		showEditMenu() {
			//ignore
		},
		getPillStatus() {
			//ignore
		},
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		}
	}
}

export function getPillNameDefault(self, d: any) {
	if (!self.opts.abbrCutoff) return d.name
	return d.name.length <= self.opts.abbrCutoff + 2
		? d.name
		: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
}

/* For some plots that can have multiple terms of the same ID,
but with different q{}, we can assign and use $id to
disambiguate which tw data to update and associate with
a rendered element such as a pill or a matrix row

tw: termWrapper = {id, term{}, q{}}
vocabApi
defaultQByTsHandler{}
	supply the optional default q{}
	value is { condition: {mode:'binary'}, ... }
	with term types as keys
*/

type DefaultQByTsHandler = {
	categorical?: CategoricalQ
	numeric?: NumericQ
	snplst?: SnpsQ
}

export async function fillTwLst(
	twlst: TwLst,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<void> {
	await mayHydrateDictTwLst(twlst, vocabApi)
	const promises: Promise<TermWrapper>[] = []
	for (const tw of twlst) {
		promises.push(fillTermWrapper(tw, vocabApi, defaultQByTsHandler))
	}
	await Promise.all(promises)
}

// fill in tw.term{} from a dehydrated state
// a dictionary tw can be simply expressed as {id:str} and this function will fill in the term object.
// a non-dict term will always have a term object, so this function will not be applied to non-dict term
export async function mayHydrateDictTwLst(twlst: TwLst, vocabApi: VocabApi) {
	const ids: string[] = []
	for (const tw of twlst) {
		if (tw.term) continue
		if (tw.id === undefined || tw.id === '') throw '.id is required'
		ids.push(tw.id)
	}
	const terms = ids.length ? await vocabApi.getTerms(ids) : {}
	for (const id of ids) {
		if (!terms[id]) throw `missing dictionary term for id=${id}`
		for (const tw of twlst) {
			if (tw.id && tw.id in terms) tw.term = terms[tw.id]
		}
	}
}

// add migrated tw fillers here, by term.type
const routedTermTypes = new Set(['categorical', 'integer', 'float', 'geneVariant'])

async function mayUseTwRouterFill(
	tw: TermWrapper,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<TermWrapper | false> {
	if (!routedTermTypes.has(tw.term?.type)) return false
	// NOTE: while the tw refactor is not done for all term types and q.types/modes,
	// there will be some code duplication between TwRouter and the legacy code;
	// the latter will be deleted once the refactor/migration is done
	const fullTw = await TwRouter.fill(tw, { vocabApi, defaultQByTsHandler })
	Object.assign(tw, fullTw)
	mayValidateQmode(tw)
	// this should be moved to the term-type specific handler??
	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	if (tw.q) tw.q.isAtomic = true
	return tw
}

export async function fillTermWrapper(
	tw: TermWrapper,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<TermWrapper> {
	tw.isAtomic = true
	if (!tw.term && tw.id) {
		// hydrate tw.term using tw.id
		await mayHydrateDictTwLst([tw], vocabApi)
	}

	if (await mayUseTwRouterFill(tw, vocabApi, defaultQByTsHandler)) return tw

	// tw.id is no longer needed
	delete tw.id
	if (!tw.q) (tw.q as any) = {}
	tw.q.isAtomic = true
	// check for legacy tw structure
	checkLegacyTw(tw)
	// call term-type specific logic to fill tw
	await call_fillTW(tw, vocabApi, defaultQByTsHandler)
	mayValidateQmode(tw)
	// compute $id after tw is filled
	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	return tw
}

// check for legacy tw structure that could be
// present in old saved sessions
function checkLegacyTw(tw) {
	// check for legacy q.groupsetting{}
	if (Object.keys(tw.q).includes('groupsetting')) {
		if (tw.q['groupsetting']['inuse']) {
			if (tw.q.type == 'predefined-groupset') {
				tw.q['predefined_groupset_idx'] = tw.q['groupsetting']['predefined_groupset_idx']
			} else if (tw.q.type == 'custom-groupset') {
				tw.q['customset'] = tw.q['groupsetting']['customset']
			} else {
				throw 'invalid q.type'
			}
		} else {
			tw.q.type = 'values'
		}
		delete tw.q['groupsetting']
	}
}

async function call_fillTW(tw: TermWrapper, vocabApi: VocabApi, defaultQByTsHandler?: DefaultQByTsHandler) {
	// repeating this logic from fillTermWrapper(), since call_fillTW() may be called directly
	// TODO: may deprecate call_fillTW() once all term types have been migrated to xtw
	if (await mayUseTwRouterFill(tw, vocabApi, defaultQByTsHandler)) return

	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	const t = tw.term.type
	const type = t == 'float' || t == 'integer' || t == 'date' ? 'numeric' : (t as string)
	let _
	if (tw.term.type) {
		try {
			_ = await import(`./handlers/${type}.ts`)
		} catch (_e) {
			throw `Type ${type} does not exist`
		}
	} else throw `Type not defined for ${JSON.stringify(tw)}`
	await _.fillTW(tw, vocabApi, defaultQByTsHandler ? defaultQByTsHandler[type] : null)
}

function mayValidateQmode(tw: TermWrapper) {
	if (!('mode' in tw.q)) {
		// at this stage q.mode is allowed to be missing and will not validate
		return
	}
	// q.mode is set. here will validate
	if (typeof tw.q.mode != 'string') throw 'q.mode not string'
	// if (tw.q.mode == '') throw 'q.mode is empty string' //No longer required with typescript
	// handler code should implement term type-specific validations
	// e.g. to prevent cases such as mode=continuous for categorical term
}

export function set_hiddenvalues(q: Q, term: Term) {
	if (!q.hiddenValues) {
		q.hiddenValues = {}
		// by default, fill-in with uncomputable values
		if (term.values) {
			for (const k in term.values) {
				if (term.values[k].uncomputable) q.hiddenValues[k] = 1
			}
		}
	}
}
