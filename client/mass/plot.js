import { getCompInit, copyMerge } from '../rx'
import { Menu } from '../src/client'
import { recoverInit } from '../rx/src/recover'

class MassPlot {
	constructor(opts) {
		this.type = 'plot'
		setRenderers(this)
		this.initUi(opts)
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		if (action.type.endsWith('customTerm')) return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async main() {
		this.dom.errdiv.style('display', 'none')
		if (!this.components) await this.setComponents(this.opts)
	}

	async setComponents(opts) {
		this.components = {
			recover: await recoverInit({
				app: this.app,
				holder: this.dom.localRecoverDiv,
				getState: appState => this.getState(appState),
				reactsTo: action =>
					action.id == this.id &&
					(action.type == 'plot_edit' || action.type == 'plot_nestedEdits') &&
					action._track_ != 'none',
				plot_id: this.id,
				maxHistoryLen: 10
			})
		}

		const _ = await import(`../plots/${opts.chartType}.js`)
		this.components.chart = await _.componentInit({
			app: this.app,
			holder: this.dom.viz,
			header: this.dom.paneTitleDiv,
			id: this.id
		})
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
	self.initUi = function(opts) {
		const holder = opts.holder
		holder.header.style('padding', 0)

		try {
			self.dom = {
				tip: new Menu({ padding: '0px' }),
				holder,
				paneTitleDiv: holder.header
					.append('div')
					.style('display', 'inline-block')
					.style('color', '#999')
					.style('padding-left', '7px')
					.style('vertical-align', 'sub'),

				localRecoverDiv: holder.header.append('div').style('display', 'inline-block'),

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

	/*
		TODO: may create option for a custom filter for this plot only,
		which will override the app-wide filter that is set from the nav tab
	*/
	// self.renderFilter = function() {...}
}
