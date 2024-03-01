import { getAppInit } from '#rx'
import { hicStoreInit } from './store'
import { Div, Dom, Elem } from '../../types/d3'
import { showErrorsWithCounter } from '../../dom/sayerror'
import { loadingInit } from './dom/loadingOverlay'
// import { controlPanelInit } from './controls/controlPanel'
// import { infoBarInit } from './dom/infoBar'
import { hicViewInit } from './views/view'
import * as client from '#src/client'
import { select as d3select } from 'd3-selection'
import { HicDataMapper } from './data/dataMapper'

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
	dataMapper: any
	views = ['genome', 'chrpair', 'detail', 'horizontal']

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
			tklist: 'tklst' in opts ? opts.tklst : [],
			state: 'state' in opts ? opts.state : {}
		}
		this.dom = {
			errorDiv: opts.holder.append('div').classed('sjpp-hic-error', true),
			controlsDiv: opts.holder.append('div').classed('sjpp-hic-controls', true).style('display', 'inline-block'),
			infoBarDiv: opts.holder
				.append('div')
				.classed('sjpp-hic-infobar', true)
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('padding', '5px')
				.style('border', 'solid 0.5px #ccc'),
			loadingDiv: d3select('body').append('div'),
			// .attr('id', 'sjpp-loading-overlay'),
			plotDiv: opts.holder.append('div').classed('sjpp-hic-main', true).style('display', 'inline-block'),
			tip: new client.Menu()
		}
		this.errList = []
	}

	async error(err: string | string[]) {
		if (err && typeof err == 'string') this.errList.push(err)
		showErrorsWithCounter(this.errList, this.dom.errorDiv)
		//Remove errors after displaying
		this.errList = []
	}

	determineView() {
		//TODO figure out view based on opts
		//Will be useful when runpp() for chrPair and detailed view is implemented
		if (!this.hic.state.currView) this.hic.state.currView = 'genome'
		else {
			if (!this.views.some(v => v === this.hic.state.currView)) this.error(`Unknown view: ${this.hic.state.currView}`)
			else return this.hic.state.currView
		}
	}

	getViewsConfig() {
		const nmeth = this.hic['normalization'].length ? this.hic['normalization'][0] : this.state.defaultNmeth

		//If currView provided without state, add state
		if (this.hic.state.currView) {
			if (!this.hic.state[this.hic.state.currView]) this.hic.state[this.hic.state.currView] = {}
			if (!this.hic.state[this.hic.state.currView]?.matrixType) {
				this.hic.state[this.hic.state.currView].matrixType = 'observed'
			}
			if (!this.hic.state[this.hic.state.currView]?.nemth) {
				this.hic.state[this.hic.state.currView].nmeth = nmeth
			}
		}

		//Add default state for all views
		for (const v of this.views) {
			if (!this.hic.state[v]) {
				this.hic.state[v] = {
					matrixType: 'observed',
					nmeth: nmeth
				}
			}
		}
	}

	async init() {
		this.determineView()
		try {
			this.dataMapper = new HicDataMapper(this.hic, true, this.errList)
			await this.dataMapper.getHicStraw(this.hic, true, this.errList)
			this.getViewsConfig()

			this.store = await hicStoreInit({ app: this.api, state: this.hic.state })
			this.state = await this.store.copyState()

			this.components = {
				// loadingOverlay: await loadingInit({
				// 	app: this.api,
				// 	state: this.state,
				// 	loadingDiv: this.dom.loadingDiv
				// }),
				view: await hicViewInit({
					app: this.api,
					state: this.state,
					dom: this.dom,
					hic: this.hic,
					dataMapper: this.dataMapper,
					errList: this.errList,
					error: this.error
				})
			}
			await this.api.dispatch()
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
		}
	}

	main() {
		//I'm a comment so ts doesn't complain
	}
}

export const hicInit = getAppInit(HicApp)
