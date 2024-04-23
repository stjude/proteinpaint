import { MainPlotDiv } from '../../../types/hic.ts'
import { Resolution } from '../data/Resolution.ts'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { DetailBlock } from './DetailBlock.ts'
import { select, Selection } from 'd3-selection'
import { DetailViewDataMapper } from '../data/DetailViewDataMapper.ts'
import { DetailCoordinates } from '../data/DetailCoodinates.ts'
import { Elem } from 'types/d3'

export class DetailView {
	app: any
	hic: any
	plotDiv: MainPlotDiv
	sheath: Elem
	rotor: Selection<HTMLDivElement, any, any, any>
	data: any
	parent: (prop: string) => string | number
	resolution: Resolution
	colorizeElement: ColorizeElement
	viewRangeBpw: number | undefined
	calResolution: number | null = null
	dataMapper: DetailViewDataMapper
	items: { items: number[][] }
	coordinates: DetailCoordinates
	errList: string[]

	xBlock: any
	yBlock: any
	canvasHolder: any
	canvas: any
	ctx: any

	/** Defaults **/
	binpx = 2
	initialBinNum = 20
	minCanvasSize = 500
	bbmargin = 1

	constructor(opts: any) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.sheath = opts.plotDiv.yAxis
			.append('div')
			.style('position', 'relative')
			.style('width', '200px')
			.style('height', '800px')
		this.rotor = this.sheath
			.append('div')
			.style('position', 'absolute')
			.style('bottom', '0px')
			.style('transform', 'rotate(-90deg)')
			.style('transform-origin', 'left bottom')
		this.items = opts.items
		this.parent = opts.parent
		this.errList = this.parent('errList') as any
		this.resolution = new Resolution(opts.error)
		this.colorizeElement = new ColorizeElement()
		this.viewRangeBpw = this.resolution.getDefaultViewSpan(
			this.hic,
			(this.parent('state') as any).x,
			(this.parent('state') as any).y
		)
		this.dataMapper = new DetailViewDataMapper(this.hic, opts.error, opts.parent)
		this.coordinates = new DetailCoordinates(this.hic, this.errList)
	}

	setDefaultBinPx() {
		if (!this.calResolution || !this.viewRangeBpw) throw `Missing either the calculated resolution of default view span`

		while ((this.binpx * this.viewRangeBpw) / this.calResolution < this.minCanvasSize) {
			this.binpx += 2
		}
	}

	renderCanvas(blockwidth: number) {
		this.canvasHolder = this.plotDiv.plot
			.append('div')
			.style('position', 'relative')
			.style('width', `${this.xBlock.bbw}px`)
			.style('height', `${this.yBlock.bbw}px`)
			.style('overflow', 'hidden')

		//main canvas
		this.canvas = this.canvasHolder
			.append('canvas')
			.style('display', 'block')
			.style('position', 'absolute')
			.attr('data-testid', 'sjpp-hic-detail-canvas')
			//Starting width and height to render the canvas
			.attr('width', blockwidth)
			.attr('height', blockwidth)
			.attr('left', `${this.xBlock.defaultLeft}px`)
			.attr('top', `${this.yBlock.defaultTop}px`)
			.on('mousedown', (event: MouseEvent) => {
				const body = select(document.body)
				const x = event.clientX
				const y = event.clientY
				const oldx = Number.parseInt(this.canvas.style('left'))
				const oldy = Number.parseInt(this.canvas.style('top'))
				body.on('mousemove', event => {
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.xBlock.block.panning(xoff)
					this.yBlock.block.panning(yoff)
					this.canvas.style('left', `${oldx + xoff}px`).style('top', `${oldy + yoff}px`)
				})
				body.on('mouseup', (event: MouseEvent) => {
					body.on('mousemove', null).on('mouseup', null)
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.xBlock.block.pannedby(xoff)
					this.yBlock.block.pannedby(yoff)
				})
			}) as Selection<HTMLCanvasElement, any, any, any>
	}

	async render() {
		this.calResolution = this.parent('calResolution') as number
		this.setDefaultBinPx()

		const blockwidth = Math.ceil((this.binpx * this.viewRangeBpw!) / this.calResolution)

		this.xBlock = new DetailBlock(this.hic, blockwidth, this.bbmargin, this.plotDiv.xAxis, false)
		this.yBlock = new DetailBlock(this.hic, blockwidth, this.bbmargin, this.rotor, true)

		this.renderCanvas(blockwidth)

		const state = this.parent('state') as any

		await this.xBlock.loadBlock(state.x, this.canvasHolder, this.canvas)
		await this.yBlock.loadBlock(state.y, this.canvasHolder, this.canvas, this.sheath)

		//Unnecessary
		// this.app.dispatch({
		// 	type: 'view_update',
		// 	config: {
		// 		x: {
		// 			chr: this.xBlock.block.rglst[0].chr,
		// 			start: this.xBlock.block.rglst[0].start,
		// 			stop: this.xBlock.block.rglst[0].stop
		// 		},
		// 		y: {
		// 			chr: this.yBlock.block.rglst[0].chr,
		// 			start: this.yBlock.block.rglst[0].start,
		// 			stop: this.yBlock.block.rglst[0].stop
		// 		}
		// 	}
		// })

		await this.update(this.items)
	}

	async update(items: { items: number[][] }) {
		this.items = items
		const state = this.parent('state') as any

		this.ctx = this.canvas.node().getContext('2d') as CanvasRenderingContext2D

		const [coords, canvaswidth, canvasheight] = this.coordinates.getCoordinates(
			state.x,
			state.y,
			this.items,
			this.calResolution,
			this.canvas,
			this.dataMapper['fragData']
		)

		this.ctx.clearRect(0, 0, canvaswidth, canvasheight)

		for (const [xCoord, yCoord, width, height, value] of coords as any) {
			this.colorizeElement.colorizeElement(
				xCoord,
				yCoord,
				value,
				this.ctx,
				width,
				height,
				this.parent('min') as number,
				this.parent('max') as number,
				'detail'
			)
		}
		this.canvas.style('left', `${this.xBlock.defaultLeft}px`).style('top', `${this.yBlock.defaultTop}px`)
		// This does not work. Do not do this
		// this.canvas.attr('width', canvaswidth).attr('height', canvasheight)
	}
}
