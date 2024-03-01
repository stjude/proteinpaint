import { SvgSvg, SvgG } from '../../../types/d3'
//import { Selection } from 'd3-selection'
//import * as client from '#src/client'
//import blocklazyload from '#src/block.lazyload'

import { axisRight, axisBottom } from 'd3-axis'
import { select as d3select, pointer, Selection } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import * as client from '#src/client'
import { format as d3format } from 'd3-format'
import * as common from '#shared/common'
import blocklazyload from '#src/block.lazyload'
import {
	HicstrawArgs,
	MainPlotDiv,
	HicstrawDom,
	DetailViewAxis,
	HicstrawInput,
	WholeGenomeView,
	ChrPairView,
	HorizontalView,
	DetailView
} from '../../../types/hic.ts'
import { showErrorsWithCounter } from '../../../dom/sayerror'
import { hicParseFile } from '../data/parseData.ts'
// import { init_hicInfoBar } from '../dom/info.bar.ts'
//import { init_hicControls } from '../controls/controlPanel.ts'
import { Div } from '../../../types/d3'

export class GenomeView {
	/** opts */
	app: any
	hic: any
	state: any
	plotDiv: MainPlotDiv
	resolution: number

	/** Dom */
	tip = new client.Menu()
	pica_x = new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
	pica_y = new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
	svg: SvgSvg
	layer_map: SvgG
	layer_sv: SvgG

	/** Data */
	/** px width for each chr */
	chr2px = {}
	lead2follow: any = new Map()
	data: any
	parent: any
	values: number[] = []

	/** Defaults */
	defaultChrLabWidth = 100
	borderwidth = 1
	default_maxVPerc = 5
	fontsize = 15
	xoff = 0
	yoff = 0
	binpx = 1
	atdev_chrnum = 8

	constructor(opts) {
		this.hic = opts.hic
		this.state = opts.state
		this.plotDiv = opts.plotDiv
		this.data = opts.data
		this.parent = opts.parent
		this.svg = this.plotDiv.plot.append('svg')
		this.layer_map = this.svg.append('g')
		this.layer_sv = this.svg.append('g')
		this.resolution = opts.hic.bpresolution[0]
		this.app = opts.app
	}

	renderGrid() {
		/** Defaults */
		const spacecolor = '#ccc'
		const checker_fill = '#DEF3FA'

		// heatmap layer underneath sv
		this.layer_map.attr('transform', `translate(${this.defaultChrLabWidth}, ${this.fontsize})`)
		this.layer_sv.attr('transform', `translate(${this.defaultChrLabWidth}, ${this.fontsize})`)

		let checker_row = true

		let totalpx = this.hic.chrlst.length
		for (const chr of this.hic.chrlst) {
			const w = Math.ceil(this.hic.genome.chrlookup[chr.toUpperCase()].len / this.resolution) * this.binpx
			this.chr2px[chr] = w
			totalpx += w
		}

		this.xoff = 0

		// column labels
		for (const chr of this.hic.chrlst) {
			const chrw = this.chr2px[chr]
			if (checker_row) {
				this.layer_map
					.append('rect')
					.attr('x', this.xoff)
					.attr('width', chrw)
					.attr('height', this.fontsize)
					.attr('y', -this.fontsize)
					.attr('fill', checker_fill)
			}
			checker_row = !checker_row
			this.layer_map
				.append('text')
				.attr('font-family', client.font)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.attr('x', this.xoff + chrw / 2)
				.text(chr)

			this.xoff += chrw
			this.layer_sv
				.append('line')
				.attr('x1', this.xoff)
				.attr('x2', this.xoff)
				.attr('y2', totalpx)
				.attr('stroke', spacecolor)
				.attr('shape-rendering', 'crispEdges')

			this.xoff += this.borderwidth
		}

		this.yoff = 0
		checker_row = true

		// row labels
		for (const chr of this.hic.chrlst) {
			const chrh = this.chr2px[chr]
			if (checker_row) {
				this.layer_map
					.append('rect')
					.attr('x', -this.defaultChrLabWidth)
					.attr('width', this.defaultChrLabWidth)
					.attr('height', chrh)
					.attr('y', this.yoff)
					.attr('fill', checker_fill)
			}
			checker_row = !checker_row
			this.layer_map
				.append('text')
				.attr('font-family', client.font)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('font-size', 12)
				.attr('y', this.yoff + chrh / 2)
				.text(chr)

			this.yoff += chrh
			this.layer_sv
				.append('line')
				.attr('x2', totalpx)
				.attr('y1', this.yoff)
				.attr('y2', this.yoff)
				.attr('stroke', spacecolor)
				.attr('shape-rendering', 'crispEdges')

			this.yoff += this.borderwidth
		}
	}

	setLeadFollowMap() {
		this.xoff = 0

		for (let i = 0; i < this.hic.chrlst.length; i++) {
			const lead = this.hic.chrlst[i]
			this.lead2follow.set(lead, new Map())

			this.yoff = 0

			for (let j = 0; j <= i; j++) {
				const follow = this.hic.chrlst[j]

				this.lead2follow!.get(lead)!.set(follow, {
					x: this.xoff,
					y: this.yoff
				})
				this.makeChrCanvas(lead, follow)
				this.yoff += this.chr2px[follow] + this.borderwidth
			}
			this.xoff += this.chr2px[lead] + this.borderwidth
		}
	}

	makeChrCanvas(lead: string, follow: string) {
		const obj = this.lead2follow.get(lead).get(follow)

		const leadchrlen = this.hic.genome.chrlookup[lead.toUpperCase()].len
		const followchrlen = this.hic.genome.chrlookup[follow.toUpperCase()].len

		const xbins = Math.ceil(leadchrlen / this.resolution)
		const ybins = Math.ceil(followchrlen / this.resolution)

		obj.canvas = this.hic.holder.append('canvas').style('display', 'none').node()

		obj.ctx = obj.canvas.getContext('2d')

		obj.canvas.width = xbins * this.binpx
		obj.canvas.height = ybins * this.binpx

		obj.img = this.layer_map
			.append('image')
			.attr('width', obj.canvas.width)
			.attr('height', obj.canvas.height)
			.attr('x', obj.x)
			.attr('y', obj.y)
			.on('click', async () => {
				//state????
				// self.x.chr = lead
				// self.y.chr = follow
				await this.app.dispatch({
					type: 'view_change',
					view: 'chrpair'
					//need to add state changes
				})
			})
			.on('mouseover', () => {
				this.showChrPair_mouseover(obj.img, lead, follow)
			})

		if (lead != follow) {
			obj.canvas2 = this.hic.holder.append('canvas').style('display', 'none').node()

			obj.ctx2 = obj.canvas2.getContext('2d')

			obj.canvas2.width = ybins * this.binpx
			obj.canvas2.height = xbins * this.binpx

			obj.img2 = this.layer_map
				.append('image')
				.attr('width', obj.canvas2.width)
				.attr('height', obj.canvas2.height)
				.attr('x', obj.y)
				.attr('y', obj.x)
				.on('click', async () => {
					await this.app.dispatch({
						type: 'view_change',
						view: 'chrpair'
					})
				})
				.on('mouseover', () => {
					this.showChrPair_mouseover(obj.img2, follow, lead)
				})
		} else {
			obj.ctx2 = obj.ctx
		}
	}

	showChrPair_mouseover(img: any, x_chr: string, y_chr: string) {
		const p = img.node().getBoundingClientRect()
		this.pica_x
			.clear()
			.show(p.left, p.top)
			.d.style('top', null)
			.style('bottom', window.innerHeight - p.top - window.pageYOffset + 'px')
			.text(x_chr)
		this.pica_y
			.clear()
			.show(p.left, p.top)
			.d.style('left', null)
			.style('right', document.body.clientWidth - p.left - window.pageXOffset + 'px') // no scrollbar width
			.text(y_chr)
	}

	makeSv() {
		const unknownchr = new Set()

		const radius = 8
		for (const item of this.hic.sv.items) {
			const _o = this.lead2follow.get(item.chr1)
			if (!_o) {
				unknownchr.add(item.chr1)
				continue
			}
			const obj = _o.get(item.chr2)
			if (!obj) {
				unknownchr.add(item.chr2)
				continue
			}

			const p1 = item.position1 / this.resolution
			const p2 = item.position2 / this.resolution
			this.layer_sv
				.append('circle')
				.attr('stroke', 'black')
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('cx', obj.x + p1)
				.attr('cy', obj.y + p2)
				.attr('r', radius)
				.on('mouseover', (event: MouseEvent) => {
					this.tooltipSv(event, item)
				})
				.on('mouseout', () => {
					this.tip.hide()
				})
				.on('click', () => {
					this.clickSv(item)
				})

			if (obj.img2) {
				this.layer_sv
					.append('circle')
					.attr('stroke', 'black')
					.attr('fill', 'whilte')
					.attr('fill-opacity', 0)
					.attr('cy', obj.x + p1)
					.attr('cx', obj.y + p2)
					.attr('r', radius)
					.on('mouseover', (event: MouseEvent) => {
						this.tooltipSv(event, item)
					})
					.on('mouseout', () => {
						this.tip.hide()
					})
					.on('click', () => {
						this.clickSv(item)
					})
			}
		}
	}

