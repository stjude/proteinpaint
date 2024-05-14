import { getAppInit } from '#rx'
import { hicStoreInit } from './HicStore'
import { RestrictionEnzyme } from '../../types/hic'
import { Div, Elem } from '../../types/d3'
import { showErrorsWithCounter } from '../../dom/sayerror'
import { loadingInit } from './dom/LoadingOverlay.ts'
import { viewCompInit } from './HicComponent.ts'
import { Menu } from '#src/client'
import { select as d3select } from 'd3-selection'
import { hicParseFile } from './data/parseData'

class HicApp {
	/** Required for rx */
	api: any
	components: any
	dom: {
		errorDiv: Elem
		controlsDiv: Elem
		infoBarDiv: Elem
		loadingDiv: Div
		plotDiv: Elem
		tip: Menu
	}
	hic: {
		enzyme?: RestrictionEnzyme
		file?: string
		url?: string
		genome: any
		holder: Div
		hostUrl: string
		name: string
		position1?: string
		position2?: string
		tklist?: any[]
		state?: any
		jwt?: any
	}
	state: any
	/** Required for rx */
	store: any
	/** Required for rx */
	type: 'app'
	views = ['genome', 'chrpair', 'detail', 'horizontal']
	errList: string[] = []

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
			position1: opts.position1,
			position2: opts.position2,
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
			loadingDiv: d3select('body').append('div').attr('id', 'sjpp-loading-overlay'),
			plotDiv: opts.holder.append('div').classed('sjpp-hic-main', true).style('display', 'inline-block'),
			tip: new Menu()
		}
	}

	async error(err: string | string[]) {
		/** There might be data inconsistency with hic file.
		 * It may be missing data for chromosomes that are present in the header;
		 * querying such chr will result in error being thrown.
		 * do not flood ui with such errors, to tolerate, collect all errors and show in one place
		 */
		if (err && typeof err == 'string') this.errList.push(err)
		showErrorsWithCounter(this.errList, this.dom.errorDiv)
		//Remove errors after displaying
		this.errList = []
	}

	determineView() {
		if (!this.hic.position1 && !this.hic.position2 && !this.hic.state.currView) this.hic.state.currView = 'genome'
		if (!this.hic.position1 && this.hic.position2) this.errList.push('Missing first position')
		if (this.hic.position1 && !this.hic.position2) this.errList.push('Missing second position')
		if (this.hic.position1 && this.hic.position2) {
			const pos1 = this.hic.position1.split(/[:-]/)
			const pos2 = this.hic.position2.split(/[:-]/)
			this.hic.state.x = { chr: pos1[0] }
			this.hic.state.y = { chr: pos2[0] }

			if (!Number.isNaN(+pos1[1]) && !Number.isNaN(+pos1[2])) {
				this.hic.state.x.start = +pos1[1]
				this.hic.state.x.stop = +pos1[2]

				this.hic.state.y.start = +pos2[1]
				this.hic.state.y.stop = +pos2[2]

				this.hic.state.currView = 'detail'
			} else {
				this.hic.state.currView = 'chrpair'
			}
		} else {
			if (!this.views.some(v => v === this.hic.state.currView)) this.error(`Unknown view: ${this.hic.state.currView}`)
			else return this.hic.state.currView
		}
	}

	getViewsConfig() {
		/** Generally NONE is not listed in the norm meth array.
		 * Must add before setting the views configs.*/
		let nmeth: string | string[]
		if (this.hic['normalization']?.length > 0) {
			if (!this.hic['normalization'].includes('NONE')) this.hic['normalization'].unshift('NONE')
			nmeth = this.hic['normalization'][0]
		} else {
			nmeth = 'NONE'
		}

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
			await hicParseFile(this.hic, true, this.errList)
			this.getViewsConfig()

			this.store = await hicStoreInit({ app: this.api, state: this.hic.state })
			this.state = await this.store.copyState()

			this.components = {
				loadingOverlay: await loadingInit({
					app: this.api,
					loadingDiv: this.dom.loadingDiv
				}),
				view: await viewCompInit({
					app: this.api,
					state: this.state,
					dom: this.dom,
					hic: this.hic,
					errList: this.errList,
					error: this.error
				})
			}
			await this.api.dispatch()
		} catch (e: any) {
			console.error(e.stack)
		}
	}
}

export const hicInit = getAppInit(HicApp)
