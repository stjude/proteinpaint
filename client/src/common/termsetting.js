import { getInitFxn, copyMerge } from './rx.core'
import { Menu } from '../dom/menu'
import { select } from 'd3-selection'

/*
********************* EXPORTED
nonDictionaryTermTypes
termsettingInit()
getPillNameDefault()
fillTermWrapper()
set_hiddenvalues()
********************* Instance methods
clickNoPillDiv
showTree
*/

export const nonDictionaryTermTypes = new Set(['snplst', 'prs', 'snplocus', 'geneVariant'])

// append the common ID substring,
// so that the first characters of $id is more indexable
const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}`
let $id = 0

const defaultOpts = {
	menuOptions: 'edit',
	menuLayout: 'vertical'
}

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.vocabApi = opts.vocabApi
		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder
		this.durations = { exit: 500 }
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
		}
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
			hasError: () => this.hasError,
			validateQ: d => {
				if (!this.handler || !this.handler.validateQ) return
				try {
					this.handler.validateQ(d)
				} catch (e) {
					this.hasError = true
					throw e
				}
			}
		}
	}

	runCallback(overrideTw) {
		/* optional termwrapper (tw) to override attributes of this.term{} and this.q{}
		the override tw serves the "atypical" termsetting usage
		as used in snplocus block pan/zoom update in regression.results.js
		*/
		const arg = { id: this.term.id, term: this.term, q: this.q }
		if ('$id' in this) arg.$id = this.$id
		this.opts.callback(overrideTw ? copyMerge({}, arg, overrideTw) : arg)
	}

	validateOpts(_opts) {
		const o = Object.assign({}, defaultOpts, _opts)
		if (!o.holder && o.renderAs != 'none') throw '.holder missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		if (!o.vocabApi) throw '.vocabApi missing'
		if (typeof o.vocabApi != 'object') '.vocabApi{} is not object'
		if ('placeholder' in o && !o.placeholder && 'placeholderIcon' in o && !o.placeholderIcon)
			throw 'must specify a non-empty opts.placeholder and/or .placeholderIcon'
		if (!('placeholder' in o)) o.placeholder = 'Select term&nbsp;'
		if (!('placeholderIcon' in o)) o.placeholderIcon = '+'
		if (!Number.isInteger(o.abbrCutoff)) o.abbrCutoff = 18 //set the default to 18
		if (!o.numericEditMenuVersion) o.numericEditMenuVersion = ['discrete']
		this.mayValidate_noTermPromptOptions(o)
		return o
	}

	async main(data = {}) {
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
			// term is read-only if it comes from state, let it remain read-only
			this.term = data.term
			this.q = JSON.parse(JSON.stringify(data.q)) // q{} will be altered here and must not be read-only
			if ('$id' in data) this.$id = data.$id
			if ('disable_terms' in data) this.disable_terms = data.disable_terms
			if ('exclude_types' in data) this.exclude_types = data.exclude_types
			if ('filter' in data) this.filter = data.filter
			if ('activeCohort' in data) this.activeCohort = data.activeCohort
			if ('sampleCounts' in data) this.sampleCounts = data.sampleCounts
			await this.setHandler(this.term ? this.term.type : null)
			if (data.term && this.handler && this.handler.validateQ) this.handler.validateQ(data)
			if (this.handler.postMain) await this.handler.postMain()
			if (this.opts.renderAs != 'none') this.updateUI()
		} catch (e) {
			this.hasError = true
			throw e
		}
	}

	validateMainData(d) {
		if (d.term) {
			// term is optional
			if (!d.term.type) throw 'data.term.type missing'
			// hardcode non
			if (!nonDictionaryTermTypes.has(d.term.type)) {
				if (!d.term.id) throw 'data.term.id missing'
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

	mayValidate_noTermPromptOptions(o) {
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
		}
		this.noTermPromptOptions = o.noTermPromptOptions
	}

	async setHandler(termtype) {
		if (!termtype) {
			this.handler = this.handlerByType.default
			return
		}
		const type = termtype == 'integer' || termtype == 'float' ? 'numeric' : termtype // 'categorical', 'condition', 'survival', etc
		const numEditVers = this.opts.numericEditMenuVersion
		const subtype = type != 'numeric' ? '' : numEditVers.length > 1 ? '.toggle' : '.' + numEditVers[0] // defaults to 'discrete'
		const typeSubtype = `${type}${subtype}`
		if (!this.handlerByType[typeSubtype]) {
			try {
				const _ = await import(`./termsetting.${typeSubtype}.js`)
				this.handlerByType[typeSubtype] = await _.getHandler(this)
			} catch (e) {
				throw `error with handler='./termsetting.${typeSubtype}.js': ${e}`
			}
		}
		this.handler = this.handlerByType[typeSubtype]
	}
}

export const termsettingInit = getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		// run only once, upon init
		if (self.opts.$id) {
			self.dom.tip.d.attr('id', self.opts.$id + '-ts-tip')
		}

		if (!self.dom.holder) return

		// toggle the display of pilldiv and nopilldiv with availability of this.term
		self.dom.nopilldiv = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', self.clickNoPillDiv)
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
	}

	self.updateUI = async () => {
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
		}
		if (self.opts.buttons) {
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
				.html(d => d.toUpperCase())
				.on('click', d => {
					if (d == 'delete') self.removeTerm()
					else if (d == 'replace') self.showTree(event.target)
				})

			// render info button only if term has html details
			if (self.term.hashtmldetail) {
				const infoIcon_div = self.dom.btnDiv.selectAll('div').filter(function() {
					return select(this).text() === 'INFO'
				})
				const content_holder = select(self.dom.holder.node().parentNode).append('div')

				// TODO: modify termInfoInit() to display term info in tip rather than in div
				// can be content_tip: self.dom.tip.d to separate it from content_holder
				const termInfo = await import('../termdb/termInfo')
				termInfo.termInfoInit({
					vocabApi: self.opts.vocabApi,
					icon_holder: infoIcon_div,
					content_holder,
					id: self.term.id,
					state: { term: self.term }
				})
			}
		}

		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', self.opts.buttons ? 'inline-block' : 'block')
		self.dom.btnDiv.style('display', self.opts.buttons ? 'inline-block' : 'none')

		const pills = self.dom.pilldiv.selectAll('.ts_pill').data([self.term], d => d.id)

		// this exit is really nice
		pills.exit().each(self.exitPill)

		pills
			.transition()
			.duration(200)
			.each(self.updatePill)

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

	self.enterPill = async function() {
		const one_term_div = select(this)

		// left half of blue pill
		self.dom.pill_termname = one_term_div
			.append('div')
			.attr('class', 'term_name_btn  sja_filter_tag_btn')
			.style('display', 'flex')
			.style('grid-area', 'left')
			.style('position', 'relative')
			.style('align-items', 'center')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.html(self.handler.getPillName)

		self.updatePill.call(this)
	}

	self.updatePill = async function() {
		// decide if to show/hide the right half based on term status, and modify pill
		const one_term_div = select(this)

		const pillstat = self.handler.getPillStatus() || {}
		// { text, bgcolor }

		self.dom.pill_termname.style('border-radius', pillstat.text ? '6px 0 0 6px' : '6px')

		const pill_settingSummary = one_term_div
			.selectAll('.ts_summary_btn')
			// bind d.txt to dom, is important in making sure the same text label won't trigger the dom update
			.data(pillstat.text ? [{ txt: pillstat.text }] : [], d => d.txt)

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
			.html(d => d.txt)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)

		if (pillstat.bgcolor) {
			righthalf
				.transition()
				.duration(200)
				.style('background-color', pillstat.bgcolor)
		}
	}

	self.exitPill = function() {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback(null)
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
		for (const option of self.noTermPromptOptions) {
			// {isDictionary, termtype, text, html}
			const item = self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.on('click', async () => {
					self.dom.tip.clear()
					if (option.isDictionary) {
						await self.showTree(self.dom.tip.d.node())
					} else if (option.termtype) {
						await self.setHandler(option.termtype)
						self.handler.showEditMenu(self.dom.tip.d)
					} else {
						throw 'termtype missing'
					}
				})
			if (option.text) item.text(option.text)
			else if (option.html) item.html(option.html)
		}
		// load the input ui for this term type
	}

	self.showTree = async function(holder) {
		self.dom.tip.clear()
		if (holder)
			self.dom.tip.showunder(
				holder instanceof Element ? holder : this instanceof Element ? this : self.dom.holder.node()
			)
		else self.dom.tip.show(event.clientX, event.clientY)

		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: self.dom.tip.d,
			vocabApi: self.vocabApi,
			state: {
				activeCohort: self.activeCohort,
				tree: {
					exclude_types: self.exclude_types,
					usecase: self.usecase
				}
			},
			tree: {
				disable_terms: self.disable_terms,
				click_term: async term => {
					self.dom.tip.hide()
					const data = { id: term.id, term, q: {} }
					let _term = term
					if (self.opts.use_bins_less && (term.type == 'integer' || term.type == 'float') && term.bins.less) {
						// instructed to use bins.less which is present
						// make a decoy term replacing bins.default with bins.less
						_term = JSON.parse(JSON.stringify(term))
						_term.bins.default = _term.bins.less
					}
					await call_fillTW(data, self.vocabApi)
					self.opts.callback(data)
				}
			}
		})
	}

	self.showMenu = (clickedElem = null) => {
		const tip = self.dom.tip
		tip.clear()
		if (self.opts.renderAs == 'none' && clickedElem) self.dom.holder = select(clickedElem)
		if (self.dom.holder) {
			const elem = self.dom.holder.node()
			if (elem) tip.showunder(elem)
			else tip.show(event.clientX, event.clientY)
		}

		if (self.opts.menuOptions == 'all') {
			self.showEditReplaceRemoveMenu(tip.d)
		} else if (self.opts.menuOptions == 'edit') {
			self.handler.showEditMenu(tip.d)
		} else {
			throw `Unsupported termsettingInit.opts.menuOptions='${self.opts.menuOptions}'`
		}
	}

	self.showEditReplaceRemoveMenu = async function(div) {
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', self.opts.menuLayout == 'horizontal' ? 'inline-block' : 'block')
			.text('Edit')
			.on('click', () => {
				self.dom.tip.clear()
				self.handler.showEditMenu(self.dom.tip.d)
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', self.opts.menuLayout == 'horizontal' ? 'inline-block' : 'block')
			.text('Replace')
			.on('click', () => {
				self.showTree(self.dom.tip.d.node())
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', self.opts.menuLayout == 'horizontal' ? 'inline-block' : 'block')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}
}

function getDefaultHandler(self) {
	return {
		showEditMenu() {},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

export function getPillNameDefault(self, d) {
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
context{}
	supply the optional context to define tw.q{}
	for condition term, fillTW() will fill mode='discrete' by default
	however, as log/cox outcome, mode must be "binary" instead,
	this context-dependent requirment is coded in context{}
	and is handled by fillTW() of condition term
*/
export async function fillTermWrapper(tw, vocabApi, context) {
	if (!tw.$id) tw.$id = `${$id++}${idSuffix}`

	if (!tw.term) {
		if (tw.id == undefined || tw.id === '') throw 'missing both .id and .term'
		// has .id but no .term, must be a dictionary term
		// as non-dict term must have tw.term{}
		tw.term = await vocabApi.getterm(tw.id)
	}

	// tw.term{} is valid
	if (tw.id == undefined || tw.id === '') {
		// for dictionary term, tw.term.id must be valid
		// for non dict term, it can still be missing
		tw.id = tw.term.id
	} else if (tw.id != tw.term.id) {
		throw 'the given ids (tw.id and tw.term.id) are different'
	}
	if (!tw.q) tw.q = {}
	// call term-type specific logic to fill tw
	await call_fillTW(tw, vocabApi, context)
}

async function call_fillTW(tw, vocabApi, context) {
	const t = tw.term.type
	const type = t == 'float' || t == 'integer' ? 'numeric.toggle' : t
	const _ = await import(`./termsetting.${type}.js`)
	await _.fillTW(tw, vocabApi, context)
}

export function set_hiddenvalues(q, term) {
	if (!q.hiddenValues) {
		q.hiddenValues = {}
	}
	if (term.values) {
		for (const k in term.values) {
			if (term.values[k].uncomputable) q.hiddenValues[k] = 1
		}
	}
}