	tooltipSv(event: MouseEvent, item: any) {
		this.tip
			.clear()
			.show(event.clientX, event.clientY)
			.d.append('div')
			.text(
				item.chr1 == item.chr2
					? `${item.chr1}:${item.position1}-${item.position2}`
					: `${item.chr1}:${item.position1}>${item.chr2}:${item.position2}`
			)
	}

	clickSv(item: any) {
		const default_svpointspan = 500000
		const default_subpanelpxwidth = 600
		const subpanel_bordercolor = 'rgba(200,0,0,.1)'

		const pane = client.newpane({ x: 100, y: 100 }) as Partial<Pane>
		;(pane.header as Pane['header']).text(
			this.hic.name +
				' ' +
				(item.chr1 == item.chr2
					? `${item.chr1}:${item.position1}-${item.position2}`
					: `${item.chr1}:${item.position1}>${item.chr2}:${item.position2}`)
		)
		const tracks = [
			{
				type: client.tkt.hicstraw,
				file: this.hic.file,
				enzyme: this.hic.enzyme,
				maxpercentage: this.default_maxVPerc,
				pyramidup: 1,
				name: this.hic.name
			}
		]
		if (this.hic.tklst) {
			for (const t of this.hic.tklst) {
				tracks.push(t)
			}
		}
		client.first_genetrack_tolist(this.hic.genome, tracks)
		const arg: any = {
			holder: pane.body,
			hostURL: this.hic.hostURL,
			jwt: this.hic.jwt,
			genome: this.hic.genome,
			nobox: 1,
			tklst: tracks
		}

		if (item.chr1 == item.chr2 && Math.abs(item.position2 - item.position1) < default_svpointspan * 2) {
			// two breakends overlap
			arg.chr = item.chr1
			const w = Math.abs(item.position2 - item.position1)
			arg.start = Math.max(1, Math.min(item.position1, item.position2) - w)
			arg.stop = Math.min(
				this.hic.genome.chrlookup[item.chr1.toUpperCase()].len,
				Math.max(item.position1, item.position2) + w
			)
		} else {
			arg.chr = item.chr1
			arg.start = Math.max(1, item.position1 - default_svpointspan / 2)
			arg.stop = Math.min(
				this.hic.genome.chrlookup[item.chr1.toUpperCase()].len,
				item.position1 + default_svpointspan / 2
			)
			arg.width = default_subpanelpxwidth
			arg.subpanels = [
				{
					chr: item.chr2,
					start: Math.max(1, item.position2 - default_svpointspan / 2),
					stop: Math.min(
						this.hic.genome.chrlookup[item.chr2.toUpperCase()].len,
						item.position2 + default_svpointspan / 2
					),
					width: default_subpanelpxwidth,
					leftpad: 10,
					leftborder: subpanel_bordercolor
				}
			]
		}
		blocklazyload(arg)
	}

	async render() {
		//Update info bar
		this.renderGrid()
		this.setLeadFollowMap()

		if (this.hic.sv && this.hic.sv.items) {
			this.makeSv()
		}

		this.svg.attr('width', this.defaultChrLabWidth + this.xoff).attr('height', this.fontsize + this.yoff)

		await this.update(this.data)
	}

	async update(data) {
		/* after the ui is created, load data for each chr pair,
		await on each request to finish to avoid server lockup
	
		There might be data inconsistency with hic file. It may be missing data for chromosomes that are present in the header; querying such chr will result in error being thrown
		do not flood ui with such errors, to tolerate, collect all errors and show in one place
		*/
		this.data = data
		await this.makeElements()
	}

	async makeElements() {
		for (const data of this.data) {
			const obj = this.lead2follow.get(data.lead).get(data.follow)
			obj.data = [] as any
			obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
			if (obj.canvas2) {
				obj.ctx2.clearRect(0, 0, obj.canvas2.width, obj.canvas.height)
			}
			for (const [plead, pfollow, value] of data.items) {
				const leadpx = Math.floor(plead / this.resolution) * this.binpx
				const followpx = Math.floor(pfollow / this.resolution) * this.binpx
				obj.data.push([leadpx, followpx, value])
				this.parent.colorizeElement(leadpx, followpx, value, obj, this.binpx, this.binpx)
			}
			obj.img.attr('xlink:href', obj.canvas.toDataURL())
			if (obj.canvas2) {
				obj.img2.attr('xlink:href', obj.canvas2.toDataURL())
			}
		}
	}
}

// /** Default normalization method if none returned from the server. Exported to parsing and controls script*/
// export const defaultnmeth = 'NONE'

const atdev_chrnum = 8

const hardcode_wholegenomechrlabwidth = 100
/** when clicking on chrpairview, to set a initial view range for detail view, the number of bins to cover at the clicked point */
const initialbinnum_detail = 20
/** at bp resolution, minimum bin number */
const minimumbinnum_bp = 200
/** mininum canvas w/h, detail view */
const mincanvassize_detail = 500
/** minimum bin num for fragment */
const minimumbinnum_frag = 100
/** span at breakpoint when clicking an sv from x/y view to show horizontal view */
const default_svpointspan = 500000
/** default max value percentage for hicstraw track */
const default_hicstrawmaxvperc = 5
/** default px width of subpanels */
const default_subpanelpxwidth = 600

const subpanel_bordercolor = 'rgba(200,0,0,.1)'

type Pane = {
	pain: Selection<HTMLDivElement, any, any, any>
	mini: boolean
	header: Selection<HTMLDivElement, any, any, any>
	body: Selection<any, any, any, any>
}
/**
 * Parses input file and renders plot. Whole genome view renders as the default.
 * Clicking on chr-chr svg within the whole genonme view launches the chr-pair view.
 * Clicking anywhere within the chr-pair view launches the horizonal view. The detail view can be launched from the Detailed View button.
 *
 * Issues:
 * - CONFIG menu cutoff in detail view. Elem does not allow overflow
 *
 * TODOs:
 * - add state-like functionality. Move objs for rendering under self and separate hic input. Add functions for views to operate independently of each other.
 * - Possibly type Pane can be import somewhere??
 * - Maybe make a class for each view?? See comments in utility functions
 */
class Hicstat {
	holder: Div
	debugmode: boolean
	dom: HicstrawDom
	/** Collection of error messages. Appears to the user in bulk when self.error() fires. */
	errList: string[]
	/** TODO: fix this Partial business. */
	/** Rendering properities specific to the whole genome view */
	genomeview: Partial<WholeGenomeView>
	/** Rendering properities specific to the chr-chr pair view */
	chrpairview: Partial<ChrPairView>
	/** Rendering properities specific to the horizontal (2 chr subpanel pair) view */
	horizontalview: Partial<HorizontalView>
	/** Rendering properities specific to the detail view */
	detailview: Partial<DetailView>
	/** The following are flags for which view is displayed to switch between views.
	 * See the view names above. */
	ingenome: boolean
	inchrpair: boolean
	indetail: boolean
	inhorizontal: boolean
	/** Required position attributes for every view except for the whole genome view. Only chr pair does not need start or stop. */
	x: Partial<{
		chr: string
		start: number
		stop: number
	}>
	y: Partial<{
		chr: string
		start: number
		stop: number
	}>
	/** This maybe unneccessary but leave until runproteinpaint() enabled different views  */
	colorBar: {
		startColor: string
		endColor: string
	}

