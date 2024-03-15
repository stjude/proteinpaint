import { getCompInit } from '#rx'
import { MainPlotDiv } from '../../../types/hic.ts'
import { ChrPairView } from './chrPairView'
// import { HorizontalView } from './horizontalView'
// import { DetailView } from './detailView'
import { GenomeView } from './genomeView.ts'
import { controlPanelInit } from '../controls/controlPanel'
import { InfoBar } from '../dom/infoBar'
import { HicDataMapper } from '../data/dataMapper'
import { GenomeDataFetcher } from '../data/genomeDataFetcher.ts'
import { DataFetcher } from '../data/dataFetcher.ts'
import { Resolution } from './resolution.ts'

export class HicView {
	dom: any
	plotDiv: MainPlotDiv
	type: 'view'
	hic: any
	state: any
	genome: any
	chrpair: any
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
		this.dataMapper = new HicDataMapper(this.hic)
		this.activeView = this.state.currView
		this.error = opts.error
		this.resolution = new Resolution(this.error)
	}

	getState(appState: any) {
		return appState
	}

	async initView() {
		if (this.state.currView == 'genome') {
			this.genome = await new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.data,
				parent: prop => {
					return this[prop]
				}
				//colorizeElement: this.colorizeElement
			})
			this.genome.render()
		} else if (this.state.currView === 'chrpair') {
			this.chrpair = new ChrPairView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.data,
				parent: prop => {
					return this[prop]
				}
				//colorizeElement: this.colorizeElement
			})
			this.chrpair.render()
		} else if (this.state.currView === 'horizontal') {
			//this.horizonalView = new HorizontalView.main()
		} else if (this.state.currView === 'detail') {
			//this.detailView = new DetailView.main()
		} else {
			throw Error(`Unknown view: ${this.state.currView}`)
		}
	}

	async fetchData(obj) {
		if (this.activeView == 'genome') {
			const genomeFetcher = new GenomeDataFetcher(this.hic, true, this.errList)
			this.data = await genomeFetcher.getData(obj)
		} else {
			// if (!this.state?.x?.chr || !this.state?.y?.chr) {
			// 	this.errList.push(`No positions provided for ${this.activeView} view.`)
			// 	return
			// } else {
			// 	obj.lead == this.state.x.chr
			// 	obj.follow == this.state.y.chr
			// }
			//***FOR TESTING, RM LATER */
			// obj.lead = 'chr1'
			// obj.follow = 'chr2'
			const dataFetcher = new DataFetcher(this.hic, true, this.errList)
			this.data = await dataFetcher.getData(obj)
		}
	}

	async setDataArgs(appState) {
		this.state = await this.app.getState(appState)
		const currView = this.state[this.state.currView]
		this.calResolution = this.resolution.getResolution(
			this.hic,
			this.state.currView,
			currView,
			this.state.x,
			this.state.y
		) as number
		const args = {
			nmeth: currView.nmeth,
			resolution: this.calResolution,
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

	async init() {
		try {
			this.activeView = this.state.currView
			const currView = this.state[this.state.currView]
			//This only works for genome view.
			//Will need to make it compatible with other views
			const obj = {
				matrixType: currView.matrixType,
				nmeth: currView.nmeth,
				resolution: this.hic['bpresolution'][0]
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
					//colorizeElement: this.colorizeElement,
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

export const hicViewInit = getCompInit(HicView)
