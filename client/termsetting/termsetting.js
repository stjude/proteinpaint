import { getInitFxn, copyMerge, deepEqual } from '#rx'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'
import minimatch from 'minimatch'
import { nonDictionaryTermTypes } from '#shared/termdb.usecase'
/*
********************* EXPORTED
nonDictionaryTermTypes
termsettingInit()
getPillNameDefault()
fillTermWrapper()
	call_fillTW
	mayValidateQmode
set_hiddenvalues()
********************* Instance methods
clickNoPillDiv
showTree
*/

// append the common ID substring,
// so that the first characters of $id is more indexable
const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}`
let $id = 0

const defaultOpts = {
	menuOptions: '{edit,reuse}', // ['edit', 'replace', 'save', 'remove'],
	menuLayout: 'vertical'
}

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.vocabApi = opts.vocabApi
		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder
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
			showGeneSearch: this.showGeneSearch,
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

	runCallback(overrideTw = null) {
		/* optional termwrapper (tw) to override attributes of this.term{} and this.q{}
		the override tw serves the "atypical" termsetting usage
		as used in snplocus block pan/zoom update in regression.results.js
		*/
		const arg = this.term ? { id: this.term.id, term: this.term, q: this.q, isAtomic: true } : {}
		if ('$id' in this) arg.$id = this.$id
		if (arg.q?.reuseId && arg.q.reuseId === this.data.q?.reuseId) {
			if (!deepEqual(arg.q, this.data.q)) {
				delete arg.q.reuseId
				delete arg.q.name
			}
		}
		const otw = overrideTw ? JSON.parse(JSON.stringify(overrideTw)) : {}
		this.opts.callback(overrideTw ? copyMerge(JSON.stringify(arg), otw) : arg)
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
		this.validateMenuOptions(o)
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
			// may need original values for comparing edited settings
			this.data = data
			// term is read-only if it comes from state, let it remain read-only
			this.term = data.term
			this.q = JSON.parse(JSON.stringify(data.q)) // q{} will be altered here and must not be read-only
			if ('$id' in data) this.$id = data.$id
			if ('disable_terms' in data) this.disable_terms = data.disable_terms
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

	validateMenuOptions(o) {
		if (!o.menuOptions) o.menuOptions = defaultOpts.menuOptions
		// support legacy options, now converted to use glob-style pattern matching
		if (o.menuOptions == 'all') o.menuOptions = '*'
		for (const opt of ['edit', 'reuse', 'replace', 'remove']) {
			if (minimatch(opt, o.menuOptions)) return // matched at least one menu option
		}
		throw `no matches found for termsetting opts.menuOptions='${o.menuOptions}'`
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
				let _
				// @rollup/plugin-dynamic-import-vars cannot use a import variable name in the same dir
				if (typeSubtype == 'numeric.toggle') {
					_ = await import(`./numeric.toggle.js`)
				} else {
					_ = await import(`./handlers/${typeSubtype}.js`)
				}
				this.handlerByType[typeSubtype] = await _.getHandler(this)
			} catch (e) {
				throw `error with handler='./handlers/${typeSubtype}.js': ${e}`
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
				.on('click', (event, d) => {
					if (d == 'delete') self.removeTerm()
					else if (d == 'replace') {
						self.showTree(event.target)
					} else throw 'unknown button'
				})

			// render info button only if term has html details
			if (self.term.hashtmldetail) {
				const infoIcon_div = self.dom.btnDiv.selectAll('div').filter(function() {
					return select(this).text() === 'INFO'
				})
				const content_holder = select(self.dom.holder.node().parentNode).append('div')

				// TODO: modify termInfoInit() to display term info in tip rather than in div
				// can be content_tip: self.dom.tip.d to separate it from content_holder
				const termInfo = await import('#termdb/termInfo')
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

		self.dom.pill_termname.style('border-radius', pillstat.text ? '6px 0 0 6px' : '6px').html(self.handler.getPillName)

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
				.attr('class', 'sja_menuoption sja_sharp_border')
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

		const termdb = await import('#termdb/app')
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
				click_term: async term => {
					self.dom.tip.hide()

					const tw = { id: term.id, term, q: { isAtomic: true }, isAtomic: true }
					if (self.opts.customFillTw) self.opts.customFillTw(tw)
					await call_fillTW(tw, self.vocabApi, self.opts.defaultQ4fillTW)
					// tw is now furbished

					self.opts.callback(tw)
				}
			}
		})
	}

	self.showMenu = (event, clickedElem = null, menuHolder = null) => {
		const tip = self.dom.tip
		tip.clear()
		// self.dom.holder really is set to clickedElem because
		// handler showEditMenu() use if for tip.showunder(self.dom.holder)
		if (self.opts.renderAs == 'none' && clickedElem) self.dom.holder = select(clickedElem)
		if (self.dom.holder) {
			const elem = self.dom.holder.node()
			if (elem) tip.showunder(elem)
			else tip.show(event.clientX, event.clientY)
		}

		const options = []
		if (self.q && !self.q.groupsetting?.disabled && minimatch('edit', self.opts.menuOptions)) {
			options.push({ label: 'Edit', callback: self.handler.showEditMenu })
		}

		if (minimatch('reuse', self.opts.menuOptions)) {
			options.push({ label: 'Reuse', callback: self.showReuseMenu })
		}

		if (minimatch('replace', self.opts.menuOptions)) {
			options.push({ label: 'Replace', callback: self.showTree })
		}

		if (minimatch('remove', self.opts.menuOptions)) {
			options.push({ label: 'Remove', callback: self.removeTerm })
		}

		const d3elem = menuHolder || tip.d
		d3elem
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.style('display', self.opts.menuLayout == 'horizontal' ? 'inline-block' : 'block')
			.text(d => d.label)
			.on('click', (event, d) => {
				self.dom.tip.clear()
				d.callback(self.dom.tip.d)
			})

		//self.showFullMenu(tip.d, self.opts.menuOptions)
	}

	self.showReuseMenu = async function(_div) {
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
				self.runCallback()
				self.dom.tip.hide()
			})

		const tableWrapper = _div.append('div').style('margin', '10px')
		const defaultTw = { term: self.term }
		await fillTermWrapper(defaultTw, self.vocabApi)
		defaultTw.q.reuseId = 'Default'
		qlst.push(defaultTw.q)
		if (qlst.length > 1) {
			tableWrapper
				.append('div')
				.style('color', '#aaa')
				.html('Previously saved settings')
		}

		tableWrapper
			.append('table')
			.selectAll('tr')
			.data(qlst)
			.enter()
			.append('tr')
			.style('margin', '2px 5px')
			.each(function(q) {
				const tr = select(this)
				const inuse = equivalentQs(self.q, q)
				tr.append('td')
					.style('min-width', '180px')
					//.style('border-bottom', '1px solid #eee')
					.style('text-align', 'center')
					.html(q.name || q.reuseId)

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
							self.runCallback()
						})
				}

				const deleteTd = tr.append('td').style('text-align', 'center')
				if (!inuse && q.reuseId != 'Default') {
					deleteTd
						.append('button')
						.style('min-width', '80px')
						.html('Delete')
						.on('click', async () => {
							await self.vocabApi.uncacheTermQ(self.term, q)
							self.dom.tip.hide()
							self.runCallback()
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

	self.showGeneSearch = clickedElem => {
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
						: await self.vocabApi.findTerm(str, self.activeCohort, self.usecase, 'gene')
					resultsDiv.selectAll('*').remove()
					resultsDiv
						.selectAll('div')
						.data(results.lst.filter(g => !selectedGenes.has(g)))
						.enter()
						.append('div')
						.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
						.style('display', 'block')
						.style('margin', '2px 3px')
						.style('width', 'fit-content')
						.text(gene => gene.name)
						.on('click', gene => {
							self.dom.tip.hide()
							self.runCallback({
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
function equivalentQs(q0, q1) {
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
defaultQ{}
	supply the optional default q{}
	value is { condition: {mode:'binary'}, ... }
	with term types as keys
*/
export async function fillTermWrapper(tw, vocabApi, defaultQ) {
	tw.isAtomic = true
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
	tw.q.isAtomic = true

	// call term-type specific logic to fill tw
	await call_fillTW(tw, vocabApi, defaultQ)

	mayValidateQmode(tw)
	return tw
}

async function call_fillTW(tw, vocabApi, defaultQ) {
	if (!tw.$id) tw.$id = `${$id++}${idSuffix}`
	const t = tw.term.type
	const type = t == 'float' || t == 'integer' ? 'numeric.toggle' : t
	let _
	if (type == 'numeric.toggle') _ = await import(`./numeric.toggle.js`)
	else if (tw.term.type) {
		try {
			_ = await import(`./handlers/${type}.js`)
		} catch (error) {
			throw `Type ${type} does not exist`
		}
	} else throw `Type not defined for ${JSON.stringify(tw)}`
	await _.fillTW(tw, vocabApi, defaultQ ? defaultQ[type] : null)
}

function mayValidateQmode(tw) {
	if (!('mode' in tw.q)) {
		// at this stage q.mode is allowed to be missing and will not validate
		return
	}
	// q.mode is set. here will validate
	if (typeof tw.q.mode != 'string') throw 'q.mode not string'
	if (tw.q.mode == '') throw 'q.mode is empty string'
	// handler code should implement term type-specific validations
	// e.g. to prevent cases such as mode=continuous for categorical term
}

export function set_hiddenvalues(q, term) {
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
