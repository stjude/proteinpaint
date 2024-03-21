import { getCompInit } from '#rx'
import { MainPlotDiv } from '../../../types/hic.ts'
import { ChrPairView } from './chrpair/ChrPairView.ts'
// import { HorizontalView } from './horizontal/HorizontalView.ts'
import { DetailView } from './detail/DetailView.ts'
import { GenomeView } from './genome/GenomeView.ts'
import { controlPanelInit } from '../controls/ControlPanel.ts'
import { InfoBar } from '../dom/InfoBar.ts'
import { DataMapper } from '../data/DataMapper.ts'
import { GenomeDataFetcher } from '../data/GenomeDataFetcher.ts'
import { DataFetcher } from '../data/DataFetcher.ts'
import { Resolution } from './Resolution.ts'

export class HicComponent {
	dom: any
	plotDiv: MainPlotDiv
	type: 'view'
	hic: any
	state: any
	genome: any
	chrpair: any
	detail: any
	app: any
	dataMapper: any
	activeView: string
	errList: string[]
	components = {
		controls: []
	}
	data: any
	infoBar: any
	error: any
	resolution: Resolution
	calResolution: number | null = null
	skipMain = true
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
			plot: tr1.append('td').classed('sjpp-hic-plot', true),
			yAxis: tr1.append('td').classed('sjpp-hic-plot-xaxis', true),
			xAxis: tr2.append('td').classed('sjpp-hic-plot-yaxis', true),
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

	async initView() {
		if (this.state.currView == 'genome') {
			this.genome = new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.data,
				parent: prop => {
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
				parent: prop => {
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
				parent: prop => {
					return this[prop]
				}
			})
		} else if (this.state.currView === 'horizontal') {
			//this.horizonalView = new HorizontalView.main()
		} else {
			throw Error(`Unknown view: ${this.state.currView}`)
		}
	}

	async fetchData(obj) {
		if (this.data?.length) this.data = []
		if (this.state.currView == 'genome') {
			const genomeFetcher = new GenomeDataFetcher(this.hic, true, this.errList)
			this.data = await genomeFetcher.getData(obj)
		} else {
			if (!this.state?.x?.chr || !this.state?.y?.chr) {
				this.errList.push(`No positions provided for ${this.activeView} view.`)
				return
			} else {
				const chrx = this.state.x
				const chry = this.state.y
				obj['lead'] = `${chrx.start && chrx.stop ? `${chrx.chr}:${chrx.start}-${chrx.stop}` : chrx.chr.replace('chr', '') }`
				obj['follow'] = `${chry.start && chry.stop ? `${chry.chr}:${chry.start}-${chry.stop}` : chry.chr.replace('chr', '') }`
			}
			
			const dataFetcher = new DataFetcher(this.hic, true, this.errList)
			this.data = await dataFetcher.getData(obj)
		}
	}

	setResolution(appState) {
		const state = this.app.getState(appState)
		this.calResolution = this.resolution.getResolution(
			this.hic,
			this.state.currView,
			state[state.currView],
			state.x,
			state.y
			// { chr: 'chr1' },
			// { chr: 'chr2' }
		) as number

		return this.calResolution
	}

	async setDataArgs(appState) {
		this.state = await this.app.getState(appState)
		const currView = this.state[this.state.currView]
		const args = {
			nmeth: currView.nmeth,
			resolution: this.setResolution(appState),
			matrixType: currView.matrixType
		}

		if (this.state.currView == 'chrpair') {
			//pos1
			args['lead'] = this.state.x.chr
			//pos2
			args['follow'] = this.state.y.chr
		}
		return args
	}

	async init(appState) {
		try {
			this.activeView = this.state.currView
			const currView = this.state[this.state.currView]
			//TODO: Will need to make it compatible with runpp() inputs
			const obj = {
				matrixType: currView.matrixType,
				nmeth: currView.nmeth,
				resolution: this.activeView == 'genome' ? this.hic['bpresolution'][0] : this.setResolution(appState)
			}
			await this.fetchData(obj)
			const [min, max] = this.dataMapper.sortData(this.data)

			this.min = min
			this.max = max

			await this.initView()

			this.components = {
				controls: await controlPanelInit({
					app: this.app,
					controlsDiv: this.dom.controlsDiv,
					hic: this.hic,
					state: this.state,
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
				resolution: this[this.activeView].resolution
			})
			this.infoBar.render()
		} catch (e: any) {
			this.errList.push(e.message || e)
		}
	}

	async main(appState: any) {
		if (this.skipMain == false) {
			const args = await this.setDataArgs(appState)
			await this.fetchData(args)
			const [min, max] = this.dataMapper.sortData(this.data)
			this.min = min
			this.max = max

			if (this.activeView != this.state.currView) {
				if (this.activeView == 'genome') {
					this.genome.svg.remove()
				} else {
					this.plotDiv.xAxis.selectAll('*').remove()
					this.plotDiv.yAxis.selectAll('*').remove()
					this.plotDiv.plot.selectAll('*').remove()
				}
				this.initView()
				this.activeView == this.state.currView
			} else {
				await this[this.state.currView].update(this.data)
			}
			this.infoBar.update()
		} else {
			//main() skipped on init() to avoid confusing behavior
			this.skipMain = false
		}

		if (this.errList.length) this.error(this.errList)
	}
}

export const viewCompInit = getCompInit(HicComponent)
