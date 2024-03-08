import { getCompInit } from '#rx'
import { MainPlotDiv } from '../../../types/hic.ts'
import { ChrPairView } from './chrPairView'
// import { HorizontalView } from './horizontalView'
// import { DetailView } from './detailView'
import { GenomeView } from './genomeView.ts'
import { controlPanelInit } from '../controls/controlPanel'
import { InfoBar } from '../dom/infoBar'

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
	infoBar: any
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

	async colorizeElement(lead: number, follow: number, v: number, obj: any, width: number, height: number) {
		const bpMinV = this.min
		const bpMaxV = this.max
		const currView = this.activeView

		if (v >= 0) {
			// positive or zero, use red
			const p = v >= bpMaxV ? 0 : v <= bpMinV ? 255 : Math.floor((255 * (bpMaxV - v)) / bpMaxV)
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
			const p = v <= bpMinV ? 255 : Math.floor((255 * (bpMaxV + v)) / bpMaxV)
			const negativeFill = `rgb(${p}, ${p}, 255)`
			if (currView === 'genome') {
				obj.ctx.fillStyle = negativeFill
				obj.ctx2.fillStyle = negativeFill
			} else {
				obj.fillStyle = negativeFill
			}
		}

		if (currView === 'genome') {
			obj.ctx.fillRect(follow, lead, width, height)
			obj.ctx2.fillRect(lead, follow, width, height)
		} else {
			obj.fillRect(lead, follow, width, height)
		}
	}

	async initView() {
		if (this.state.currView == 'genome') {
			this.genome = await new GenomeView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.dataMapper.data,
				parent: this
			})
			this.genome.render()
		} else if (this.state.currView === 'chrpair') {
			this.chrpair = new ChrPairView({
				plotDiv: this.plotDiv,
				hic: this.hic,
				app: this.app,
				data: this.dataMapper.data,
				parent: this
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

	getResolution() {
		//Move to data mapper?
		//TODO: resolution for detail and horizontal view
		if (this[this.state.currView]?.resolution) return this[this.state.currView].resolution
		if (this.state.currView == 'chrpair') {
			const chrxlen = this.hic.genome.chrlookup[this.state.x.chr.toUpperCase()].len
			const chrylen = this.hic.genome.chrlookup[this.state.y.chr.toUpperCase()].len
			const maxchrlen = Math.max(chrxlen, chrylen)

			let resolution = null
			for (let i = 0; i < this.hic.bpresolution.length; i++) {
				const res = this.hic.bpresolution[i]
				if (maxchrlen / res > 200) {
					resolution = res
					break
				}
			}
			if (resolution == null) {
				this.error('no suitable resolution')
				return
			}
			return resolution
		}
	}

	setPositions(x: number, y: number, binpx: number) {
		const initialbinnum_detail = 20

		const state = this.app.getState()
		const chrx = state.x.chr
		const chry = state.y.chr

		const resolution = this.getResolution()

		const viewrangebpw = resolution! * initialbinnum_detail

		let coordx = Math.max(1, Math.floor((x * resolution!) / binpx) - viewrangebpw / 2)
		let coordy = Math.max(1, Math.floor((y * resolution!) / binpx) - viewrangebpw / 2)

		// make sure positions are not out of bounds
		{
			const lenx = this.hic.genome.chrlookup[chrx.toUpperCase()].len
			if (coordx + viewrangebpw >= lenx) {
				coordx = lenx - viewrangebpw
			}
			const leny = this.hic.genome.chrlookup[chry.toUpperCase()].len
			if (coordy + viewrangebpw > leny) {
				coordy = leny - viewrangebpw
			}
		}

		const xObj = {
			chr: chrx,
			start: coordx,
			stop: coordx + viewrangebpw
		}

		const yObj = {
			chr: chry,
			start: coordx,
			stop: coordx + viewrangebpw
		}

		return [xObj, yObj]
	}

	setDataArgs(appState) {
		this.state = this.app.getState(appState)
		const currView = this.state[this.state.currView]
		const args = {
			nmeth: currView.nmeth,
			resolution: this.getResolution(),
			matrixType: currView.matrixType
		}

		if (currView == 'chrpair') {
			//pos1
			args['lead'] = this.state.x.chr
			//pos2
			args['follow'] = this.state.y.chr
		}
		return args
	}

	async init() {
		try {
			const currView = this.state[this.state.currView]
			//This only works for genome view.
			//Will need to make it compatible with other views
			const obj = {
				nmeth: currView.nmeth,
				resolution: this.hic['bpresolution'][0]
			}

			const [min, max] = await this.dataMapper.getData(obj)

			this.min = min
			this.max = max

			await this.initView()

			this.components = {
				controls: await controlPanelInit({
					app: this.app,
					controlsDiv: this.dom.controlsDiv,
					hic: this.hic,
					state: this.state,
					parent: () => {
						return this.min, this.max
					}
				})
			}
			// this.infoBar = new InfoBar({
			// 	app: this.app,
			// 	infoBarDiv: this.dom.infoBarDiv.append('table').style('border-spacing', '3px'),
			// 	hic: this.hic,
			// 	parent: (prop: string) => {
			// 		return this[prop]
			// 	},
			// 	resolution: this[this.activeView].resolution
			// })
			// this.infoBar.render()
		} catch (e: any) {
			this.errList.push(e.message || e)
		}
	}

	async main(appState: any) {
		if (this.skipMain == false) {
			const args = this.setDataArgs(appState)
			const [min, max] = await this.dataMapper.getData(args)
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
				await this[this.state.currView].update(this.dataMapper.data)
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