	constructor(hic: any, debugmode: boolean) {
		this.holder = hic.holder
		this.debugmode = debugmode
		this.dom = {
			errorDiv: hic.holder.append('div').classed('sjpp-hic-error', true),
			controlsDiv: hic.holder.append('div').classed('sjpp-hic-controls', true).style('display', 'inline-block'),
			infoBarDiv: hic.holder.append('div').classed('sjpp-hic-infobar', true).style('display', 'inline-block'),
			loadingDiv: d3select('body').append('div').attr('id', 'sjpp-loading-overlay'),
			plotDiv: hic.holder.append('div').classed('sjpp-hic-main', true).style('display', 'inline-block'),
			tip: new client.Menu()
		}
		this.errList = []
		this.genomeview = {
			data: [],
			matrixType: 'observed',
			binpx: 1,
			/**Old method, no longer in use. */
			/** wholegenome is fixed to use lowest bp resolution, and fixed cutoff value for coloring*/
			//bpmaxv: 5000,
			lead2follow: new Map(),
			pica_x: new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 }),
			pica_y: new client.Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
		}
		this.chrpairview = {
			data: []
		}
		this.horizontalview = {
			args: {
				hostURL: hic.hostURL,
				jwt: hic.jwt,
				genome: hic.genome,
				nobox: 1
			}
		}
		this.detailview = {
			bbmargin: 1,
			xb: {
				leftheadw: 20,
				rightheadw: 40,
				lpad: 1,
				rpad: 1
			} as DetailViewAxis,
			yb: {
				leftheadw: 20,
				rightheadw: 40,
				lpad: 1,
				rpad: 1
			} as DetailViewAxis
		}
		this.ingenome = true
		this.inchrpair = false
		this.indetail = false
		this.inhorizontal = false
		this.x = {}
		this.y = {}
		this.colorBar = {
			//Start with white for zero. Change color when negative values are implemented
			//Args shown are not in use. Anticipating future implementation
			startColor: hic.colorNeg || 'white',
			endColor: hic.color || hic.colorPos || 'red'
		}
	}

	async error(err: string | string[]) {
		if (err && typeof err == 'string') this.errList.push(err)
		showErrorsWithCounter(this.errList, this.dom.errorDiv)
		//Remove errors after displaying
		this.errList = []
		this.dom.loadingDiv.style('display', 'none')
	}

	async render(hic: any) {
		this.dom.loadingDiv.append('div').attr('class', 'sjpp-spinner').style('display', '')
		await hicParseFile(hic, this.debugmode, this.errList)
		if (this.errList.length) {
			//Display file reader errors to user before rendering app
			this.error(this.errList)
			this.dom.loadingDiv.style('display', 'none')
			return
		}
		//await init_hicInfoBar(hic, this)
		//init_hicControls(hic, this)
		this.dom.plotDiv.append('table').classed('sjpp-hic-plot-main', true)
		const tr1 = this.dom.plotDiv.append('tr')
		const tr2 = this.dom.plotDiv.append('tr')
		this.dom.plotDiv = {
			plot: tr1.append('td').classed('sjpp-hic-plot', true),
			yAxis: tr1.append('td').classed('sjpp-hic-plot-xaxis', true),
			xAxis: tr2.append('td').classed('sjpp-hic-plot-yaxis', true),
			blank: tr2.append('td')
		} as MainPlotDiv
		/** Open the whole genome view by default. User clicks within squares to launch the other views. */
		//await this.init_wholeGenomeView(hic)
	}

	// async init_wholeGenomeView(hic: any) {
	// 	this.dom.loadingDiv.style('display', '')
	// 	this.dom.controlsDiv.view.text('Genome')
	// 	const resolution = hic.bpresolution[0]

	// 	this.dom.infoBarDiv.resolution.text(common.bplen(resolution) + ' bp')

	// 	// # pixel per bin, may set according to resolution
	// 	const binpx = 1

	// 	// for each chr, a row as canvas container
	// 	this.genomeview.svg = this.dom.plotDiv.plot.append('svg')
	// 	this.genomeview.resolution = resolution

	// 	const fontsize = 15 // chr labels
	// 	const borderwidth = 1
	// 	const spacecolor = '#ccc'

	// 	// heatmap layer underneath sv
	// 	const layer_map = this.genomeview.svg
	// 		.append('g')
	// 		.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
	// 	this.genomeview.layer_map = layer_map
	// 	const layer_sv = this.genomeview.svg
	// 		.append('g')
	// 		.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
	// 	this.genomeview.layer_sv = layer_sv

	// 	let checker_row = true

	// 	const chr2px = {} // px width for each chr
	// 	let totalpx = hic.chrlst.length
	// 	for (const chr of hic.chrlst) {
	// 		const w = Math.ceil(hic.genome.chrlookup[chr.toUpperCase()].len / resolution) * binpx
	// 		chr2px[chr] = w
	// 		totalpx += w
	// 	}
	// 	const checker_fill = '#DEF3FA'
	// 	let xoff = 0
	// 	// column labels
	// 	for (const chr of hic.chrlst) {
	// 		const chrw = chr2px[chr]
	// 		if (checker_row) {
	// 			layer_map
	// 				.append('rect')
	// 				.attr('x', xoff)
	// 				.attr('width', chrw)
	// 				.attr('height', fontsize)
	// 				.attr('y', -fontsize)
	// 				.attr('fill', checker_fill)
	// 		}
	// 		checker_row = !checker_row
	// 		layer_map
	// 			.append('text')
	// 			.attr('font-family', client.font)
	// 			.attr('text-anchor', 'middle')
	// 			.attr('font-size', 12)
	// 			.attr('x', xoff + chrw / 2)
	// 			.text(chr)

	// 		xoff += chrw
	// 		layer_sv
	// 			.append('line')
	// 			.attr('x1', xoff)
	// 			.attr('x2', xoff)
	// 			.attr('y2', totalpx)
	// 			.attr('stroke', spacecolor)
	// 			.attr('shape-rendering', 'crispEdges')

	// 		xoff += borderwidth
	// 	}

	// 	let yoff = 0
	// 	checker_row = true

	// 	// row labels
	// 	for (const chr of hic.chrlst!) {
	// 		const chrh = chr2px[chr]
	// 		if (checker_row) {
	// 			layer_map
	// 				.append('rect')
	// 				.attr('x', -hardcode_wholegenomechrlabwidth)
	// 				.attr('width', hardcode_wholegenomechrlabwidth)
	// 				.attr('height', chrh)
	// 				.attr('y', yoff)
	// 				.attr('fill', checker_fill)
	// 		}
	// 		checker_row = !checker_row
	// 		layer_map
	// 			.append('text')
	// 			.attr('font-family', client.font)
	// 			.attr('text-anchor', 'end')
	// 			.attr('dominant-baseline', 'central')
	// 			.attr('font-size', 12)
	// 			.attr('y', yoff + chrh / 2)
	// 			.text(chr)

	// 		yoff += chrh
	// 		layer_sv
	// 			.append('line')
	// 			.attr('x2', totalpx)
	// 			.attr('y1', yoff)
	// 			.attr('y2', yoff)
	// 			.attr('stroke', spacecolor)
	// 			.attr('shape-rendering', 'crispEdges')

	// 		yoff += borderwidth
	// 	}

	// 	const manychr = hic.atdev ? atdev_chrnum : hic.chrlst.length
	// 	xoff = 0

	// 	for (let i = 0; i < manychr; i++) {
	// 		const lead = hic.chrlst[i]
	// 		this.genomeview!.lead2follow!.set(lead, new Map())

	// 		yoff = 0

	// 		for (let j = 0; j <= i; j++) {
	// 			const follow = hic.chrlst[j]
	// 			this.genomeview!.lead2follow!.get(lead)!.set(follow, {
	// 				x: xoff,
	// 				y: yoff
	// 			})
	// 			makewholegenome_chrleadfollow(hic, lead, follow, this)
	// 			yoff += chr2px[follow] + borderwidth
	// 		}
	// 		xoff += chr2px[lead] + borderwidth
	// 	}

	// 	if (hic.sv && hic.sv.items) {
	// 		makewholegenome_sv(hic, this)
	// 	}

	// 	this.genomeview.svg.attr('width', hardcode_wholegenomechrlabwidth + xoff).attr('height', fontsize + yoff)

	// 	/* after the ui is created, load data for each chr pair,
	// 	await on each request to finish to avoid server lockup

	// 	There might be data inconsistency with hic file. It may be missing data for chromosomes that are present in the header; querying such chr will result in error being thrown
	// 	do not flood ui with such errors, to tolerate, collect all errors and show in one place
	// 	*/

	// 	await makeWholeGenomeElements(hic, this)

	// 	if (this.errList.length) {
	// 		//Loading div problematic with errors. Fix problem when it becomes a component
	// 		this.dom.loadingDiv.style('display', 'none')
	// 		this.error(this.errList)
	// 	}
	// 	this.dom.loadingDiv.style('display', 'none')

	// 	return
	// }

	async init_chrPairView(hic: any, chrx: string, chry: string) {
		this.dom.controlsDiv.view.text(`${chrx}-${chry} Pair`)
		if (Object.values(this.x).length > 0) this.x = {}
		this.x.chr = chrx
		if (Object.values(this.y).length > 0) this.y = {}
		this.y.chr = chry
		const detailView = this.init_detailView.bind(this)
		nmeth2select(hic, this.chrpairview, true)
		matrixType2select(this.chrpairview, this, true)

		this.ingenome = false
		this.inchrpair = true
		this.indetail = false
		this.inhorizontal = false

		showBtns(this)
		this.genomeview.svg!.remove()

		const chrxlen = hic.genome.chrlookup[chrx.toUpperCase()].len
		const chrylen = hic.genome.chrlookup[chry.toUpperCase()].len
		const maxchrlen = Math.max(chrxlen, chrylen)

		/*
		for resolution bin from great to tiny
		find one that just shows >200 # bins over biggest chr
		*/
		let resolution = null
		for (let i = 0; i < hic.bpresolution.length; i++) {
			const res = hic.bpresolution[i]
			if (maxchrlen / res > 200) {
				resolution = res
				break
			}
		}
		if (resolution == null) {
			this.error('no suitable resolution')
			return
		}
		this.dom.infoBarDiv.resolution.text(common.bplen(resolution) + ' bp')

		let binpx = 1
		while ((binpx * maxchrlen) / resolution < 600) {
			binpx++
		}

		const axispad = 10 // padding on the ends of x/y chr coordinate axes

		{
			// y axis
			this.dom.plotDiv.yAxis.selectAll('*').remove()
			const svg = this.dom.plotDiv.yAxis.append('svg')
			const h = Math.ceil(chrylen / resolution) * binpx
			svg.attr('width', 100).attr('height', axispad * 2 + h)
			svg
				.append('g')
				.attr('transform', 'translate(80,' + (axispad + h / 2) + ')')
				.append('text')
				.text(chry)
				.attr('text-anchor', 'middle')
				.attr('font-size', 15)
				.attr('font-family', client.font)
				.attr('dominant-baseline', 'central')
				.attr('transform', 'rotate(90)')
			client.axisstyle({
				axis: svg
					.append('g')
					.attr('transform', 'translate(1,' + axispad + ')')
					.call(axisRight(scaleLinear().domain([0, chrylen]).range([0, h])).tickFormat(d3format('.2s'))),
				showline: true
			})
			this.chrpairview.axisy = svg as any
		}

		{
			// x axis
			this.dom.plotDiv.xAxis.selectAll('*').remove()
			const svg = this.dom.plotDiv.xAxis.append('svg')
			const w = Math.ceil(chrxlen / resolution) * binpx
			svg.attr('height', 100).attr('width', axispad * 2 + w)
			svg
				.append('text')
				.text(chrx)
				.attr('font-size', 15)
				.attr('font-family', client.font)
				.attr('x', axispad + w / 2)
				.attr('text-anchor', 'middle')
				.attr('y', 60)
			client.axisstyle({
				axis: svg
					.append('g')
					.attr('transform', 'translate(' + axispad + ',1)')
					.call(axisBottom(scaleLinear().domain([0, chrxlen]).range([0, w])).tickFormat(d3format('.2s'))),
				showline: true
			})
			this.chrpairview.axisx = svg as any
		}

		this.chrpairview.resolution = resolution
		this.chrpairview.binpx = binpx

		const canvas = this.dom.plotDiv.plot
			.append('canvas')
			.style('margin', axispad + 'px')
			.on('click', async function (this: any, event: MouseEvent) {
				const [x, y] = pointer(event, this)
				await detailView(hic, chrx, chry, x, y)
			})
			.node()
		canvas!.width = Math.ceil(chrxlen / resolution) * binpx
		canvas!.height = Math.ceil(chrylen / resolution) * binpx
		const ctx = canvas!.getContext('2d')
		this.chrpairview.ctx = ctx
		this.chrpairview.canvas = canvas

		await getdata_chrpair(hic, this)
	}

	set_Positions(hic: any, chrx: string, chry: string, x: number, y: number) {
		this.x.chr = chrx
		this.y.chr = chry

		if (x && y) {
			const viewrangebpw = this.chrpairview.resolution! * initialbinnum_detail

			let coordx = Math.max(
				1,
				Math.floor((x * this.chrpairview.resolution!) / this.chrpairview.binpx!) - viewrangebpw / 2
			)
			let coordy = Math.max(
				1,
				Math.floor((y * this.chrpairview.resolution!) / this.chrpairview.binpx!) - viewrangebpw / 2
			)

			// make sure positions are not out of bounds
			{
				const lenx = hic.genome.chrlookup[chrx.toUpperCase()].len
				if (coordx + viewrangebpw >= lenx) {
					coordx = lenx - viewrangebpw
				}
				const leny = hic.genome.chrlookup[chry.toUpperCase()].len
				if (coordy + viewrangebpw > leny) {
					coordy = leny - viewrangebpw
				}
			}

			;(this.x.start = coordx), (this.x.stop = coordx + viewrangebpw)
			this.y.start = coordy
			this.y.stop = coordy + viewrangebpw
		}
	}

	async init_detailView(hic: any, chrx: string, chry: string, x: number, y: number) {
		this.dom.controlsDiv.view.text('Detailed')
		nmeth2select(hic, this.detailview, true)
		matrixType2select(this.detailview, this, true)

		this.ingenome = false
		this.inchrpair = false
		this.indetail = true
		this.inhorizontal = false

		// const isintrachr = chrx == chry
		showBtns(this)

		if (!this.x.start || !this.x.stop || !this.y.start || !this.y.stop) this.set_Positions(hic, chrx, chry, x, y)

		// // default view span
		const viewrangebpw = this.chrpairview.resolution! * initialbinnum_detail

		let resolution: number | null = null
		for (const res of hic.bpresolution) {
			if (viewrangebpw / res > minimumbinnum_bp) {
				resolution = res
				break
			}
		}
		if (resolution == null) {
			// use finest
			resolution = hic.bpresolution[hic.bpresolution.length - 1]
		}
		let binpx = 2
		while ((binpx * viewrangebpw) / resolution! < mincanvassize_detail) {
			binpx += 2
		}

		// px width of x and y blocks
		const blockwidth = Math.ceil((binpx * viewrangebpw) / resolution!)
		this.detailview.xb!.width = blockwidth
		this.detailview.yb!.width = blockwidth

		/** TODO: Update this logic when calling from runproteinpaint() */
		if (this.chrpairview.axisx) this.chrpairview.axisx.remove()
		if (this.chrpairview.axisy) this.chrpairview.axisy.remove()
		this.dom.plotDiv.plot.selectAll('*').remove()

		/************** middle canvas *****************/

		const canvasholder = this.dom.plotDiv.plot
			.append('div')
			.style('position', 'relative')
			.style('width', blockwidth + 'px')
			.style('height', blockwidth + 'px')
			.style('overflow', 'hidden')

		const canvas = canvasholder
			.append('canvas')
			.style('display', 'block')
			.style('position', 'absolute')
			.attr('width', blockwidth)
			.attr('height', blockwidth)
			.attr('left', '10px')
			.attr('top', '10px')
			.on('mousedown', (event: MouseEvent) => {
				const body = d3select(document.body)
				const x = event.clientX
				const y = event.clientY
				const oldx = Number.parseInt(canvas.style('left'))
				const oldy = Number.parseInt(canvas.style('top'))
				body.on('mousemove', event => {
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.detailview.xb!.panning(xoff)
					this.detailview.yb!.panning(yoff)
					canvas.style('left', oldx + xoff + 'px').style('top', oldy + yoff + 'px')
				})
				body.on('mouseup', (event: MouseEvent) => {
					body.on('mousemove', null).on('mouseup', null)
					const xoff = event.clientX - x
					const yoff = event.clientY - y
					this.detailview.xb!.pannedby(xoff)
					this.detailview.yb!.pannedby(yoff)
				})
			})
		const ctx = canvas.node()!.getContext('2d')

		this.detailview.canvas = canvas
		this.detailview.ctx = ctx

		await detailViewUpdateHic(hic, this)

		/******** common parameter for x/y block ********/

		const arg: any = {
			noresize: true,
			nobox: true,
			butrowbottom: true,
			style: {
				margin: this.detailview.bbmargin + 'px'
			},
			genome: hic.genome,
			hostURL: hic.hostURL,
			width: blockwidth,
			leftheadw: 20,
			rightheadw: 40,
			tklst: []
		}
		client.first_genetrack_tolist(hic.genome, arg.tklst)

		// duplicate arg for y
		const arg2: any = {}
		for (const k in arg) arg2[k] = arg[k]

		/******************* x block ******************/

		let xfirsttime = true
		arg.chr = this.x.chr
		arg.start = this.x.start
		arg.stop = this.x.stop
		arg.holder = this.dom.plotDiv.xAxis
		arg.onloadalltk_always = async (bb: any) => {
			/**Replace with Block type when defined later */
			/*
			cannot apply transition to canvasholder
			it may prevent resetting width when both x and y are changing
			*/
			canvasholder.style(
				'width',
				2 * this.detailview.bbmargin! + bb.leftheadw + bb.lpad + bb.width + bb.rpad + bb.rightheadw + 'px'
			)

			if (xfirsttime) {
				xfirsttime = false
				// must do this:
				canvas.transition().style('left', this.detailview.bbmargin + bb.leftheadw + bb.lpad + 'px')
				return
			}
			await detailViewUpdateRegionFromBlock(hic, this)
		}
		arg.onpanning = (xoff: number) => {
			canvas.style(
				'left',
				xoff + this.detailview.bbmargin! + this.detailview.xb!.leftheadw + this.detailview.xb!.lpad + 'px'
			)
		}
		blocklazyload(arg).then(block => {
			this.detailview.xb = block
		})

		/******************* y block ******************/

		const sheath = this.dom.plotDiv.yAxis
			.append('div')
			.style('position', 'relative')
			.style('width', '200px') // dummy size
			.style('height', '800px')

		const rotor = sheath
			.append('div')
			.style('position', 'absolute')
			.style('bottom', '0px')
			.style('transform', 'rotate(-90deg)')
			.style('transform-origin', 'left bottom')

		let yfirsttime = true

		arg2.rotated = true
		arg2.showreverse = true

		arg2.chr = this.y.chr
		arg2.start = this.y.start
		arg2.stop = this.y.stop
		arg2.holder = rotor
		arg2.onloadalltk_always = async bb => {
			const bbw = bb.leftheadw + bb.lpad + bb.width + bb.rpad + bb.rightheadw + 2 * this.detailview.bbmargin!
			sheath.transition().style('height', bbw + 'px')
			canvasholder.style('height', bbw + 'px')
			if (yfirsttime) {
				yfirsttime = false
				// must do this:
				canvas.transition().style('top', this.detailview.bbmargin + bb.rpad + bb.rightheadw + 'px')
				return
			}
			await detailViewUpdateRegionFromBlock(hic, this)
		}
		arg2.onpanning = xoff => {
			canvas.style(
				'top',
				-xoff + this.detailview.bbmargin! + this.detailview.yb!.rightheadw + this.detailview.yb!.rpad + 'px'
			)
		}

		const buttonrowh = 30
		arg2.onsetheight = bbh => {
			rotor.transition().style('left', this.detailview.bbmargin + bbh + buttonrowh + 'px')
		}

		blocklazyload(arg2).then(block => {
			this.detailview.yb = block
		})
		/*
		//XXX this won't work, will duplicate the chunk for block, try named chunk
		import('./block').then(p=>{
			hic.detailview.yb = new p.Block(arg2)
		})
		*/
		this.dom.controlsDiv.zoomIn.on('click', () => {
			this.detailview.xb!.zoomblock(2, false)
			this.detailview.yb!.zoomblock(2, false)
		})
		this.dom.controlsDiv.zoomOut.on('click', () => {
			this.detailview.xb!.zoomblock(2, true)
			this.detailview.yb!.zoomblock(2, true)
		})

		this.dom.controlsDiv.horizontalViewBtn.style('display', 'block').on('click', async () => {
			await this.init_horizontalView(hic, chrx, chry, x, y)
		})
	}

	async init_horizontalView(hic: any, chrx: string, chry: string, x: number, y: number) {
		this.dom.controlsDiv.view.text('Horizontal')
		nmeth2select(hic, this.horizontalview, true)
		matrixType2select(this.horizontalview, this, true)

		this.dom.plotDiv.xAxis.selectAll('*').remove()
		this.dom.plotDiv.yAxis.selectAll('*').remove()
		this.dom.plotDiv.plot.selectAll('*').remove()

		this.ingenome = false
		this.inchrpair = false
		this.indetail = false
		this.inhorizontal = true

		showBtns(this)

		if (!this.x.start || !this.x.stop || !this.y.start || !this.y.stop) this.set_Positions(hic, chrx, chry, x, y)

		const regionx = { chr: this.x.chr, start: this.x.start, stop: this.x.stop }
		const regiony = { chr: this.y.chr, start: this.y.start, stop: this.y.stop }

		const tracks = [
			{
				type: client.tkt.hicstraw,
				file: hic.file,
				enzyme: hic.enzyme,
				maxpercentage: default_hicstrawmaxvperc,
				pyramidup: 1,
				name: hic.name
			}
		]
		if (hic.tklst) {
			for (const t of hic.tklst) {
				tracks.push(t)
			}
		}
		client.first_genetrack_tolist(hic.genome, tracks)
		const arg: any = {
			holder: this.dom.plotDiv.plot,
			hostURL: hic.hostURL,
			jwt: hic.jwt,
			genome: hic.genome,
			nobox: 1,
			tklst: tracks
		}
		if (
			regionx.chr == regiony.chr &&
			Math.max(regionx.start!, regiony.start!) < Math.min(regionx.stop!, regiony.stop!)
		) {
			// x/y overlap
			arg.chr = regionx.chr
			arg.start = Math.min(regionx.start!, regiony.start!)
			arg.stop = Math.max(regionx.stop!, regiony.stop!)
		} else {
			arg.chr = regionx.chr
			arg.start = regionx.start
			arg.stop = regionx.stop
			arg.width = default_subpanelpxwidth
			arg.subpanels = [
				{
					chr: regiony.chr,
					start: regiony.start,
					stop: regiony.stop,
					width: default_subpanelpxwidth,
					leftpad: 10,
					leftborder: subpanel_bordercolor
				}
			]
		}
		this.horizontalview.args = arg //save so can reload when switching back from detail view
		blocklazyload(arg)

		this.dom.controlsDiv.detailViewBtn.style('display', 'block').on('click', async () => {
			await this.init_detailView(hic, chrx, chry, x, y)
		})

		this.dom.infoBarDiv.colorScaleDiv.style('display', 'none')
		this.dom.infoBarDiv.colorScaleLabel.style('display', 'none')
	}

	debug() {
		/** Quick fix for returning self to the client for testing.
		 * Remove once rx app implemented.
		 */
		return this
	}
}
/**
 * Launches hicstraw app
 * Will replace later with class object above
 * @param hic hic object
 * @param debugmode boolean
 */

