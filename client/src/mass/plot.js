import { getCompInit, copyMerge } from '../common/rx.core'
import { Menu } from '../client'

class MassPlot {
	constructor(opts) {
		this.type = 'plot'
		setRenderers(this)
		this.initUi()
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	async main() {
		this.dom.errdiv.style('display', 'none')
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
	self.initUi = function(opts) {
		const holder = opts.holder
		try {
			self.dom = {
				tip: new Menu({ padding: '0px' }),
				holder,
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
