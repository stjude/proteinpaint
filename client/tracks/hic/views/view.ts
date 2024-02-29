import { getCompInit } from '#rx'
import { MainPlotDiv } from '../../../types/hic.ts'
// import { ChrPairView } from './chrPairView'
// import { HorizontalView } from './horizontalView'
// import { DetailView } from './detailView'
import { GenomeView } from './genomeView.ts'

export class HicView {
	plotDiv: MainPlotDiv
	type: 'view'
	hic: any
	state: any
	genomeView: any
	//hasStatePreMain: boolean
	app: any
	dataMapper: any
	activeView: string
	rendered = false

	constructor(opts) {
		this.type = 'view'
		this.hic = opts.hic
		this.state = opts.state
		this.plotDiv = opts.plotDiv
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
	}

	getState(appState: any) {
		return {
			currView: appState.currView
		}
	}

	async initView() {
		if (this.state.currView == 'genome') {
			this.genomeView = await new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				state: this.state,
				app: this.app,
				data: this.dataMapper.data
			})
			this.genomeView.render()
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
		await this.initView()
	}

	async main(appState: any) {
		this.state = this.app.getState(appState)
		const currView = this.state[this.activeView]
		if (this.activeView != this.state.currView) {
			this.plotDiv.xAxis.selectAll('*').remove()
			this.plotDiv.yAxis.selectAll('*').remove()
			this.plotDiv.plot.selectAll('*').remove()
			this.initView()
			this.activeView == this.state.currView
		} else {
			await this.dataMapper.getData(currView.nmeth, currView.resolution, currView.matrixType)
			const viewText = `${this.activeView}View`
			//console.log(this[viewText].update)
			await this[viewText].update(this.dataMapper.data)
		}
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
 * @param bpmaxv
 * @param state
 * @param obj obj to color
 * @param width if no .binpx for the view, must provied width
 * @param height if no .binpx for the view, must provied width
 */
export async function colorizeElement(
	lead: number,
	follow: number,
	v: number,
	bpmaxv: number,
	state: any,
	obj: any,
	width?: number,
	height?: number
) {
	if (v >= 0) {
		// positive or zero, use red
		const p = v >= bpmaxv ? 0 : Math.floor((255 * (bpmaxv - v)) / bpmaxv)
		const positiveFill = `rgb(255, ${p}, ${p})`
		if (state.currView === 'genome') {
			obj.ctx.fillStyle = positiveFill
			obj.ctx2.fillStyle = positiveFill
		} else {
			/** ctx for the chrpair and detail view */
			obj.fillStyle = positiveFill
		}
	} else {
		// negative, use blue
		const p = Math.floor((255 * (bpmaxv + v)) / bpmaxv)
		const negativeFill = `rgb(${p}, ${p}, 255)`
		if (state.currView === 'genome') {
			obj.ctx.fillStyle = negativeFill
			obj.ctx2.fillStyle = negativeFill
		} else {
			obj.fillStyle = negativeFill
		}
	}
	const w = width
	const h = height

	if (state.currView === 'genome') {
		obj.ctx.fillRect(follow, lead, w, h)
		obj.ctx2.fillRect(lead, follow, w, h)
	} else {
		obj.fillRect(lead, follow, w, h)
	}
}
