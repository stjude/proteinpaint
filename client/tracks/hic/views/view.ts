import { getCompInit } from '#rx'
import { MainPlotDiv } from '../../../types/hic.ts'
// import { ChrPairView } from './chrPairView'
// import { HorizontalView } from './horizontalView'
// import { DetailView } from './detailView'
import { GenomeView } from './genomeView.ts'
import { HicDataMapper } from '../data/dataMapper'
import { controlPanelInit } from '../controls/controlPanel'
import { infoBarInit } from '../dom/infoBar'

export class HicView {
	dom: any
	plotDiv: MainPlotDiv
	type: 'view'
	hic: any
	state: any
	genome: any
	//hasStatePreMain: boolean
	app: any
	dataMapper: any
	activeView: string
	errList: string[]
	components = {
		controls: [],
		infoBar: []
	}
	error: any
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
		this.dataMapper = opts.dataMapper
		this.activeView = this.state.currView
		this.error = opts.error
	}

	getState(appState: any) {
		return appState
	}

	async colorizeElement(lead: number, follow: number, v: number, obj: any, width?: number, height?: number) {
		const bpMinV = this.min
		const bpMaxV = this.max
		const currView = this.activeView

		if (v >= 0) {
			// positive or zero, use red
			const p = v >= bpMaxV || v <= bpMinV ? 0 : Math.floor((255 * (bpMaxV - v)) / bpMaxV)
			const positiveFill = `rgb(255, ${p}, ${p})`
			if (currView === 'genome') {
				obj.ctx.fillStyle = positiveFill
				obj.ctx2.fillStyle = positiveFill
			} else {
				/** ctx for the chrpair and detail view */
				obj.fillStyle = positiveFill
			}
		} else {
			// negative, use blue
			const p = Math.floor((255 * (bpMaxV + v)) / bpMaxV)
			const negativeFill = `rgb(${p}, ${p}, 255)`
			if (currView === 'genome') {
				obj.ctx.fillStyle = negativeFill
				obj.ctx2.fillStyle = negativeFill
			} else {
				obj.fillStyle = negativeFill
			}
		}
		const w = width
		const h = height

		if (currView === 'genome') {
			obj.ctx.fillRect(follow, lead, w, h)
			obj.ctx2.fillRect(lead, follow, w, h)
		} else {
			obj.fillRect(lead, follow, w, h)
		}
	}

	async initView() {
		if (this.state.currView == 'genome') {
			this.genome = await new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				state: this.state,
				app: this.app,
				data: this.dataMapper.data,
				parent: this
			})
			this.genome.render()
		} else if (this.state.currView === 'chrpair') {
			//this.chrPairView = new ChrPairView
			//this.chrPairView.main()
		} else if (this.state.currView === 'horizontal') {
			//this.horizonalView = new HorizontalView.main()
		} else if (this.state.currView === 'detail') {
			//this.detailView = new DetailView.main()
		} else {
			throw Error(`Unknown view: ${this.state.currView}`)
		}
	}
	async init() {
		try {
			const currView = this.state[this.state.currView]
			const [min, max] = await this.dataMapper.getData(currView.nmeth, this.hic['bpresolution'][0])

			this.min = min
			this.max = max

			await this.initView()

			this.components = {
				controls: await controlPanelInit({
					app: this.app,
					controlsDiv: this.dom.controlsDiv,
					hic: this.hic,
					state: this.state,
					parent: this
				}),
				infoBar: await infoBarInit({
					app: this.app,
					state: this.state,
					infoBarDiv: this.dom.infoBarDiv.append('table').style('border-spacing', '3px'),
					hic: this.hic,
					parent: this,
					resolution: this[this.activeView].resolution
				})
			}
		} catch (e: any) {
			this.errList.push(e.message || e)
		}
	}

	async main(appState: any) {
		if (this.skipMain == false) {
			this.state = this.app.getState(appState)
			const currView = this.state[this.state.currView]
			const [min, max] = await this.dataMapper.getData(
				currView.nmeth,
				this[this.state.currView].resolution,
				currView.matrixType
			)
			this.min = min
			this.max = max

			if (this.activeView != this.state.currView) {
				this.plotDiv.xAxis.selectAll('*').remove()
				this.plotDiv.yAxis.selectAll('*').remove()
				this.plotDiv.plot.selectAll('*').remove()
				this.initView()
				this.activeView == this.state.currView
			} else {
				await this[this.state.currView].update(this.dataMapper.data)
			}
		} else {
			//main() skipped on init() to avoid confusing behavior
			this.skipMain = false
		}

		if (this.errList.length) this.error(this.errList)
	}
}

export const hicViewInit = getCompInit(HicView)

/**
 * Fills the canvas with color based on the value from the straw response
 * Default color is red for positive values and blue for negative values.
 * When no negative values are present, no color is displayed (i.e. appears white)
 * Note the genome view renders two ctx objs, otherwise only one ctx obj is filled in.
 * @param lead lead chr
 * @param follow following chr
 * @param v returned value from straw
 * @param bpMaxV
 * @param state
 * @param obj obj to color
 * @param width if no .binpx for the view, must provied width
 * @param height if no .binpx for the view, must provied width
 */
