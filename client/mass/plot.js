import { getCompInit, copyMerge, multiInit } from '#rx'
import { Menu } from '#dom/menu'
import { recoverInit } from '../rx/src/recover'
import { select as d3select } from 'd3-selection'
import { importPlot } from '#plots/importPlot.js'
import { filterRxCompInit } from '#filter'

/*
	MassPlot is a "wrapper" for chart component(s).
	It creates expected plot-specific elements like an error div, undo-redo buttons, and local filter.
*/
class MassPlot {
	constructor(opts) {
		this.type = 'plot'
		setRenderers(this)
		this.initUi(opts)
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.endsWith('_group')) return true
		if (action.type.startsWith('plot_'))
			return action.id === this.id || action.parentId === this.id || action.config?.parentId === this.id
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		if (action.type.endsWith('customTerm')) return true
	}

	// !!! NOTE: This getState() method is reused by the plot-specific recover component.
	// When logging something within getState, it may have been called by either the plot or recover instance
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config,
			groups: appState.groups,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async main() {
		this.dom.errdiv.style('display', 'none').style('background-color', 'rgba(255,100,100,0.2)').html('')
		if (!this.components) await this.setComponents(this.opts)
	}

	async setComponents(opts) {
		const _ = await importPlot(opts.chartType)
		const promises = {
			recover: recoverInit({
				app: this.app,
				holder: this.dom.localRecoverDiv,
				getState: appState => this.getState(appState),
				reactsTo: action =>
					action.id == this.id &&
					(action.type == 'plot_edit' || action.type == 'plot_nestedEdits') &&
					action._track_ != 'none',
				plot_id: this.id,
				maxHistoryLen: 10,
				hideLabel: true
			}),
			chart: _.componentInit({
				app: this.app,
				holder: this.dom.viz,
				header: this.dom.paneTitleDiv,
				id: this.id,
				plotDiv: d3select(this.dom.holder.app_div.node().parentNode)
				/******* reason for passing plotDiv to chart ********
				- this plot instance may allow to launch a new plot as a persistent sandbox
				  inside mass plotDiv, maintaining the uniform plot appearance despite it's ad-hoc
				  the new plot is not a formal mass plot type, and cannot be done via app.dispatch()
				  thus the need to directly access plotDiv
				- example: mds3 tk from genome browser can launch disco etc
				- having access to plotDiv may offer flexibility for the plot to do stuff

				since plot.js has no access to mass app .dom.plotDiv in which all apps are shown,
				this workarounds gets the parent node of sandbox.app_div which is app.dom.plotDiv
				*/
			})
		}

		if (!this.state.config.hidePlotFilter)
			promises.filter = filterRxCompInit({
				app: this.app,
				vocabApi: this.app.vocabApi,
				parentId: this.id,
				holder: this.dom.filterDiv,
				hideLabel: true,
				emptyLabel: '+Add new filter',
				callback: filter => {
					this.app.dispatch({
						id: this.id,
						type: 'plot_edit',
						config: { filter }
					})
				}
			})

		this.components = await multiInit(promises)
	}

	destroy() {
		// the dom.holder itself is not a d3-selection,
		// so need to specify a destroy function here
		// since the default rx.componentApi.destroy()
		// does not work when dom.holder is not a d3-selection
		this.dom.holder.app_div.selectAll('*').remove()
		this.dom.holder.app_div.remove()
		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

export const plotInit = getCompInit(MassPlot)

function setRenderers(self) {
	self.initUi = function (opts) {
		// opts={app, chartType:str, holder, id, debug}

		const holder = opts.holder // "sandbox" obj: {app_div, body, header, header_row, id}

		// since chartType is already given in constructor opts, create test id with chart type as a simple way to identify the box
		opts.holder.app_div.attr('data-testid', 'sjpp-massplot-sandbox-' + opts.chartType)

		holder.header.style('padding', 0)

		try {
			self.dom = {
				tip: new Menu({ padding: '0px' }),
				holder,
				paneTitleDiv: holder.header
					.append('div')
					.style('display', 'inline-block')
					.style('color', '#555')
					.style('padding-left', '7px')
					.style('vertical-align', 'sub'),
				localRecoverDiv: holder.header.append('div').style('display', 'inline-block'),
				filterDiv: holder.header.append('div').style('display', 'inline-block'),
				body: holder.body
					// .style('margin-top', '-1px')
					.style('white-space', 'nowrap')
					.style('overflow-x', 'auto'),

				// will hold no data notice or the page title in multichart views
				errdiv: holder.body
					.append('div')
					.style('display', 'none')
					.style('padding', '5px')
					.style('background-color', 'rgba(255,100,100,0.2)'),

				// dom.viz will hold the rendered view
				viz: holder.body.append('div')
			}
		} catch (e) {
			self.dom.errdiv.style('display', 'none').text(e)
		}
	}
}