// export async function init_hicstraw(hic: HicstrawInput, debugmode: boolean) {
// 	const hicstat = new Hicstat(hic, debugmode)
// 	await hicstat.render(hic)
// 	if (debugmode) {
// 		return hicstat.debug()
// 	}
// }

export function showBtns(self: any) {
	//Show in any other view except whole genome
	self.dom.controlsDiv.genomeViewBtn.style('display', self.ingenome ? 'none' : 'inline-block')

	if (self.indetail) {
		self.dom.controlsDiv.chrpairViewBtn.html(`&#8810; Entire ${self.x.chr}-${self.y.chr}`).style('display', 'block')
		//Only show horizontalViewBtn and zoom buttons in detail view
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'block')
		self.dom.controlsDiv.zoomDiv.style('display', 'contents')
		//Hide previously shown detail view btn
		self.dom.controlsDiv.detailViewBtn.style('display', 'none')
	} else if (self.inhorizontal) {
		//Only show chrpairViewBtn if in horizonal or detail view
		//Include chr x and chr y in the button text
		self.dom.controlsDiv.chrpairViewBtn.html(`&#8810; Entire ${self.x.chr}-${self.y.chr}`).style('display', 'block')
		//Only show detailViewBtn in horizontal view
		self.dom.controlsDiv.detailViewBtn.style('display', 'block')
		//Hide if horizontal and zoom btns if previously displayed
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.zoomDiv.style('display', 'none')
	} else {
		self.dom.controlsDiv.chrpairViewBtn.style('display', 'none')
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.detailViewBtn.style('display', 'none')
		self.dom.controlsDiv.zoomDiv.style('display', 'none')
	}
}

