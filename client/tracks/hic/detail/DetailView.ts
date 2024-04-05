import { MainPlotDiv } from '../../../types/hic.ts'
import { Resolution } from '../data/Resolution.ts'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { DetailBlock } from './DetailBlock.ts'
import { select, Selection } from 'd3-selection'
import { DetailViewDataMapper } from '../data/DetailViewDataMapper.ts'
import { DetailCoordinates } from '../data/DetailCoodinates.ts'

export class DetailView {
	app: any
	hic: any
	plotDiv: MainPlotDiv
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
	canvas: any
	ctx: any

	/** Defaults **/
	binpx = 2
	initialBinNum = 20
	minCanvasSize = 500

	constructor(opts: any) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
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
		const canvasHolder = this.plotDiv.plot
			.append('div')
			.style('position', 'relative')
			.style('width', `${blockwidth} px`)
			.style('height', `${blockwidth} px`)
			.style('overflow', 'hidden')

		this.canvas = canvasHolder
			.append('canvas')
			.style('display', 'block')
			.style('position', 'absolute')
			.attr('width', blockwidth)
			.attr('height', blockwidth)
			.attr('left', '10px')
			.attr('top', '10px')
			.on('mousedown', (event: MouseEvent) => {
				const body = select(document.body)
				const x = event.clientX
				const y = event.clientY
				const oldx = Number.parseInt(this.canvas.style('left'))
				const oldy = Number.parseInt(this.canvas.style('top'))
				body.on('mousemove', event => {
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.xBlock.panning(xoff)
					this.yBlock.panning(yoff)
					this.canvas.style('left', `${oldx + xoff}px`).style('top', `${oldy + yoff}px`)
				})
				body.on('mouseup', (event: MouseEvent) => {
					body.on('mousemove', null).on('mouseup', null)
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.xBlock.pannedby(xoff)
					this.yBlock.pannedby(yoff)
				})
			}) as Selection<HTMLCanvasElement, any, any, any>
	}

	async render() {
		this.calResolution = this.parent('calResolution') as number
		this.setDefaultBinPx()

		const blockwidth = Math.ceil((this.binpx * this.viewRangeBpw!) / this.calResolution)
		this.xBlock = new DetailBlock(blockwidth)
		this.yBlock = new DetailBlock(blockwidth)
		this.renderCanvas(blockwidth)

		this.ctx = this.canvas.node().getContext('2d') as CanvasRenderingContext2D

		await this.update(this.items, blockwidth)
	}

	async update(items: { items: number[][] }, blockwidth) {
		this.items = items
		const state = this.parent('state') as any
		console.log(this.dataMapper)
		// const coords = this.coordinates.getCoordinates(state.x, state.y, this.items, this.dataMapper.fragData, this.dataMapper.resolution, this.canvas, this.ctx)
		// console.log(coords)

		//const x = this.dataMapper.parent('state').x
	}
}
