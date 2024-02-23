import { getAppInit } from '#rx'
import { hicStoreInit } from './store'
import { Div, Elem } from '../../types/d3'
import { showErrorsWithCounter } from '../../dom/sayerror'
import { loadingInit } from './dom/loadingOverlay'
import { controlPanelInit } from './controls/controlPanel'
import { hicViewInit } from './views/view'
import * as client from '#src/client'
import { select as d3select } from 'd3-selection'
import { hicParseFile } from './data/parseData'

class HicApp {
	/** Required for rx */
	api: any
	components: any
	dom: {
		errorDiv: Div | Elem
		controlsDiv: Div | Elem
		infoBarDiv: Div | Elem
		loadingDiv: Div | Elem
		plotDiv: Div | Elem
		tip: client.Menu
	}
	errList: string[]
	hic: {
		enzyme?: string
		file?: string
		url?: string
		genome: any
		holder: Div | Elem
		hostUrl: string
		name: string
		tklist?: any[]
		state?: any
		jwt?: any
	}
	state: any
	/** Required for rx */
	store: any
	/** Required for rx */
	type: 'app'

	constructor(opts) {
		this.type = 'app'
		this.hic = {
			enzyme: opts.enzyme,
			file: opts.file,
			url: opts.url,
			genome: opts.genome,
			holder: opts.holder,
			hostUrl: opts.hostUrl,
			jwt: opts.jwt,
			name: 'name' in opts ? opts.name : 'Hi-C',
			tklist: opts.tklst || [],
			//determine view here??
			state: opts.state || {}
		}
		this.dom = {
			errorDiv: opts.holder.append('div').classed('sjpp-hic-error', true),
			controlsDiv: opts.holder.append('div').classed('sjpp-hic-controls', true).style('display', 'inline-block'),
			infoBarDiv: opts.holder.append('div').classed('sjpp-hic-infobar', true).style('display', 'inline-block'),
			loadingDiv: d3select('body').append('div'),
			// .attr('id', 'sjpp-loading-overlay'),
			plotDiv: opts.holder.append('div').classed('sjpp-hic-main', true).style('display', 'inline-block'),
			tip: new client.Menu()
		}
		this.errList = []
	}

	async error(err: string | string[]) {
		if (err && typeof err == 'string') this.errList.push(err)
		//TODO: Change to dispatch? Show error, remove loading div, maybe show error over plot all at once?
		showErrorsWithCounter(this.errList, this.dom.errorDiv)
		//Remove errors after displaying
		this.errList = []
		//this.dom.loadingDiv.style('display', 'none')
	}

	getState(appState) {
		return appState
	}

	async init() {
		try {
			this.store = await hicStoreInit({ app: this.api, state: this.hic.state })
			this.state = await this.store.copyState()
			await hicParseFile(this.hic, true, this.errList)
			if (this.errList.length) this.error(this.errList)
			this.components = {
				// loadingOverlay: await loadingInit({
				// 	app: this.api,
				// 	state: this.state,
				// 	loadingDiv: this.dom.loadingDiv
				// }),
				controls: await controlPanelInit({
					app: this.api,
					state: this.state,
					controlsDiv: this.dom.controlsDiv,
					hic: this.hic
				}),
				view: await hicViewInit({
					app: this.api,
					state: this.state,
					plotDiv: this.dom.plotDiv.append('table').classed('sjpp-hic-plot-main', true),
					hic: this.hic
				})
			}
			await this.api.dispatch()
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
		}
	}

	main() {
		// console.log(this)
	}
}

export const hicInit = getAppInit(HicApp)