// //////////////////// __whole genome view__ ////////////////////

// function makewholegenome_chrleadfollow(hic: any, lead: any, follow: any, self: any) {
// 	const binpx = self.genomeview.binpx
// 	const obj = self.genomeview.lead2follow.get(lead).get(follow)

// 	const leadchrlen = hic.genome.chrlookup[lead.toUpperCase()].len
// 	const followchrlen = hic.genome.chrlookup[follow.toUpperCase()].len

// 	const xbins = Math.ceil(leadchrlen / self.genomeview.resolution)
// 	const ybins = Math.ceil(followchrlen / self.genomeview.resolution)

// 	obj.canvas = hic.holder.append('canvas').style('display', 'none').node()

// 	obj.ctx = obj.canvas.getContext('2d')

// 	obj.canvas.width = xbins * binpx
// 	obj.canvas.height = ybins * binpx

// 	obj.img = self.genomeview.layer_map
// 		.append('image')
// 		.attr('width', obj.canvas.width)
// 		.attr('height', obj.canvas.height)
// 		.attr('x', obj.x)
// 		.attr('y', obj.y)
// 		.on('click', async () => {
// 			self.x.chr = lead
// 			self.y.chr = follow
// 			await self.init_chrPairView(hic, lead, follow, self)
// 		})
// 		.on('mouseover', () => {
// 			chrpair_mouseover(self, obj.img, lead, follow)
// 		})

// 	if (lead != follow) {
// 		obj.canvas2 = hic.holder.append('canvas').style('display', 'none').node()

// 		obj.ctx2 = obj.canvas2.getContext('2d')

// 		obj.canvas2.width = ybins * binpx
// 		obj.canvas2.height = xbins * binpx

// 		obj.img2 = self.genomeview.layer_map
// 			.append('image')
// 			.attr('width', obj.canvas2.width)
// 			.attr('height', obj.canvas2.height)
// 			.attr('x', obj.y)
// 			.attr('y', obj.x)
// 			.on('click', async () => {
// 				await self.init_chrPairView(hic, follow, lead, self)
// 			})
// 			.on('mouseover', () => {
// 				chrpair_mouseover(self, obj.img2, follow, lead)
// 			})
// 	} else {
// 		obj.ctx2 = obj.ctx
// 	}
// }

