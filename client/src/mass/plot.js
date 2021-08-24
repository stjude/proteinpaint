import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { controlsInit } from '../termdb/plot.controls'
import { barInit } from '../termdb/barchart'
//import { statTableInit } from './stattable'
import { tableInit } from '../termdb/table'
//import { boxplotInit } from './boxplot'
//import { scatterInit } from './scatter'
import { cumincInit } from '../termdb/cuminc'
import { survivalInit } from '../termdb/survival'
import { regressionInit } from './regression'
//import { termInfoInit } from './termInfo'
//import { to_parameter as tvslst_to_parameter } from '../mds.termdb.termvaluesetting.ui'
import { termsetting_fill_q, termsettingInit } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { Menu } from '../client'

class MassPlot {
	constructor(app, opts) {
		this.type = 'plot'
		this.id = opts.plot.id
		this.api = rx.getComponentApi(this)
		this.app = app
		this.modifiers = opts.modifiers
		this.opts = opts

		this.dom = {
			tip: new Menu({ padding: '0px' }),

			holder: opts.holder,

			body: opts.holder.body
				.style('margin-top', '-1px')
				.style('white-space', 'nowrap')
				.style('overflow-x', 'auto'),

			// will hold no data notice or the page title in multichart views
			banner: opts.holder.body.append('div').style('display', 'none'),

			// dom.controls will hold the config input, select, button elements
			controls: opts.holder.body
				.append('div')
				.attr('class', 'pp-termdb-plot-controls')
				.style('display', opts.plot.chartType === 'regression' ? 'block' : 'inline-block'),

			// dom.viz will hold the rendered view
			viz: opts.holder.body
				.append('div')
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')
		}

		const controls =
			opts.plot.chartType === 'regression'
				? null
				: controlsInit(
						this.app,
						{
							id: this.id,
							holder: this.dom.controls,
							isleaf: opts.plot.term.isleaf,
							iscondition: opts.plot.term.type == 'condition'
						},
						this.app.opts.plotControls
				  )

		this.components = controls ? { controls } : {}
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	reactsTo(action) {
		if (action.type == 'plot_edit' || action.type == 'plot_show' || action.type == 'plot_prep') {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		const config = appState.tree.plots[this.id]
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
				config?.settings?.currViews[0] != 'regression' &&
				(config?.term?.term?.type == 'survival' || config?.term2?.term?.type == 'survival')
		}
	}

	async main() {
		// need to make config writable for filling in term.q default values
		this.config = rx.copyMerge('{}', this.state.config)
		if (!this.components.chart) this.setChartComponent(this.opts)
		if (this.dom.resultsHeading) this.dom.resultsHeading.html(this.state.config.term ? '<b>Results<b>' : '')
		if (this.state.config.term) {
			this.dom.holder.header.html(this.state.config.term.term.name)
			const dataName = this.getDataName(this.state)
			const data = await this.app.vocabApi.getPlotData(this.id, dataName)
			if (data.error) throw data.error
			this.syncParams(this.config, data)
			this.currData = data
			return data
		}
	}

	// creates URL search parameter string, that also serves as
	// a unique request identifier to be used for caching server response
	getDataName(state) {
		const plot = this.config // the plot object in state
		const params = []
		if (state.displayAsSurvival) {
			params.push('getsurvival=1')
		} else if (plot.settings.currViews.includes('cuminc')) {
			params.push('getcuminc=1')
			params.push(`grade=${plot.settings.cuminc.gradeCutoff}`)
		} else if (plot.settings.currViews.includes('regression')) {
			params.push('getregression=1')
			if ('cutoff' in plot) {
				params.push('cutoff=' + plot.cutoff)
			}
			if ('cutoff' in plot || (plot.term.term.values && Object.keys(plot.term.term.values).length === 2)) {
				params.push('regressionType=logistic')
			}
			if (plot.independent) {
				params.push(
					'independent=' +
						encodeURIComponent(
							JSON.stringify(
								plot.independent.map(t => {
									return { id: t.id, q: t.q, type: t.term.type }
								})
							)
						)
				)
			}
		}

		const isscatter = plot.settings.currViews.includes('scatter')
		if (isscatter) params.push('scatter=1')
		;['term', 'term2', 'term0'].forEach(_key => {
			// "term" on client is "term1" at backend
			const term = plot[_key]
			if (!term) return
			const key = _key == 'term' ? 'term1' : _key
			params.push(key + '_id=' + encodeURIComponent(term.term.id))
			if (isscatter) return
			if (!term.q) throw 'plot.' + _key + '.q{} missing: ' + term.term.id
			params.push(key + '_q=' + q_to_param(term.q))
		})

		if (!isscatter) {
			if (state.ssid) {
				params.push(
					'term2_is_genotype=1',
					'ssid=' + state.ssid.ssid,
					'mname=' + state.ssid.mutation_name,
					'chr=' + state.ssid.chr,
					'pos=' + state.ssid.pos
				)
			}
		}

		if (state.termfilter.filter.lst.length) {
			const filterData = normalizeFilterData(state.termfilter.filter)
			params.push('filter=' + encodeURIComponent(JSON.stringify(filterData))) //encodeNestedFilter(state.termfilter.filter))
		}
		return '?' + params.join('&')
	}

	syncParams(config, data) {
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

	setChartComponent(opts) {
		const controls = this.components.controls
		switch (opts.plot.chartType) {
			case 'barchart':
				this.components.chart = barInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls }, this.app.opts.barchart)
				)
				/*this.components.stattable = statTableInit(
					this.app, 
					{ holder: this.dom.viz.append('div'), id: this.id }, 
					this.app.opts.stattable
				)*/
				break

			case 'table':
				this.components.chart = tableInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls }, this.app.opts.table)
				)
				break

			case 'boxplot':
				this.components.chart = boxplotInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls }, this.app.opts.boxplot)
				)
				break

			case 'scatter':
				this.components.chart = scatterInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls }, this.app.opts.scatter)
				)
				break

			case 'cuminc':
				this.components.chart = this.components.cuminc = cumincInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls }, this.app.opts.cuminc)
				)
				break

			case 'survival':
				this.components.chart = survivalInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({ controls: this.components.controls }, this.app.opts.survival)
				)
				break

			case 'regression':
				this.showMultipart(rx.copyMerge({}, this.state.config))
				this.dom.resultsHeading = this.dom.viz.append('div').style('margin', '10px 5px')
				this.components.chart = regressionInit(
					this.app,
					{ holder: this.dom.viz.append('div'), id: this.id },
					Object.assign({}, this.app.opts.survival)
				)
		}
	}
}

export const plotInit = rx.getInitFxn(MassPlot)

function setRenderers(self) {
	self.showMultipart = async function(_config) {
		const config = JSON.parse(JSON.stringify(_config))
		const dom = {
			body: this.dom.controls.append('div'),
			foot: this.dom.controls.append('div')
		}
		const disable_terms = []
		const pills = []

		dom.body
			.selectAll('div')
			.data(config.termSequence)
			.enter()
			.append('div')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.each(function(d) {
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
				if (d.limit > 1 && config?.[d.detail] && config[d.detail].length) {
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
			vocab: self.state?.vocab,
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

function q_to_param(q) {
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

function normalizeFilterData(filter) {
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
