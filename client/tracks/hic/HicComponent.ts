import { getCompInit } from '#rx'
import { HicstrawDom, MainPlotDiv } from '../../types/hic.ts'
import { ChrPairView } from './chrpair/ChrPairView.ts'
import { HorizontalView } from './horizontal/HorizontalView.ts'
import { DetailView } from './detail/DetailView.ts'
import { GenomeView } from './genome/GenomeView.ts'
import { controlPanelInit } from './controls/ControlPanel.ts'
import { InfoBar } from './dom/InfoBar.ts'
import { DataMapper } from './data/DataMapper.ts'
import { GenomeDataFetcher } from './data/GenomeDataFetcher.ts'
import { DetailDataMapper } from './data/DetailDataMapper.ts'
import { DataFetcher } from './data/DataFetcher.ts'
import { Resolution } from './data/Resolution.ts'

export class HicComponent {
	dom: HicstrawDom
	plotDiv: MainPlotDiv
	type: 'view'
	hic: any
	state: any
	genome: any
	chrpair: any
	detail: any
	horizontal: any
	app: any
	dataMapper: DataMapper
	activeView: string
	errList: string[]
	components = {
		controls: []
	}
	data: any
	genomedata: any
	infoBar: any
	error: any
	resolution: Resolution
	calResolution: number | null = null
	firstRender = true
	min = 0
	max = 0
	hasStatePreMain = true

	constructor(opts) {
		this.type = 'view'
		this.hic = opts.hic
		this.state = opts.state
		this.dom = opts.dom
		this.errList = opts.errList
		this.plotDiv = this.dom.plotDiv.append('table').classed('sjpp-hic-plot-main', true)
		const tr1 = this.plotDiv.append('tr')
		const tr2 = this.plotDiv.append('tr')
		this.plotDiv = {
			plot: tr1.append('td').classed('sjpp-hic-plot', true).attr('data-testid', 'sjpp-hic-plot'),
			yAxis: tr1.append('td').classed('sjpp-hic-plot-yaxis', true).attr('data-testid', 'sjpp-hic-yaxis'),
			xAxis: tr2.append('td').classed('sjpp-hic-plot-xaxis', true).attr('data-testid', 'sjpp-hic-xaxis'),
			blank: tr2.append('td')
		} as MainPlotDiv
		this.app = opts.app
		this.dataMapper = new DataMapper(this.hic)
		this.activeView = this.state.currView
		this.error = opts.error
		this.resolution = new Resolution(this.error)
	}

	getState(appState: any) {
		return appState
	}

	reactsTo(action: any) {
		if (action.type.startsWith('view')) return true
		else return false
	}

