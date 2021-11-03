import { getCompInit, copyMerge } from '../common/rx.core'
import { select, event } from 'd3-selection'
//import { termInfoInit } from './termInfo'
//import { to_parameter as tvslst_to_parameter } from '../mds.termdb.termvaluesetting.ui'
import { fillTermWrapper } from '../common/termsetting'
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
		this.config = copyMerge('{}', this.state.config)
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
			id: this.id
		})
	}
}

export const plotInit = getCompInit(MassPlot)

function setRenderers(self) {
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
