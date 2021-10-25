import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
//import { termInfoInit } from './termInfo'
//import { to_parameter as tvslst_to_parameter } from '../mds.termdb.termvaluesetting.ui'
import { termsetting_fill_q } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { Menu } from '../client'

class MassPlot {
	constructor(opts) {
		this.type = 'plot'
		this.modifiers = opts.modifiers
		setRenderers(this)
	}

	async init() {
		try {
			this.dom = {
				tip: new Menu({ padding: '0px' }),

				holder: this.opts.holder,

				body: this.opts.holder.body
					// .style('margin-top', '-1px')
					.style('white-space', 'nowrap')
					.style('overflow-x', 'auto'),

				// will hold no data notice or the page title in multichart views
				banner: this.opts.holder.body.append('div').style('display', 'none'),

				// dom.viz will hold the rendered view
				viz: this.opts.holder.body.append('div')
			}
		} catch (e) {
			throw e
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found.`
		}
		const filter = getNormalRoot(appState.termfilter.filter)
		return {
			activeCohort: appState.activeCohort,
			vocab: appState.vocab,
			termfilter: { filter },
			ssid: appState.ssid,
			config,

			cumincplot4condition: appState.termdbConfig.cumincplot4condition,
			displayAsSurvival:
				config.settings &&
				config.settings.currViews &&
				config.settings.currViews[0] != 'regression' &&
				((config.term && config.term.term.type == 'survival') || (config.term2 && config.term2.term.type == 'survival'))
		}
	}

	async main() {
		// need to make config writable for filling in term.q default values
		this.config = rx.copyMerge('{}', this.state.config)
		if (!this.components) await this.setComponents(this.opts)
	}

	async setComponents(opts) {
		this.components = {}

		const paneTitleDiv = this.dom.holder.header
			.append('div')
			.style('display', 'inline-block')
			.style('color', '#999')
			.style('padding-left', '7px')

		const _ = await import(`../plots/${opts.chartType}.js`)
		this.components.chart = await _.componentInit({
			app: this.app,
			holder: this.dom.viz,
			header: paneTitleDiv,
			id: this.id,
			opts // hope it's reasonable to pass this to constructor
		})
	}
}

export const plotInit = rx.getCompInit(MassPlot)

function setRenderers(self) {
	self.showMultipart = async function(_config) {
		const config = JSON.parse(JSON.stringify(_config))
		const dom = {
			body: this.dom.controls.append('div'),
			foot: this.dom.controls.append('div')
		}
		const disable_terms = []

		dom.body
			.selectAll('div')
			.data(config.termSequence)
			.enter()
			.append('div')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.each(function(d) {
				const pills = []
				const div = select(this)
				div
					.append('div')
					.style('margin', '3px 5px')
					.style('padding', '3px 5px')
					.style('font-weight', 600)
					.text(d.label)

				if (config[d.detail]) {
					if (!d.selected) d.selected = config[d.detail]
					if (Array.isArray(d.selected)) {
						for (const t of d.selected) {
							if (!disable_terms.includes(t.id)) disable_terms.push(t.id)
						}
					} else {
						if (!disable_terms.includes(d.selected.id)) disable_terms.push(d.selected.id)
					}
				}
				if (d.limit > 1 && config[d.detail] && config[d.detail].length) {
					for (const term of config[d.detail]) {
						self.newPill(d, config, div, pills, disable_terms, term)
					}
				}
				self.newPill(d, config, div.append('div'), pills, disable_terms, d.limit === 1 && config[d.detail])
			})

		self.dom.submitBtn = dom.foot
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')
			.append('button')
			.html('Run analysis')
			.on('click', () => {
				self.dom.tip.hide()
				for (const t of config.termSequence) {
					config[t.detail] = t.selected
					if ('cutoff' in t) config.cutoff = t.cutoff
				}
				self.app.dispatch({
					type: _config.term ? 'plot_edit' : 'plot_show',
					id: self.id,
					chartType: config.chartType,
					config
				})
			})

		self.updateBtns(config)
	}

	self.newPill = function(d, config, div, pills, disable_terms, term = null) {
		const pillDiv = div.append('div').style('width', 'fit-content')

		const newPillDiv = pillDiv
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')

		const pill = termsettingInit({
			placeholder: d.prompt,
			holder: newPillDiv,
			vocabApi: self.app.vocabApi,
			vocab: self.state && self.state.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			usecase: { target: config.chartType, detail: d.detail },
			disable_terms,
			callback: term => {
				if (!term) {
					const i = pills.indexOf(pill)
					if (Array.isArray(d.selected)) d.selected.splice(i, 1)
					else delete d.selected
					pills.splice(i, 1)
					disable_terms.splice(i, 1)
					if (d.limit > 1) {
						newPillDiv.remove()
					}
					self.updateBtns(config)
					cutoffDiv.style('display', 'none')
				} else {
					if (!disable_terms.includes(term.term.id)) {
						disable_terms.push(term.term.id)
					}
					pill.main(term)
					if (d.limit > 1) {
						if (!d.selected) d.selected = []
						d.selected.push(term)
						if (d.selected.length < d.limit) {
							self.newPill(d, config, div, pills, disable_terms)
						}
					} else {
						d.selected = term
					}
					self.updateBtns(config)
					cutoffDiv.style(
						'display',
						d.cutoffTermTypes && d.cutoffTermTypes.includes(term.term.type) ? 'inline-block' : 'none'
					)
				}
			}
		})

		pills.push(pill)
		if (term) pill.main(term)

		const cutoffDiv = pillDiv
			.append('div')
			.style(
				'display',
				term && d.cutoffTermTypes && d.cutoffTermTypes.includes(term.term.type) ? 'inline-block' : 'none'
			)
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')

		const cutoffLabel = cutoffDiv.append('span').html('Use cutoff of ')

		const useCutoffInput = cutoffDiv
			.append('input')
			.attr('type', 'number')
			.style('width', '50px')
			.style('text-align', 'center')
			.on('change', () => {
				const value = useCutoffInput.property('value')
				if (value === '') delete d.cutoff
				else d.cutoff = Number(value)
			})

		cutoffDiv.append('span').html(' (leave blank to disable)')
	}

	self.updateBtns = config => {
		const hasMissingTerms =
			config.termSequence.filter(t => !t.selected || (t.limit > 1 && !t.selected.length)).length > 0
		self.dom.submitBtn
			.property('disabled', hasMissingTerms)
			.style('background-color', hasMissingTerms ? '' : 'rgba(143, 188, 139, 0.7)')
			.style('color', hasMissingTerms ? '' : '#000')
	}
}

export function q_to_param(q) {
	// exclude certain attributes of q from dataName
	const q2 = JSON.parse(JSON.stringify(q))
	delete q2.hiddenValues
	return encodeURIComponent(JSON.stringify(q2))
}

export function plotConfig(opts, appState = {}) {
	if (!opts.term) throw 'plotConfig: opts.term{} missing'
	if (!opts.term.term) throw 'plotConfig: opts.term.term{} missing'
	if (!opts.term.term.id) throw 'plotConfig: opts.term.term.id missing'

	// initiate .q{}
	fillTermWrapper(opts.term)
	if (opts.term2) fillTermWrapper(opts.term2)
	if (opts.term0) fillTermWrapper(opts.term0)

	const config = {
		id: opts.term.term.id,
		independent: [],
		settings: {
			currViews: ['barchart'],
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			common: {
				use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
				use_percentage: false,
				barheight: 300, // maximum bar length
				barwidth: 20, // bar thickness
				barspace: 2 // space between two bars
			},
			boxplot: {
				toppad: 20, // top padding
				yaxis_width: 100,
				label_fontsize: 15,
				barheight: 400, // maximum bar length
				barwidth: 25, // bar thickness
				barspace: 5 // space between two bars
			},
			barchart: {
				orientation: 'horizontal',
				unit: 'abs',
				overlay: 'none',
				divideBy: 'none'
			},
			scatter: {
				currLine: 0,
				svgw: 400,
				svgh: 400,
				svgPadding: {
					top: 10,
					left: 80,
					right: 10,
					bottom: 50
				},
				chartMargin: 5,
				chartTitleDivHt: 30,
				radius: 5,
				axisTitleFontSize: 14,
				scale: 'byChart', // byGroup | byChart
				ciVisible: true,
				fillOpacity: 0.2,
				duration: 1000
			},
			cuminc: {
				gradeCutoff: 3,
				radius: 5,
				fill: '#fff',
				stroke: '#000',
				fillOpacity: 0,
				chartMargin: 10,
				svgw: 400,
				svgh: 300,
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				hidden: []
			},

			termInfo: {
				isVisible: false
			},

			survival: {
				radius: 5,
				ciVisible: false,
				fill: '#fff',
				stroke: '#000',
				fillOpacity: 0,
				chartMargin: 10,
				svgw: 400,
				svgh: 300,
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				hidden: []
			}
		}
	}

	// may apply term-specific changes to the default object
	return rx.copyMerge(config, opts)
}

export function normalizeFilterData(filter) {
	const lst = []
	for (const item of filter.lst) {
		if (item.type == 'tvslst') lst.push(normalizeFilterData(item))
		else
			lst.push({
				type: 'tvs',
				tvs: tvslst_to_parameter(item.tvs)
			})
	}
	return {
		type: 'tvslst',
		join: filter.join,
		in: filter.in,
		lst
	}
}

function tvslst_to_parameter(tv) {
	// apply on the terms[] array of a group
	// TODO and/or between multiple terms
	return {
		term: {
			id: tv.term.id,
			iscategorical: tv.term.iscategorical,
			isfloat: tv.term.isfloat,
			isinteger: tv.term.isinteger,
			iscondition: tv.term.iscondition,
			type:
				// to-do: delete this code block when all term.is* has been removed from code
				tv.term.type
					? tv.term.type
					: tv.term.iscategorical
					? 'categorical'
					: tv.term.isfloat
					? 'float'
					: tv.term.isinteger
					? 'integer'
					: tv.term.iscondition
					? 'condition'
					: ''
		},
		// must return original values[{key,label}] to keep the validator function happy on both client/server
		values: tv.values,
		ranges: tv.ranges,
		isnot: tv.isnot,
		bar_by_grade: tv.bar_by_grade,
		bar_by_children: tv.bar_by_children,
		value_by_max_grade: tv.value_by_max_grade,
		value_by_most_recent: tv.value_by_most_recent,
		value_by_computable_grade: tv.value_by_computable_grade,
		grade_and_child: tv.grade_and_child
	}
}

export function fillTermWrapper(wrapper) {
	if (!('id' in wrapper)) wrapper.id = wrapper.term.id
	if (!wrapper.q) wrapper.q = {}
	termsetting_fill_q(wrapper.q, wrapper.term)
	return wrapper
}

export function syncParams(config, data) {
	if (!data || !data.refs) return
	for (const [i, key] of ['term0', 'term', 'term2'].entries()) {
		const term = config[key]
		if (term == 'genotype') return
		if (!term) {
			if (key == 'term') throw `missing plot.term{}`
			return
		}
		if (data.refs.bins) {
			term.bins = data.refs.bins[i]
			if (data.refs.q && data.refs.q[i]) {
				if (!term.q) term.q = {}
				const q = data.refs.q[i]
				if (q !== term.q) {
					for (const key in term.q) delete term.q[key]
					Object.assign(term.q, q)
				}
			}
		}
		if (!term.q) term.q = {}
		if (!term.q.groupsetting) term.q.groupsetting = {}
	}
}
