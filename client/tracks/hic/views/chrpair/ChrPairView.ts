import { MainPlotDiv } from '../../../../types/hic.ts'
import { axisstyle, font } from '#src/client'
import { axisRight, axisBottom } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { format as d3format } from 'd3-format'
import { pointer } from 'd3-selection'
import { ColorizeElement } from '../../dom/colorizeElement.ts'
import { Positions } from '../Positions.ts'

export class ChrPairView {
	/** opts */
	app: any
	hic: any
	plotDiv: MainPlotDiv
	parent: (prop: string) => any
	items: { items: number[][] }
	colorizeElement: ColorizeElement
	positions: Positions

	chrxlen: number
	chrylen: number
	maxchrlen: number
	// canvas: Selection<HTMLCanvasElement, any, any, any>
	canvas: any
	ctx: any

	binpx = 1
	/** padding on the ends of x/y chr coordinate axes */
	axispad = 10
	calResolution: number | null = null
	data: number[][] = []

	constructor(opts) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.items = opts.items
		this.parent = opts.parent
		this.chrxlen = this.hic.genome.chrlookup[this.parent('state').x.chr.toUpperCase()].len
		this.chrylen = this.hic.genome.chrlookup[this.parent('state').x.chr.toUpperCase()].len
		this.maxchrlen = Math.max(this.chrxlen, this.chrylen)
		this.colorizeElement = new ColorizeElement()
		this.positions = new Positions(opts.error, opts.activeView, opts.currView)
	}

	setDefaultBinpx() {
		if (this.calResolution == null) return
		//this.binpx default is 1
		while ((this.binpx * this.maxchrlen) / this.calResolution < 600) {
			this.binpx++
		}
	}

	renderAxes() {
		if (this.calResolution == null) return

		//y axis
		const svgY = this.plotDiv.yAxis.append('svg')
		const h = Math.ceil(this.chrylen / this.calResolution) * this.binpx
		svgY.attr('width', 100).attr('height', this.axispad * 2 + h)

		svgY
			.append('g')
			.attr('transform', 'translate(80,' + (this.axispad + h / 2) + ')')
			.append('text')
			.text(this.parent('state').y.chr)
			.attr('text-anchor', 'middle')
			.attr('font-size', 15)
			.attr('font-family', font)
			.attr('dominant-baseline', 'central')
			.attr('transform', 'rotate(90)')
		axisstyle({
			axis: svgY
				.append('g')
				.attr('transform', `translate(1, ${this.axispad})`)
				.call(axisRight(scaleLinear().domain([0, this.chrylen]).range([0, h])).tickFormat(d3format('.2s'))),
			showline: true
		})

		// x axis
		const svgX = this.plotDiv.xAxis.append('svg')
		const w = Math.ceil(this.chrxlen / this.calResolution) * this.binpx
		svgX.attr('height', 100).attr('width', this.axispad * 2 + w)
		svgX
			.append('text')
			.text(this.parent('state').x.chr)
			.attr('font-size', 15)
			.attr('font-family', font)
			.attr('x', this.axispad + w / 2)
			.attr('text-anchor', 'middle')
			.attr('y', 60)
		axisstyle({
			axis: svgX
				.append('g')
				.attr('transform', 'translate(' + this.axispad + ',1)')
				.call(axisBottom(scaleLinear().domain([0, this.chrxlen]).range([0, w])).tickFormat(d3format('.2s'))),
			showline: true
		})
	}

	renderCanvas() {
		const initDetailView = this.initDetailView.bind(this)
		this.canvas = this.plotDiv.plot
			.append('canvas')
			.style('margin', this.axispad + 'px')
			.on('click', async function (this: any, event: MouseEvent) {
				const [x, y] = pointer(event, this)
				initDetailView(x, y)
			})
			.node()

		this.canvas.width = Math.ceil(this.chrxlen / this.calResolution!) * this.binpx
		this.canvas.height = Math.ceil(this.chrylen / this.calResolution!) * this.binpx
		this.ctx = this.canvas.getContext('2d')
	}

	initDetailView(x, y) {
		const [xObj, yObj] = this.positions.setPosition(
			x,
			y,
			this.binpx,
			this.parent('state').x,
			this.parent('state').y,
			this.hic
		)
		this.app.dispatch({
			type: 'view_change',
			view: 'detail',
			config: {
				x: xObj,
				y: yObj
			}
		})
	}

	getData(firstisx) {
		const isintrachr = this.parent('state').x.chr === this.parent('state').y.chr

		for (const [coord1, coord2, v] of this.items.items) {
			const px1 = Math.floor(coord1 / this.calResolution!) * this.binpx
			const px2 = Math.floor(coord2 / this.calResolution!) * this.binpx
			const x = firstisx ? px1 : px2
			const y = firstisx ? px2 : px1
			this.data.push([x, y, v])
			if (isintrachr) {
				this.data.push([y, x, v])
			}
		}
	}

	isFirstX() {
		if (this.parent('state').x.chr == this.parent('state').y.chr) return true
		return this.hic.chrorder.indexOf(this.parent('state').x.chr) < this.hic.chrorder.indexOf(this.parent('state').y.chr)
	}

	async render() {
		this.calResolution = this.parent('calResolution')
		this.setDefaultBinpx()

		await this.update()
	}

	async update() {
		//TODO, consolidate this with view main()
		this.plotDiv.xAxis.selectAll('*').remove()
		this.plotDiv.yAxis.selectAll('*').remove()
		this.plotDiv.plot.selectAll('*').remove()
		this.renderAxes()
		this.renderCanvas()
		const firstisx = this.isFirstX()
		this.getData(firstisx)
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
		for (const [x, y, v] of this.data) {
			this.colorizeElement.colorizeElement(
				x,
				y,
				v,
				this.ctx,
				this.binpx,
				this.binpx,
				this.parent('min'),
				this.parent('max'),
				'chrpair'
			)
		}
	}
}