// function chrpair_mouseover(self: any, img: any, x_chr: string, y_chr: string) {
// 	const p = img.node().getBoundingClientRect()
// 	self.genomeview.pica_x
// 		.clear()
// 		.show(p.left, p.top)
// 		.d.style('top', null)
// 		.style('bottom', window.innerHeight - p.top - window.pageYOffset + 'px')
// 		.text(x_chr)
// 	self.genomeview.pica_y
// 		.clear()
// 		.show(p.left, p.top)
// 		.d.style('left', null)
// 		.style('right', document.body.clientWidth - p.left - window.pageXOffset + 'px') // no scrollbar width
// 		.text(y_chr)
// }

// export async function makeWholeGenomeElements(hic: any, self: any, manychrArg?: number) {
// 	self.dom.loadingDiv.style('display', '')
// 	const manychr = manychrArg || (hic.atdev ? atdev_chrnum : hic.chrlst.length)
// 	const vlst = [] as number[]

// 	for (let i = 0; i < manychr; i++) {
// 		const lead = hic.chrlst[i]
// 		for (let j = 0; j <= i; j++) {
// 			const follow = hic.chrlst[j]
// 			await getWholeGenomeData(hic, self, lead, follow, vlst)
// 		}
// 	}
// 	await setViewCutoff(vlst, self.genomeview, self)

// 	await colorizeGenomeElements(self)
// 	self.dom.loadingDiv.style('display', 'none')
// }

// async function getWholeGenomeData(hic: any, self: any, lead: any, follow: any, vlst: any) {
// 	const arg = {
// 		matrixType: self.genomeview.matrixType,
// 		file: hic.file,
// 		url: hic.url,
// 		pos1: hic.nochr ? lead.replace('chr', '') : lead,
// 		pos2: hic.nochr ? follow.replace('chr', '') : follow,
// 		nmeth: self.genomeview.nmeth,
// 		resolution: self.genomeview.resolution
// 	}

// 	try {
// 		const data = await client.dofetch2('/hicdata', {
// 			method: 'POST',
// 			body: JSON.stringify(arg)
// 		})
// 		if (data.error) throw `${lead} - ${follow}: ${data.error.error}` //Fix for error message displaying [Object object] instead of error message
// 		if (!data.items || data.items.length == 0) return

// 		self.genomeview.data.push({ items: data.items, lead: lead, follow: follow })
// 		for (const [plead, pfollow, v] of data.items) {
// 			vlst.push(v)
// 		}
// 	} catch (e: any) {
// 		/** Collect all errors from the response and then call self.error() above.
// 		 * This allows errors to appear in a single, expandable div.
// 		 */
// 		self.errList.push(e.message || e)
// 		if (e.stack) console.log(e.stack)
// 	}
// }

// async function colorizeGenomeElements(self: any) {
// 	for (const data of self.genomeview.data) {
// 		const obj = self.genomeview.lead2follow.get(data.lead).get(data.follow)
// 		obj.data = [] as any
// 		obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
// 		if (obj.canvas2) {
// 			obj.ctx2.clearRect(0, 0, obj.canvas2.width, obj.canvas.height)
// 		}

// 		for (const [plead, pfollow, value] of data.items) {
// 			const leadpx = Math.floor(plead / self.genomeview.resolution) * self.genomeview.binpx
// 			const followpx = Math.floor(pfollow / self.genomeview.resolution) * self.genomeview.binpx
// 			obj.data.push([leadpx, followpx, value])
// 			colorizeElement(leadpx, followpx, value, self.genomeview, self, obj)
// 		}
// 		obj.img.attr('xlink:href', obj.canvas.toDataURL())
// 		if (obj.canvas2) {
// 			obj.img2.attr('xlink:href', obj.canvas2.toDataURL())
// 		}
// 	}
// }

// function makewholegenome_sv(hic: any, self: any) {
// 	const unknownchr = new Set()

// 	const radius = 8

// 	for (const item of hic.sv.items) {
// 		const _o = self.genomeview.lead2follow.get(item.chr1)
// 		if (!_o) {
// 			unknownchr.add(item.chr1)
// 			continue
// 		}
// 		const obj = _o.get(item.chr2)
// 		if (!obj) {
// 			unknownchr.add(item.chr2)
// 			continue
// 		}

// 		const p1 = item.position1 / self.genomeview.resolution
// 		const p2 = item.position2 / self.genomeview.resolution
// 		self.genomeview.layer_sv
// 			.append('circle')
// 			.attr('stroke', 'black')
// 			.attr('fill', 'white')
// 			.attr('fill-opacity', 0)
// 			.attr('cx', obj.x + p1)
// 			.attr('cy', obj.y + p2)
// 			.attr('r', radius)
// 			.on('mouseover', (event: MouseEvent) => {
// 				tooltip_sv(event, hic, item)
// 			})
// 			.on('mouseout', () => {
// 				self.dom.tip.hide()
// 			})
// 			.on('click', () => {
// 				click_sv(hic, item)
// 			})

// 		if (obj.img2) {
// 			self.genomeview.layer_sv
// 				.append('circle')
// 				.attr('stroke', 'black')
// 				.attr('fill', 'whilte')
// 				.attr('fill-opacity', 0)
// 				.attr('cy', obj.x + p1)
// 				.attr('cx', obj.y + p2)
// 				.attr('r', radius)
// 				.on('mouseover', (event: MouseEvent) => {
// 					tooltip_sv(event, self, item)
// 				})
// 				.on('mouseout', () => {
// 					self.dom.tip.hide()
// 				})
// 				.on('click', () => {
// 					click_sv(hic, item)
// 				})
// 		}
// 	}
// }

// function tooltip_sv(event: MouseEvent, self: any, item: any): void {
// 	self.dom.tip
// 		.clear()
// 		.show(event.clientX, event.clientY)
// 		.d.append('div')
// 		.text(
// 			item.chr1 == item.chr2
// 				? `${item.chr1}:${item.position1}-${item.position2}`
// 				: `${item.chr1}:${item.position1}>${item.chr2}:${item.position2}`
// 		)
// }

// function click_sv(hic: any, item: any): void {
// 	const pane = client.newpane({ x: 100, y: 100 }) as Partial<Pane>
// 	;(pane.header as Pane['header']).text(
// 		hic.name +
// 			' ' +
// 			(item.chr1 == item.chr2
// 				? `${item.chr1}:${item.position1}-${item.position2}`
// 				: `${item.chr1}:${item.position1}>${item.chr2}:${item.position2}`)
// 	)
// 	const tracks = [
// 		{
// 			type: client.tkt.hicstraw,
// 			file: hic.file,
// 			enzyme: hic.enzyme,
// 			maxpercentage: default_hicstrawmaxvperc,
// 			pyramidup: 1,
// 			name: hic.name
// 		}
// 	]
// 	if (hic.tklst) {
// 		for (const t of hic.tklst) {
// 			tracks.push(t)
// 		}
// 	}
// 	client.first_genetrack_tolist(hic.genome, tracks)
// 	const arg: any = {
// 		holder: pane.body,
// 		hostURL: hic.hostURL,
// 		jwt: hic.jwt,
// 		genome: hic.genome,
// 		nobox: 1,
// 		tklst: tracks
// 	}

// 	if (item.chr1 == item.chr2 && Math.abs(item.position2 - item.position1) < default_svpointspan * 2) {
// 		// two breakends overlap
// 		arg.chr = item.chr1
// 		const w = Math.abs(item.position2 - item.position1)
// 		arg.start = Math.max(1, Math.min(item.position1, item.position2) - w)
// 		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, Math.max(item.position1, item.position2) + w)
// 	} else {
// 		arg.chr = item.chr1
// 		arg.start = Math.max(1, item.position1 - default_svpointspan / 2)
// 		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, item.position1 + default_svpointspan / 2)
// 		arg.width = default_subpanelpxwidth
// 		arg.subpanels = [
// 			{
// 				chr: item.chr2,
// 				start: Math.max(1, item.position2 - default_svpointspan / 2),
// 				stop: Math.min(hic.genome.chrlookup[item.chr2.toUpperCase()].len, item.position2 + default_svpointspan / 2),
// 				width: default_subpanelpxwidth,
// 				leftpad: 10,
// 				leftborder: subpanel_bordercolor
// 			}
// 		]
// 	}
// 	blocklazyload(arg)
// }

//////////////////// __chrpair view__ ////////////////////

function tell_firstisx(hic: any, chrx: string, chry: string) {
	if (chrx == chry) return true
	return hic.chrorder.indexOf(chrx) < hic.chrorder.indexOf(chry)
}

