import { MainPlotDiv, ReturnedItems } from '../../../types/hic.ts'
import { axisstyle, font } from '#src/client'
import { axisRight, axisBottom } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { format as d3format } from 'd3-format'
import { pointer } from 'd3-selection'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { Positions } from '../data/Positions.ts'
import { GridElementsFormattedData } from '../data/GridElementsFormattedData.ts'
import { FirstChrX } from '../data/FirstChrX.ts'

export class ChrPairView {
	/** opts */
	app: any
	hic: any
	plotDiv: MainPlotDiv
	parent: (prop: string) => any
	items: ReturnedItems
	colorizeElement: ColorizeElement
	positions: Positions
	formattedData: GridElementsFormattedData

	chrxlen: number
	chrylen: number
	maxchrlen: number
	canvas: any
	ctx: any

	binpx = 1
	/** padding on the ends of x/y chr coordinate axes */
	readonly axispad = 10
	readonly axisLabelFontSize = 15
	calResolution: number | null = null
	data: number[][] = []

	constructor(opts) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.items = opts.items
		this.parent = opts.parent
		this.chrxlen = this.hic.genome.chrlookup[this.parent('state').x.chr.toUpperCase()].len
		this.chrylen = this.hic.genome.chrlookup[this.parent('state').y.chr.toUpperCase()].len
		this.maxchrlen = Math.max(this.chrxlen, this.chrylen)
		this.colorizeElement = new ColorizeElement()
		this.positions = new Positions(opts.error)
		this.formattedData = new GridElementsFormattedData()
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
			.attr('data-testid', 'sjpp-chrpair-svg-y')
			.attr('transform', 'translate(80,' + (this.axispad + h / 2) + ')')
			.append('text')
			.text(this.parent('state').y.chr)
			.attr('text-anchor', 'middle')
			.attr('font-size', this.axisLabelFontSize)
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
		const svgX = this.plotDiv.xAxis.append('svg').style('margin-top', '-4px')
		const w = Math.ceil(this.chrxlen / this.calResolution) * this.binpx
		svgX.attr('height', 100).attr('width', this.axispad * 2 + w)
		svgX
			.append('text')
			.attr('data-testid', 'sjpp-chrpair-svg-x')
			.text(this.parent('state').x.chr)
			.attr('font-size', this.axisLabelFontSize)
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
			.attr('data-testid', 'sjpp-chrpair-canvas')
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

	initDetailView(x: number, y: number) {
		const [xObj, yObj] = this.positions.setPosition(
			x,
			y,
			this.binpx,
			this.parent('state').x,
			this.parent('state').y,
			this.hic
		)
		this.app.dispatch({
			type: 'view_create',
			view: 'detail',
			config: {
				x: xObj,
				y: yObj
			}
		})
	}

	render() {
		this.calResolution = this.parent('calResolution')
		this.setDefaultBinpx()
		this.renderAxes()
		this.renderCanvas()

		this.update(this.items)
	}

	update(items: ReturnedItems) {
		this.items = items
		const firstisx = new FirstChrX(this.hic.chrorder, this.parent('state').x.chr, this.parent('state').y.chr).isFirstX()
		const isintrachr = this.parent('state').x.chr === this.parent('state').y.chr
		this.data = this.formattedData.formatData(
			'chrpair',
			items.items,
			this.binpx,
			this.calResolution!,
			firstisx,
			isintrachr
		)

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
		for (const [x, y, v] of this.data) {
			this.colorizeElement.colorizeElement(
				x,
				y,
				v,
				this.ctx,
				this.binpx, //width
				this.binpx, //height
				this.parent('min') as number,
				this.parent('max') as number,
				'chrpair'
			)
		}

		this.app.dispatch({ type: 'loading_active', active: false })
	}
}
