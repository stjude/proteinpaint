import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { controlsInit } from './plot.controls'
import { barInit } from './barchart'
import { statTableInit } from './stattable'
import { tableInit } from './table'
import { boxplotInit } from './boxplot'
import { scatterInit } from './scatter'
import { cumincInit } from './cuminc'
import { termInfoInit } from './termInfo'
//import { to_parameter as tvslst_to_parameter } from '../mds.termdb.termvaluesetting.ui'
import { termsetting_fill_q } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'

class TdbPlot {
	constructor(app, opts) {
		this.type = 'plot'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.app = app
		this.modifiers = opts.modifiers

		this.dom = {
			holder: opts.holder
				.style('margin-top', '-1px')
				.style('white-space', 'nowrap')
				.style('overflow-x', 'auto'),

			// will hold no data notice or the page title in multichart views
			banner: opts.holder.append('div').style('display', 'none'),

			// dom.controls will hold the config input, select, button elements
			controls: opts.holder
				.append('div')
				.attr('class', 'pp-termdb-plot-controls')
				.style('display', 'inline-block'),

			// dom.viz will hold the rendered view
			viz: opts.holder
				.append('div')
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')
		}

		const controls = controlsInit(
			this.app,
			{
				id: this.id,
				holder: this.dom.controls,
				isleaf: opts.term.isleaf,
				iscondition: opts.term.type == 'condition'
			},
			this.app.opts.plotControls
		)

		this.components = {
			controls,
			barchart: barInit(
				this.app,
				{ holder: this.dom.viz.append('div'), id: this.id },
				Object.assign({ controls }, this.app.opts.barchart)
			),
			stattable: statTableInit(this.app, { holder: this.dom.viz.append('div'), id: this.id }, this.app.opts.stattable),
			table: tableInit(
				this.app,
				{ holder: this.dom.viz.append('div'), id: this.id },
				Object.assign({ controls }, this.app.opts.table)
			),
			boxplot: boxplotInit(
				this.app,
				{ holder: this.dom.viz.append('div'), id: this.id },
				Object.assign({ controls }, this.app.opts.boxplot)
			),
			scatter: scatterInit(
				this.app,
				{ holder: this.dom.viz.append('div'), id: this.id },
				Object.assign({ controls }, this.app.opts.scatter)
			),
			termInfo: termInfoInit(this.app, { holder: this.dom.viz.append('div'), id: this.id }, this.app.opts.termInfo)
		}

		if (opts.term.type == 'condition') {
			this.components.cuminc = cumincInit(
				this.app,
				{ holder: this.dom.viz.append('div'), id: this.id },
				Object.assign({ controls }, this.app.opts.cuminc)
			)
		}

		this.eventTypes = ['postInit', 'postRender']
	}

	reactsTo(action) {
		if (action.type == 'plot_edit' || action.type == 'plot_show') {
			return action.id == this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${this.id}' found.`
		}
		const filter = getNormalRoot(appState.termfilter.filter)
		return {
			activeCohort: appState.activeCohort,
			termfilter: { filter },
			config: appState.tree.plots[this.id],
			ssid: appState.ssid
		}
	}

	async main() {
		// need to make config writable for filling in term.q default values
		this.config = rx.copyMerge('{}', this.state.config)
		const dataName = this.getDataName(this.state)
		const data = await this.app.vocabApi.getPlotData(this.id, dataName)
		if (data.error) throw data.error
		this.syncParams(this.config, data)
		this.currData = data
		return data
	}

	// creates URL search parameter string, that also serves as
	// a unique request identifier to be used for caching server response
	getDataName(state) {
		const plot = this.config // the plot object in state
		const params = []

		if (plot.settings.currViews.includes('cuminc')) {
			params.push('getcuminc=1')
			params.push(`grade=${plot.settings.cuminc.gradeCutoff}`)
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
}

export const plotInit = rx.getInitFxn(TdbPlot)

function q_to_param(q) {
	// exclude certain attributes of q from dataName
	const q2 = JSON.parse(JSON.stringify(q))
	delete q2.hiddenValues
	return encodeURIComponent(JSON.stringify(q2))
}

export function plotConfig(opts) {
	if (!opts.term) throw 'plotConfig: opts.term{} missing'
	if (!opts.term.term) throw 'plotConfig: opts.term.term{} missing'
	if (!opts.term.term.id) throw 'plotConfig: opts.term.term.id missing'

	// initiate .q{}
	if (!('id' in opts.term)) opts.term.id = opts.term.term.id
	if (!opts.term.q) opts.term.q = {}
	termsetting_fill_q(opts.term.q, opts.term.term)
	if (opts.term2) {
		if (!('id' in opts.term2)) opts.term2.id = opts.term2.term.id
		if (!opts.term2.q) opts.term2.q = {}
		termsetting_fill_q(opts.term2.q, opts.term2.term)
	}
	if (opts.term0) {
		if (!('id' in opts.term0)) opts.term0.id = opts.term0.term.id
		if (!opts.term0.q) opts.term0.q = {}
		termsetting_fill_q(opts.term0.q, opts.term0.term)
	}

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
