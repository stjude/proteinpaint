import type { TermSettingOpts } from './types'
import { TermSetting } from './TermSetting.ts'
import type { Term, TermWrapper, Filter, GvPredefinedGsTW } from '#types'
import { call_fillTW } from './utils.ts'
import { minimatch } from 'minimatch'
import { isNumericTerm } from '#shared/terms.js'
import { copyMerge, deepEqual } from '#rx'
import { select } from 'd3-selection'
import { TwRouter, CategoricalBase, SnpBase, QualitativeBase } from '#tw'

export const termsettingInit = opts => {
	// TODO: may convert to async-await as needed to initialize,
	// if ever an async TermSettingApi.init() static method is created
	return new TermSettingApi(opts)
}

export class TermSettingApi {
	#termsetting: TermSetting
	Inner?: TermSetting

	constructor(opts: TermSettingOpts) {
		opts.api = this //; console.log(14, opts)
		this.#termsetting = new TermSetting(opts)
		// to be used for test-code only
		if (opts.debug) this.Inner = this.#termsetting
	}

	async main(data: any = {}) {
		const self = this.#termsetting
		try {
			if (self.doNotHideTipInMain) {
				// single use: if true then delete
				self.doNotHideTipInMain = false
			} else {
				self.dom.tip.hide()
			}
			self.hasError = false
			delete self.error
			self.validateMainData(data)
			// TODO: use routedTermTypes.has(data.term?.type) instead of just categorical
			if (!data.tw && QualitativeBase.termTypes.has(data.term?.type)) {
				data.tw = await TwRouter.initRaw({ term: data.term, q: data.q })
			}
			self.tw = data.tw
			// may need original values for comparing edited settings
			self.data = data //as PillData
			// term is read-only if it comes from state, let it remain read-only
			self.term = data.term as Term
			self.q = JSON.parse(JSON.stringify(data.q)) // q{} will be altered here and must not be read-only
			if ('$id' in data) self.$id = data.$id
			if ('disable_terms' in data) self.disable_terms = data.disable_terms
			if ('filter' in data) self.filter = data.filter as Filter
			if ('activeCohort' in data) self.activeCohort = data.activeCohort
			if ('sampleCounts' in data) self.sampleCounts = data.sampleCounts
			if ('menuOptions' in data) self.opts.menuOptions = data.menuOptions
			await self.setHandler(self.term ? self.term.type : null, data.tw)
			if (data.term && self.handler && self.handler.validateQ) self.handler.validateQ(data)
			if (self.handler.postMain) await self.handler.postMain()
			if (self.opts.renderAs != 'none') self.view.updateUI()
		} catch (e) {
			self.hasError = true
			throw e
		}
	}

	async runCallback(overrideTw = null) {
		const self = this.#termsetting
		/* optional termwrapper (tw) to override attributes of self.term{} and self.q{}
		the override tw serves the "atypical" termsetting usage
		as used in snplocus block pan/zoom update in regression.results.js
		*/
		const arg: any = self.term ? { term: self.term, q: self.q, isAtomic: true } : {}
		if ('$id' in this) arg.$id = this.$id
		if (arg.q?.reuseId && arg.q.reuseId === self.data.q?.reuseId) {
			if (!deepEqual(arg.q, self.data.q)) {
				delete arg.q.reuseId
				delete arg.q.name
			}
		}
		const otw = overrideTw ? JSON.parse(JSON.stringify(overrideTw)) : {}
		const tw = overrideTw ? copyMerge(JSON.stringify(arg), otw) : arg
		if (self.tw instanceof CategoricalBase || self.tw instanceof SnpBase)
			self.tw = await TwRouter.initRaw(tw, self.opts)
		if (self.opts.callback) self.opts.callback(tw)
	}

	async showTree(holder, event: MouseEvent | undefined) {
		const self = this.#termsetting
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

	showMenu(event: MouseEvent, clickedElem = null, menuHolder = null) {
		const self = this.#termsetting
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
		const q = self.q as any

		if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
			// term is using groupsetting
			// should provide option to cancel it
			if (q.mode != 'binary' && self.term.type != 'geneVariant') {
				// mode=binary will never use groupsetting
				// geneVariant term can cancel groupsetting within edit menu
				options.push({ label: 'Cancel grouping', callback: () => self.actions.cancelGroupsetting() } as opt)
			}
		}

		if (
			self.q &&
			!self.term.groupsetting?.disabled &&
			self.term.type != 'survival' &&
			minimatch('edit', self.opts.menuOptions)
		) {
			// hide edit option for survival term because its showEditMenu() is disabled
			options.push({
				label: 'Edit',
				callback: async div => {
					if (self.term && isNumericTerm(self.term) && !self.term.bins) {
						const tw = { term: self.term, q: self.q /*, $id: ''*/ }
						//tw.$id = await get$id(tw)
						await self.vocabApi.setTermBins(tw as any) // TODO: fix type
					}
					self.handler!.showEditMenu(div)
				}
			} as opt)
		}

		if (self.term.type == 'geneVariant' && (self.q as any).type == 'predefined-groupset') {
			// display predefined groupsets of geneVariant term
			// for quick access
			const groupsets = self.term.groupsetting?.lst
			if (!groupsets || !groupsets.length) throw 'predefined groupsets not found'
			for (const [i, groupset] of groupsets.entries()) {
				options.push({
					label: groupset.name,
					callback: async () => {
						const tw: GvPredefinedGsTW = {
							type: 'GvPredefinedGsTW',
							isAtomic: true,
							term: self.term,
							q: { type: 'predefined-groupset', predefined_groupset_idx: i, isAtomic: true }
						}
						await call_fillTW(tw, self.vocabApi)
						self.opts.callback(tw)
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
			options.push({
				label: 'Replace',
				callback: (event, d) => {
					this.showTree(event, d)
				}
			} as opt)
		}

		if (minimatch('remove', self.opts.menuOptions)) {
			options.push({ label: 'Remove', callback: () => self.actions.removeTerm() } as opt)
		}

		if (self.opts.customMenuOptions) options.push(...self.opts.customMenuOptions)

		const activeMenu = menuHolder || tip.d
		activeMenu
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

		activeMenu.select('.sja_menuoption').node()?.focus()
		//self.showFullMenu(tip.d, self.opts.menuOptions)
	}

	showGeneSearch(clickedElem: Element | null, event: MouseEvent) {
		const self = this.#termsetting
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
				const cohortStr = self.opts.vocabApi.termdbConfig.selectCohort.values[self.activeCohort || 0].keys
					.slice()
					.sort()
					.join(',')

				try {
					const results = !str ? { lst: [] } : await self.vocabApi.findTerm(str, cohortStr, self.usecase as any, 'gene')
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
						.on('click', async (gene: any) => {
							self.dom.tip.hide()
							this.runCallback({
								term: {
									name: gene.name,
									type: 'geneVariant'
								},
								q: {
									exclude: []
								}
							} as any) // TODO: fix type
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

	hasError() {
		return this.#termsetting.hasError
	}

	validateQ(d /*: PillData*/) {
		const self = this.#termsetting
		if (!self.handler || !self.handler.validateQ) return
		try {
			self.handler.validateQ(d)
		} catch (e) {
			this.#termsetting.hasError = true
			throw e
		}
	}
}
