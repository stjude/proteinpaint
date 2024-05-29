import { MainPlotDiv, ReturnedItems } from '../../../types/hic.ts'
import { Resolution } from '../data/Resolution.ts'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { DetailBlock } from './DetailBlock.ts'
import { select, Selection } from 'd3-selection'
import { DetailDataMapper } from '../data/DetailDataMapper.ts'
import { DetailCoordinates } from '../data/DetailCoodinates.ts'
import { Elem } from 'types/d3'

export class DetailView {
	app: any
	hic: any
	plotDiv: MainPlotDiv
	sheath: Elem
	rotor: Selection<HTMLDivElement, any, any, any>
	parent: (prop: any) => string | number
	resolution: Resolution
	colorizeElement: ColorizeElement
	viewRangeBpW: number | undefined
	calcResolution: number | null = null
	dataMapper: DetailDataMapper
	data: ReturnedItems
	coordinates: DetailCoordinates
	errList: string[]

	xBlock: any
	yBlock: any
	canvasHolder: any
	canvas: any
	ctx: any
	coords: any

	/** Defaults **/
	binpx = 2
	readonly bbmargin = 1

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
		this.data = opts.data
		this.parent = opts.parent
		this.errList = this.parent('errList') as any
		this.resolution = new Resolution(opts.error)
		this.colorizeElement = new ColorizeElement()
		this.viewRangeBpW = this.resolution.getDefaultViewSpan(
			this.hic,
			(this.parent('state') as any).x,
			(this.parent('state') as any).y,
			(this.parent('state') as any).initialBinNum,
			(this.parent('state') as any).minBinNum_bp
		)
		this.dataMapper = new DetailDataMapper(this.hic, opts.error, opts.parent)
		this.coordinates = new DetailCoordinates(this.hic, this.errList)
	}

	// setDefaultBinPx() {
	// 	if (!this.calcResolution || !this.viewRangeBpW) throw `Missing either the calculated resolution of default view span`

	// 	while ((this.binpx * this.viewRangeBpW) / this.calcResolution < (this.parent('state') as any).settings.width) {
	// 		this.binpx += 2
	// 	}
	// }

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
			// .attr('left', `${this.xBlock.defaultLeft}px`)
			// .attr('top', `${this.yBlock.defaultTop}px`)
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
					console.log(xoff)
					this.xBlock.block.pannedby(xoff)
					this.yBlock.block.pannedby(yoff)
				})
			}) as Selection<HTMLCanvasElement, any, any, any>
	}

	async render() {
		this.calcResolution = this.parent('calcResolution') as number
		// this.setDefaultBinPx()

		const state = this.parent('state') as any

		// const canvasresolution = this.resolution.findResFromArray(
		// 	this.viewRangeBpW!,
		// 	state.minBinNum_bp,
		// 	this.hic.bpresolution,
		// 	true
		// ) as number

		// const blockwidth = Math.ceil((this.binpx * this.viewRangeBpW!) / canvasresolution)

		this.xBlock = new DetailBlock(
			this.app,
			this.hic,
			state.settings.widthHeightPx,
			this.bbmargin,
			this.plotDiv.xAxis,
			false
		)
		this.yBlock = new DetailBlock(this.app, this.hic, state.settings.widthHeightPx, this.bbmargin, this.rotor, true)

		this.renderCanvas(state.settings.widthHeightPx)

		await this.xBlock.loadBlock(state.x, this.canvasHolder, this.canvas)
		await this.yBlock.loadBlock(state.y, this.canvasHolder, this.canvas, this.sheath)

		this.update(this.data)
	}

	async update(data: ReturnedItems) {
		if (data.items.length == 0) {
			this.app.dispatch({ type: 'loading_active', active: false })
			return
		}
		this.data = data
		const state = this.parent('state') as any

		const initialWidth = Number.parseInt(this.canvas.attr('width'))
		const holderChange = Number.parseInt(this.canvasHolder.style('width')) - initialWidth + state.settings.widthHeightPx

		this.canvasHolder.style('width', `${holderChange}px`).style('height', `${holderChange}px`)
		this.canvas.attr('width', `${state.settings.widthHeightPx}px`).attr('height', `${state.settings.widthHeightPx}px`)

		this.xBlock.block.width = state.settings.widthHeightPx
		this.yBlock.block.width = state.settings.widthHeightPx

		//Reloads the block without changing the genomic position
		this.xBlock.block.zoom2px(0, initialWidth)
		this.yBlock.block.zoom2px(0, initialWidth)

		this.ctx = this.canvas.node().getContext('2d') as CanvasRenderingContext2D

		const coords = this.coordinates.getCoordinates(
			state.x,
			state.y,
			this.data,
			this.calcResolution as number,
			this.canvas,
			this.parent('fragData') as any
		)
		this.coords = coords
		this.ctx.clearRect(0, 0, state.settings.widthHeightPx, state.settings.widthHeightPx)

		for (const [xCoord, yCoord, width, height, value] of this.coords as any) {
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

		this.app.dispatch({ type: 'loading_active', active: false })
	}
}