export async function getdata_chrpair(hic: any, self: any) {
	const isintrachr = self.x.chr == self.y.chr
	const firstisx = tell_firstisx(hic, self.x.chr, self.y.chr)

	const resolution = self.chrpairview.resolution
	const binpx = self.chrpairview.binpx
	const ctx = self.chrpairview.ctx

	const arg = {
		matrixType: self.chrpairview.matrixType,
		jwt: hic.jwt,
		file: hic.file,
		url: hic.url,
		pos1: hic.nochr ? self.x.chr.replace('chr', '') : self.x.chr,
		pos2: hic.nochr ? self.y.chr.replace('chr', '') : self.y.chr,
		nmeth: self.chrpairview.nmeth,
		resolution: resolution
	}
	try {
		const data = await client.dofetch2('/hicdata', {
			method: 'POST',
			body: JSON.stringify(arg)
		})
		if (data.error) throw { message: `${self.x.chr} - ${self.y.chr}: ${data.error.error}` } //Fix for message displaying [object object] instead of error message

		ctx.clearRect(0, 0, self.chrpairview.canvas.width, self.chrpairview.canvas.height)

		if (!data.items || data.items.length == 0) {
			// no data
			return
		}

		// const err = 0

		self.chrpairview.isintrachr = isintrachr
		self.chrpairview.data = []

		/*
		a percentile as cutoff for chrpairview
		*/
		const vlst = [] as any

		for (const [coord1, coord2, v] of data.items) {
			vlst.push(v)

			const px1 = Math.floor(coord1 / resolution) * binpx
			const px2 = Math.floor(coord2 / resolution) * binpx
			const x = firstisx ? px1 : px2
			const y = firstisx ? px2 : px1

			self.chrpairview.data.push([x, y, v])
			if (isintrachr) {
				self.chrpairview.data.push([y, x, v])
			}
		}
		await setViewCutoff(vlst, self.chrpairview, self)

		for (const [x, y, v] of self.chrpairview.data) {
			await colorizeElement(x, y, v, self.chrpairview, self, ctx)
		}
	} catch (err: any) {
		self.errList.push(err.message || err)
		if (err.stack) console.log(err.stack)
	}

	if (self.errList.length) self.error(self.errList)
}

/**
 * set normalization method from <select>
 * @param hic
 * @param v view object in self
 * @param init true if called during view init
 * @returns
 */

export function nmeth2select(hic: any, v: any, init?: boolean) {
	const options = hic.nmethselect.node().options
	if (!options) return //When only 'NONE' is available
	let selectedNmeth: any
	if (init) {
		selectedNmeth = Array.from(options).find((o: any) => o.value === hic.nmethselect.node().value)
	} else {
		selectedNmeth = Array.from(options).find((o: any) => o.value === v.nmeth)
	}
	selectedNmeth.selected = true
	v.nmeth = selectedNmeth.value
}

//////////////////// __detail view__ ////////////////////

async function detailViewUpdateRegionFromBlock(hic: any, self: any) {
	self.x = self.detailview.xb.rglst[0]
	self.y = self.detailview.yb.rglst[0]
	await detailViewUpdateHic(hic, self)
}

/**
 * Identifies the selected matrix type from the dropdown and sets it to the view object
 * @param v view object within self (e.g. self.genomeView) Each view object has its own matrixType
 * @param self
 * @param init true if called during view init
 */
export function matrixType2select(v: any, self: any, init?: boolean) {
	const options = self.dom.controlsDiv.matrixType.node().options
	let selectedOption: any
	if (init) {
		selectedOption = Array.from(options).find((o: any) => o.value === self.dom.controlsDiv.matrixType.node().value)
	} else {
		selectedOption = Array.from(options).find((o: any) => o.value === v.matrixType)
	}
	selectedOption.selected = true
	v.matrixType = selectedOption.value
}

/**
 * call when coordinate changes
 * x/y can span different bp width, in different px width
 * calculate resolution, apply the same to both x/y
 * detect if to use bp or fragment resolution
 * @param hic
 * @param self
 * @returns
 */
async function detailViewUpdateHic(hic: any, self: any) {
	self.dom.infoBarDiv.colorScaleLabel.style('display', '')
	self.dom.infoBarDiv.colorScaleDiv.style('display', '')
	const xstart = self.x.start
	const xstop = self.x.stop
	const ystart = self.y.start
	const ystop = self.y.stop

	const maxbpwidth = Math.max(xstop - xstart, ystop - ystart)
	let resolution = null
	for (const res of hic.bpresolution) {
		if (maxbpwidth / res > minimumbinnum_bp) {
			resolution = res
			break
		}
	}

	try {
		/** Format data for x fragment and query server for x data*/
		const xfragment = await getXFragData(hic, resolution, self)
		if (!xfragment) {
			// use bpresolution, not fragment
			self.detailview.resolution = resolution
			self.dom.infoBarDiv.resolution.text(common.bplen(resolution) + ' bp')
			// fixed bin size only for bp bins
			self.detailview.xbinpx = self.detailview.canvas.attr('width') / ((xstop - xstart) / resolution!)
			self.detailview.ybinpx = self.detailview.canvas.attr('height') / ((ystop - ystart) / resolution!)
		} else {
			//got fragment index for x
			if (xfragment.error) throw { message: xfragment.error }
			if (!xfragment.items) throw { message: '.items[] missing for x view range enzyme fragment' }
			const [err, map, start, stop] = hicparsefragdata(xfragment.items)
			if (err) throw { message: err }
			self.detailview.frag.xid2coord = map
			self.detailview.frag.xstartfrag = start
			self.detailview.frag.xstopfrag = stop

			const yfragment = await getYFragData(hic, self)
			if (yfragment) {
				// got fragment index for y
				if (yfragment.error) throw { message: yfragment.error }
				if (!yfragment.items) throw { message: '.items[] missing' }
				const [err, map, start, stop] = hicparsefragdata(yfragment.items)
				if (err) throw { message: err }
				if (self.x.chr == self.y.chr) {
					/*
				intra chr
				frag id to coord mapping goes to same bin for great merit
				*/
					for (const [id, pos] of map) {
						self.detailview.frag.xid2coord.set(id, pos)
					}
					self.detailview.frag.yid2coord = self.detailview.frag.xid2coord
				} else {
					self.detailview.frag.yid2coord = map
				}
				self.detailview.frag.ystartfrag = start
				self.detailview.frag.ystopfrag = stop

				/** x/y fragment range defined
				 * find out resolution
				 */
				const maxfragspan = Math.max(
					self.detailview.frag.xstopfrag - self.detailview.frag.xstartfrag,
					self.detailview.frag.ystopfrag - self.detailview.frag.ystartfrag
				)
				//let resolution: number | null = null
				for (const r of hic.fragresolution) {
					if (maxfragspan / r > minimumbinnum_frag) {
						resolution = r
						break
					}
				}
				if (resolution == null) {
					resolution = hic.fragresolution[hic.fragresolution.length - 1]
				}
				self.dom.infoBarDiv.resolution.text(resolution! > 1 ? resolution + ' fragments' : 'single fragment')
				self.detailview.resolution = resolution
			}
		}
		getdata_detail(hic, self)
	} catch (err: any) {
		self.errList.push(err.message || err)
		if (err.stack) console.log(err.stack)
	}

	if (self.errList.length) self.error(self.errList)
}

async function getXFragData(hic: any, resolution: any, self: any) {
	if (resolution != null) {
		// using bp resolution
		delete self.detailview.frag
		return
	}
	if (!hic.enzyme) {
		// no enzyme available
		resolution = hic.bpresolution[hic.bpresolution.length - 1]
		delete self.detailview.frag
		return
	}

	/*
		convert x/y view range coordinate to enzyme fragment index
		using the span of frag index to figure out resolution (# of fragments)
		*/
	self.detailview.frag = {}

	// query fragment index for x
	const arg = {
		getdata: 1,
		getBED: 1,
		file: hic.enzymefile,
		rglst: [{ chr: self.x.chr, start: self.x.start, stop: self.x.stop }]
	}
	return await getBedData(arg, self)
}

async function getYFragData(hic: any, self: any) {
	const arg = {
		getdata: 1,
		getBED: 1,
		file: hic.enzymefile,
		rglst: [{ chr: self.y.chr, start: self.y.start, stop: self.y.stop }]
	}

	return getBedData(arg, self)
}