	initView() {
		if (this.state.currView == 'genome') {
			this.genome = new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.data,
				parent: (prop: any) => {
					return this[prop]
				}
			})
			this.genome.render()
		} else if (this.state.currView === 'chrpair') {
			this.chrpair = new ChrPairView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				items: this.data,
				parent: (prop: any) => {
					return this[prop]
				}
			})
			this.chrpair.render()
		} else if (this.state.currView === 'detail') {
			this.detail = new DetailView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				items: this.data,
				parent: (prop: any) => {
					return this[prop]
				}
			})
			this.detail.render()
		} else if (this.state.currView === 'horizontal') {
			this.horizontal = new HorizontalView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				parent: (prop: any) => {
					return this[prop]
				}
			})
			this.horizontal.render()
		} else {
			throw Error(`Unknown view: ${this.state.currView}`)
		}
	}

	async fetchData(obj: any) {
		if (this.data?.length) this.data = []
		if (this.state.currView == 'genome') {
			/** When returning to the genome view, use cached data */
			if (this.activeView != 'genome') this.data = this.genomedata
			else {
				const genomeFetcher = new GenomeDataFetcher(this.hic, true, this.errList)
				this.genomedata = await genomeFetcher.getData(obj)
				this.data = this.genomedata
			}
		} else if (this.state.currView == 'detail') {
			const parent = (prop: string, value?: string | number) => {
				if (value) this[prop] = value
				return this[prop]
			}
			const detailMapper = new DetailDataMapper(this.hic, this.errList, parent)
			this.data = await detailMapper.getData(this.state.x, this.state.y)
			if (this.data.items.length == 0) {
				this.calResolution = this.resolution.updateDetailResolution(this.hic.bpresolution, this.state.x, this.state.y)
				this.data = await detailMapper.getData(this.state.x, this.state.y)
			}
		} else {
			if (!this.state?.x?.chr || !this.state?.y?.chr) {
				this.errList.push(`No positions provided for ${this.activeView} view.`)
				return
			} else {
				const chrx = this.state.x
				const chry = this.state.y
				obj['lead'] = `${chrx.start && chrx.stop ? `${chrx.chr}:${chrx.start}-${chrx.stop}` : chrx.chr}`
				obj['follow'] = `${chry.start && chry.stop ? `${chry.chr}:${chry.start}-${chry.stop}` : chry.chr}`
			}
			const dataFetcher = new DataFetcher(this.hic, true, this.errList)
			this.data = await dataFetcher.getData(obj)
		}
	}

	setResolution(appState: any) {
		const state = this.app.getState(appState)
		this.calResolution = this.resolution.getResolution(state, this.hic) as number
		return this.calResolution
	}

	setDataArgs(appState: any) {
		const state = this.app.getState(appState)
		const currView = state[state.currView]
		const args = {
			nmeth: currView.nmeth,
			resolution: this.setResolution(appState),
			matrixType: currView.matrixType
		}

		if (state.currView == 'chrpair') {
			//pos1
			args['lead'] = state.x.chr
			//pos2
			args['follow'] = state.y.chr
		}
		return args
	}

	async getViewData(appState: any) {
		const args = this.setDataArgs(appState)
		await this.fetchData(args)
		if (this.data?.length > 0 || this.data?.items?.length > 0) {
			const [min, max] = this.dataMapper.sortData(this.data)
			this.min = min
			this.max = max
		} else {
			if (this.state.currView != 'genome') {
				/** Show error message when no data returned. */
				const state = this.app.getState(appState)
				const xPosMessage = state.x?.start ? `${state.x.chr}:${state.x.start}-${state.x.stop}` : state.x.chr
				const yPosMessage = state.y?.start ? `${state.y.chr}:${state.y.start}-${state.y.stop}` : state.y.chr
				this.errList.push(`No data returned for ${xPosMessage} and ${yPosMessage}`)
			}
		}
	}

	async init() {
		this.components = {
			controls: await controlPanelInit({
				app: this.app,
				controlsDiv: this.dom.controlsDiv,
				hic: this.hic,
				parent: (prop: string, value?: string | number) => {
					if (value) this[prop] = value
					return this[prop]
				},
				error: this.error
			})
		}
		this.infoBar = new InfoBar({
			app: this.app,
			infoBarDiv: this.dom.infoBarDiv.append('table').style('border-spacing', '3px'),
			hic: this.hic,
			parent: (prop: string) => {
				return this[prop]
			},
			resolution: this.calResolution
		})
		this.infoBar.render()
	}

	async main(appState: any) {
		const state = this.app.getState(appState)
		if (this.firstRender == true) {
			this.firstRender = false
			await this.getViewData(appState)
			this.initView()
		} else {
			if (state.currView != 'horizontal') {
				this.app.dispatch({ type: 'loading_active', active: true })
				await this.getViewData(appState)
			}
			if (this.activeView != state.currView) {
				if (this.activeView == 'genome') {
					this.genome.svg.remove()
				} else {
					this.plotDiv.xAxis.selectAll('*').remove()
					this.plotDiv.yAxis.selectAll('*').remove()
					this.plotDiv.plot.selectAll('*').remove()
				}
				this.activeView = state.currView
				this.initView()
			} else {
				this[state.currView].update(this.data)
			}
		}
		this.infoBar.update()

		if (this.errList.length) {
			this.error(this.errList)
			//Turn off loading overlay when data fetch requests persist, etc.
			this.app.dispatch({ type: 'loading_active', active: false })
		}
	}
}

export const viewCompInit = getCompInit(HicComponent)