async function getBedData(arg: any, self: any) {
	try {
		return await client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
	} catch (e: any) {
		self.errList.push(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

export function getdata_detail(hic: any, self: any) {
	/*
	x/y view range and resolution have all been set
	request hic data and paint canvas
	*/

	const resolution = self.detailview.resolution
	const ctx = self.detailview.ctx
	const chrx = self.x.chr
	const chry = self.y.chr

	const fg = self.detailview.frag

	// genomic coordinates
	const xstart = self.x.start
	const xstop = self.x.stop
	const ystart = self.y.start
	const ystop = self.y.stop

	const par: HicstrawArgs = {
		matrixType: self.detailview.matrixType,
		jwt: hic.jwt,
		file: hic.file,
		url: hic.url,
		pos1:
			(hic.nochr ? chrx.replace('chr', '') : chrx) +
			':' +
			(fg ? fg.xstartfrag + ':' + fg.xstopfrag : xstart + ':' + xstop),
		pos2:
			(hic.nochr ? chry.replace('chr', '') : chry) +
			':' +
			(fg ? fg.ystartfrag + ':' + fg.ystopfrag : ystart + ':' + ystop),
		nmeth: self.detailview.nmeth,
		resolution: resolution
	}

	if (fg) {
		par.isfrag = true
	}

	fetch(
		new Request(hic.hostURL + '/hicdata', {
			method: 'POST',
			body: JSON.stringify(par)
		})
	)
		.then(data => {
			return data.json()
		})
		.then(data => {
			self.detailview.canvas.attr('width', self.detailview.xb.width).attr('height', self.detailview.yb.width)

			const canvaswidth = Number.parseInt(self.detailview.canvas.attr('width'))
			const canvasheight = Number.parseInt(self.detailview.canvas.attr('height'))
			ctx.clearRect(0, 0, canvaswidth, canvasheight)

			// pixel per bp
			const xpxbp = canvaswidth / (xstop - xstart)
			const ypxbp = canvasheight / (ystop - ystart)

			if (data.error) throw { message: data.error.error }
			if (!data.items || data.items.length == 0) {
				return
			}

			let firstisx = false
			const isintrachr = chrx == chry
			if (isintrachr) {
				firstisx = xstart < ystart
			} else {
				firstisx = tell_firstisx(hic, chrx, chry)
				//firstisx = hic.genome.chrlookup[chrx.toUpperCase()].len > hic.genome.chrlookup[chry.toUpperCase()].len
			}

			const lst = [] as number[][]
			let err = 0

			const vlst = [] as number[]
			for (const [n1, n2, v] of data.items) {
				/*
			genomic position and length of either the bin, or the fragment
			*/
				vlst.push(v)

				let coord1, coord2, span1, span2

				if (fg) {
					// the beginning fragment index
					const idx_start = firstisx ? n1 : n2
					const idy_start = firstisx ? n2 : n1

					/*
				convert fragment id to coordinate

				start: start of idx_start
				stop: stop of idx_start + resolution
				*/

					// convert x
					if (fg.xid2coord.has(idx_start)) {
						const [a, b] = fg.xid2coord.get(idx_start)
						coord1 = a
						span1 = b - a // note this likely to be replaced by [idx_start+resolution]
					} else {
						console.log('[x id error] x: ' + idx_start + ' y: ' + idy_start)
						err++
						continue
					}
					{
						// the end of fragment id of x, it may be out of range!
						const id_stop = idx_start + resolution

						if (fg.xid2coord.has(id_stop)) {
							const [a, b] = fg.xid2coord.get(id_stop)
							span1 = b - coord1
						}
					}

					// convert y
					if (fg.yid2coord.has(idy_start)) {
						const [a, b] = fg.yid2coord.get(idy_start)
						coord2 = a
						span2 = b - a
					} else {
						console.log('[y id error] x: ' + idx_start + ' y: ' + idy_start)
						err++
						continue
					}
					{
						// the end of fragment id of x, it may be out of range!
						const id_stop = idy_start + resolution

						if (fg.yid2coord.has(id_stop)) {
							const [a, b] = fg.yid2coord.get(id_stop)
							span2 = b - coord2
						}
					}
				} else {
					/*
				bp bin resolution
				*/

					coord1 = firstisx ? n1 : n2
					coord2 = firstisx ? n2 : n1
					span1 = resolution
					span2 = resolution
				}

				if (isintrachr) {
					if (coord1 > xstart - span1 && coord1 < xstop && coord2 > ystart - span2 && coord2 < ystop) {
						lst.push([
							Math.floor((coord1 - xstart) * xpxbp),
							Math.floor((coord2 - ystart) * ypxbp),
							Math.ceil(span1 * xpxbp),
							Math.ceil(span2 * ypxbp),
							v
						])
					}
					if (coord2 > xstart - span2 && coord2 < xstop && coord1 > ystart && coord1 < ystop) {
						lst.push([
							Math.floor((coord2 - xstart) * xpxbp),
							Math.floor((coord1 - ystart) * ypxbp),
							Math.ceil(span2 * xpxbp),
							Math.ceil(span1 * ypxbp),
							v
						])
					}
					continue
				}

				// inter chr
				lst.push([
					Math.floor((coord1 - xstart) * xpxbp),
					Math.floor((coord2 - ystart) * ypxbp),
					Math.ceil(span1 * xpxbp),
					Math.ceil(span2 * ypxbp),
					v
				])

				// done this line
			}
			// done all lines

			setViewCutoff(vlst, self.detailview, self)

			for (const [x, y, w, h, v] of lst) {
				colorizeElement(x, y, v, self.detailview, self, ctx, w, h)
			}

			self.detailview.data = lst
		})

		.catch(err => {
			self.errList.push(err.message || err)
			if (err.stack) console.log(err.stack)
		})
		.then(() => {
			if (self.errList.length) self.error(self.errList)
			self.detailview.canvas
				.style('left', self.detailview.bbmargin + self.detailview.xb.leftheadw + self.detailview.xb.lpad + 'px')
				.style('top', self.detailview.bbmargin + self.detailview.yb.rightheadw + self.detailview.yb.rpad + 'px')
		})
}

export function hicparsefragdata(items: any) {
	const id2coord = new Map()
	let min: number | null = null,
		max: number | any

	for (const i of items) {
		// id of first fragment
		if (!i.rest || !i.rest[0]) {
			return ['items[].rest data problem']
		}
		const id = Number.parseInt(i.rest[0])
		if (Number.isNaN(id)) {
			return [i.start + '.' + i.stop + ' invalid fragment id: ' + i.rest[0]]
		}
		id2coord.set(id, [i.start, i.stop])
		if (min == null) {
			min = id
			max = id
		} else {
			min = Math.min(min, id)
			max = Math.max(max, id)
		}
	}
	return [null, id2coord, min, max]
}

/******* Utiliy functions
 * Common code shared between views consolidated into function
 * Ideally these will be separated into a rendering function (e.g. setRenderers)
 * Maybe make a view class or component and call as methods -> main view super with sub classes per view
 * Also could invesigate consolidating the hic data fetches into a single function
 */

/** Calculates the cutoff from the server response and sets the view object's bpmaxv
 * @param vlst array of values
 * @param view view object within self (e.g. self.genomeView)
 * @param self
 */
export async function setViewCutoff(vlst: any, view: any, self: any) {
	const sortedVlst = vlst.sort((a: number, b: number) => a - b)
	const maxv = sortedVlst[Math.floor(sortedVlst.length * 0.99)] as number
	view.bpmaxv = maxv
	self.dom.controlsDiv.inputBpMaxv.property('value', view.bpmaxv)

	if (sortedVlst[0] < 0) {
		self.colorScale.bar.startColor = self.colorBar.startColor = 'blue'
		self.colorScale.data = [sortedVlst[0], maxv]
	} else {
		self.colorScale.bar.startColor = self.colorBar.startColor = 'white'
		self.colorScale.data = [0, maxv]
	}

	self.colorScale.updateScale()
}
// /**
//  * Fills the canvas with color based on the value from the straw response
//  * Default color is red for positive values and blue for negative values.
//  * When no negative values are present, no color is displayed (i.e. appears white)
//  * Note the genome view renders two ctx objs, otherwise only one ctx obj is filled in.
//  * @param lead lead chr
//  * @param follow following chr
//  * @param v returned value from straw
//  * @param view either genomeview, chrpairview, or detailview
//  * @param self
//  * @param obj obj to color
//  * @param width if no .binpx for the view, must provied width
//  * @param height if no .binpx for the view, must provied width
//  */
// export async function colorizeElement(
// 	lead: number,
// 	follow: number,
// 	v: number,
// 	view: any,
// 	self: any,
// 	obj: any,
// 	width?: number,
// 	height?: number
// ) {
// 	if (v >= 0) {
// 		// positive or zero, use red
// 		const p = v >= view.bpmaxv ? 0 : Math.floor((255 * (view.bpmaxv - v)) / view.bpmaxv)
// 		const positiveFill = `rgb(255, ${p}, ${p})`
// 		if (self.ingenome == true) {
// 			obj.ctx.fillStyle = positiveFill
// 			obj.ctx2.fillStyle = positiveFill
// 		} else {
// 			/** ctx for the chrpair and detail view */
// 			obj.fillStyle = positiveFill
// 		}
// 	} else {
// 		// negative, use blue
// 		const p = Math.floor((255 * (view.bpmaxv + v)) / view.bpmaxv)
// 		const negativeFill = `rgb(${p}, ${p}, 255)`
// 		if (self.ingenome == true) {
// 			obj.ctx.fillStyle = negativeFill
// 			obj.ctx2.fillStyle = negativeFill
// 		} else {
// 			obj.fillStyle = negativeFill
// 		}
// 	}
// 	const w = width || view.binpx
// 	const h = height || view.binpx

// 	if (self.ingenome == true) {
// 		obj.ctx.fillRect(follow, lead, w, h)
// 		obj.ctx2.fillRect(lead, follow, w, h)
// 	} else {
// 		obj.fillRect(lead, follow, w, h)
// 	}
// }
