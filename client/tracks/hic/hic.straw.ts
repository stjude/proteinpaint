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
} from '../../types/hic.ts'
import { showErrorsWithCounter } from '../../dom/sayerror'
import { hicParseFile } from './parse.genome.ts'
import { initWholeGenomeControls } from './controls.whole.genome.ts'
import { Div } from '../../types/d3'

/*

********************** EXPORTED

init_hicstraw()
getdata_leadfollow()
getdata_chrpair()
nmeth2select()
getdata_detail()
hicparsefragdata()

********************** INTERNAL

initialize views

	init_wholeGenomeView()
		.wholegenome

	init_chrPairView()
		.chrpairview

	init_horizontalView()
		.horizontalview

	init_detailView()
		.detailview


hic data getter and canvas painter

	getdata_leadfollow()
	getdata_chrpair()
	getdata_detail()



JumpTo:  __detail  __whole


hic.atdev controls dev-shortings

*/

/** Default normalization method if none returned from the server. Exported to parsing and controls script*/
export const defaultnmeth = 'NONE'

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
 */
class Hicstat {
	holder: Div
	debugmode: boolean
	dom: HicstrawDom
	/** Collection of error messages. Appears to the user in bulk when self.error() fires. */
	errList: string[]
	/** TODO: fix this Partial business. */
	/** Rendering properities specific to the whole genome view */
	wholegenome: Partial<WholeGenomeView>
	/** Rendering properities specific to the chr-chr pair view */
	chrpairview: Partial<ChrPairView>
	/** Rendering properities specific to the horizontal (2 chr subpanel pair) view */
	horizontalview: Partial<HorizontalView>
	/** Rendering properities specific to the detail view */
	detailview: Partial<DetailView>
	/** following are flags for which view is displayed to switch between views.
	 * See the view names above
	 */
	inwholegenome: boolean
	inchrpair: boolean
	indetail: boolean
	inhorizontal: boolean
	/** Required position attributes for every view except for the whole genome view. Only chr pair does not need start or stop. */
	chrx: Partial<{
		chr: string
		start: number
		stop: number
	}>
	chry: Partial<{
		chr: string
		start: number
		stop: number
	}>

	constructor(hic: any, debugmode: boolean) {
		this.holder = hic.holder
		this.debugmode = debugmode
		this.dom = {
			errorDiv: hic.holder.append('div').classed('sjpp-hic-error', true),
			controlsDiv: hic.holder.append('div').classed('sjpp-hic-controls', true).style('display', 'inline-block'),
			plotDiv: hic.holder.append('div').classed('sjpp-hic-main', true).style('display', 'inline-block'),
			tip: new client.Menu()
		}
		this.errList = []
		this.wholegenome = {
			matrixType: 'observed',
			binpx: 1,
			/** wholegenome is fixed to use lowest bp resolution, and fixed cutoff value for coloring*/
			bpmaxv: 5000,
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
		this.inwholegenome = true
		this.inchrpair = false
		this.inhorizontal = false
		this.indetail = false
		this.chrx = {}
		this.chry = {}
	}

	async error(err: string | string[]) {
		if (err && typeof err == 'string') this.errList.push(err)
		showErrorsWithCounter(this.errList, this.dom.errorDiv)
		//Remove errors after displaying
		this.errList = []
	}

	async render(hic: any) {
		await hicParseFile(hic, this.debugmode, this)
		initWholeGenomeControls(hic, this)
		this.dom.plotDiv.append('table').classed('sjpp-hic-plot-main', true)
		const tr1 = this.dom.plotDiv.append('tr')
		const tr2 = this.dom.plotDiv.append('tr')
		this.dom.plotDiv = {
			//old c
			plot: tr1.append('td').classed('sjpp-hic-plot', true),
			//old y
			yAxis: tr1.append('td').classed('sjpp-hic-plot-xaxis', true),
			//old x
			xAxis: tr2.append('td').classed('sjpp-hic-plot-yaxis', true),
			//placeholder
			blank: tr2.append('td')
		} as MainPlotDiv

		/** Open the whole genome view by default. User clicks within squares to launch the other views. */
		await this.init_wholeGenomeView(hic)
	}

	async init_wholeGenomeView(hic: any) {
		this.dom.controlsDiv.view.text('Genome')
		const resolution = hic.bpresolution[0]

		this.dom.controlsDiv.resolution.text(common.bplen(resolution) + ' bp')

		// # pixel per bin, may set according to resolution
		const binpx = 1

		// for each chr, a row as canvas container
		this.wholegenome.svg = this.dom.plotDiv.plot.append('svg')
		this.wholegenome.resolution = resolution

		const fontsize = 15 // chr labels
		const borderwidth = 1
		const spacecolor = '#ccc'

		// heatmap layer underneath sv
		const layer_map = this.wholegenome.svg
			.append('g')
			.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
		this.wholegenome.layer_map = layer_map
		const layer_sv = this.wholegenome.svg
			.append('g')
			.attr('transform', 'translate(' + hardcode_wholegenomechrlabwidth + ',' + fontsize + ')')
		this.wholegenome.layer_sv = layer_sv

		let checker_row = true

		const chr2px = {} // px width for each chr
		let totalpx = hic.chrlst.length
		for (const chr of hic.chrlst) {
			const w = Math.ceil(hic.genome.chrlookup[chr.toUpperCase()].len / resolution) * binpx
			chr2px[chr] = w
			totalpx += w
		}
		const checker_fill = '#DEF3FA'

		let xoff = 0
		// column labels
		for (const chr of hic.chrlst) {
			const chrw = chr2px[chr]
			if (checker_row) {
				layer_map
					.append('rect')
					.attr('x', xoff)
					.attr('width', chrw)
					.attr('height', fontsize)
					.attr('y', -fontsize)
					.attr('fill', checker_fill)
			}
			checker_row = !checker_row
			layer_map
				.append('text')
				.attr('font-family', client.font)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.attr('x', xoff + chrw / 2)
				.text(chr)

			xoff += chrw
			layer_sv
				.append('line')
				.attr('x1', xoff)
				.attr('x2', xoff)
				.attr('y2', totalpx)
				.attr('stroke', spacecolor)
				.attr('shape-rendering', 'crispEdges')

			xoff += borderwidth
		}

		let yoff = 0
		checker_row = true

		// row labels
		for (const chr of hic.chrlst!) {
			const chrh = chr2px[chr]
			if (checker_row) {
				layer_map
					.append('rect')
					.attr('x', -hardcode_wholegenomechrlabwidth)
					.attr('width', hardcode_wholegenomechrlabwidth)
					.attr('height', chrh)
					.attr('y', yoff)
					.attr('fill', checker_fill)
			}
			checker_row = !checker_row
			layer_map
				.append('text')
				.attr('font-family', client.font)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('font-size', 12)
				.attr('y', yoff + chrh / 2)
				.text(chr)

			yoff += chrh
			layer_sv
				.append('line')
				.attr('x2', totalpx)
				.attr('y1', yoff)
				.attr('y2', yoff)
				.attr('stroke', spacecolor)
				.attr('shape-rendering', 'crispEdges')

			yoff += borderwidth
		}

		const manychr = hic.atdev ? atdev_chrnum : hic.chrlst.length

		xoff = 0

		for (let i = 0; i < manychr; i++) {
			const lead = hic.chrlst[i]
			this.wholegenome!.lead2follow!.set(lead, new Map())

			yoff = 0

			for (let j = 0; j <= i; j++) {
				const follow = hic.chrlst[j]
				this.wholegenome!.lead2follow!.get(lead)!.set(follow, {
					x: xoff,
					y: yoff
				})
				makewholegenome_chrleadfollow(hic, lead, follow, this)
				yoff += chr2px[follow] + borderwidth
			}
			xoff += chr2px[lead] + borderwidth
		}

		if (hic.sv && hic.sv.items) {
			makewholegenome_sv(hic, this)
		}

		this.wholegenome.svg.attr('width', hardcode_wholegenomechrlabwidth + xoff).attr('height', fontsize + yoff)

		/* after the ui is created, load data for each chr pair,
		await on each request to finish to avoid server lockup
	
		There might be data inconsistency with hic file. It may be missing data for chromosomes that are present in the header; querying such chr will result in error being thrown
		do not flood ui with such errors, to tolerate, collect all errors and show in one place
		*/
		for (let i = 0; i < manychr; i++) {
			const lead = hic.chrlst[i]
			for (let j = 0; j <= i; j++) {
				const follow = hic.chrlst[j]
				try {
					await getdata_leadfollow(hic, lead, follow, this)
				} catch (e: any) {
					this.errList.push(e.message || e)
				}
			}
		}
		if (this.errList.length) this.error(this.errList)

		return
	}

	async init_chrPairView(hic: any, chrx: string, chry: string) {
		this.dom.controlsDiv.view.text(`${chrx}-${chry} Pair`)
		const horizontalView = this.init_horizontalView.bind(this)
		nmeth2select(hic, this.chrpairview)
		matrixType2select(this.chrpairview, this)

		this.inwholegenome = false
		this.inchrpair = true
		this.inhorizontal = false
		this.indetail = false

		showBtns(this)
		this.wholegenome.svg!.remove()

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
		this.dom.controlsDiv.resolution.text(common.bplen(resolution) + ' bp')

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
			this.chrpairview.axisy = svg
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
			this.chrpairview.axisx = svg
		}

		this.chrpairview.resolution = resolution
		this.chrpairview.binpx = binpx

		const canvas = this.dom.plotDiv.plot
			.append('canvas')
			.style('margin', axispad + 'px')
			.on('click', async function (this: any, event: MouseEvent) {
				const [x, y] = pointer(event, this)
				await horizontalView(hic, chrx, chry, x, y)
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
		this.chrx.chr = chrx
		this.chry.chr = chry

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

			;(this.chrx.start = coordx), (this.chrx.stop = coordx + viewrangebpw)
			this.chry.start = coordy
			this.chry.stop = coordy + viewrangebpw
		}
	}

	async init_horizontalView(hic: any, chrx: string, chry: string, x: number, y: number) {
		this.dom.controlsDiv.view.text('Horizontal')
		nmeth2select(hic, this.horizontalview)
		matrixType2select(this.horizontalview, this)

		//Clear elements created in chr pair view
		this.chrpairview.axisy.remove()
		this.chrpairview.axisx.remove()
		this.dom.plotDiv.plot.selectAll('*').remove()

		this.inwholegenome = false
		this.inchrpair = false
		this.inhorizontal = true
		this.indetail = false

		showBtns(this)

		if (!this.chrx.start || !this.chrx.stop || !this.chry.start || !this.chry.stop)
			this.set_Positions(hic, chrx, chry, x, y)

		const regionx = { chr: this.chrx.chr, start: this.chrx.start, stop: this.chrx.stop }
		const regiony = { chr: this.chry.chr, start: this.chry.start, stop: this.chry.stop }

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
	}

	async init_detailView(hic: any, chrx: string, chry: string, x: number, y: number) {
		this.dom.controlsDiv.view.text('Detailed')
		nmeth2select(hic, this.detailview)
		matrixType2select(this.detailview, this)

		this.inwholegenome = false
		this.inchrpair = false
		this.inhorizontal = false
		this.indetail = true

		// const isintrachr = chrx == chry
		showBtns(this)

		if (!this.chrx.start || !this.chrx.stop || !this.chry.start || !this.chry.stop)
			this.set_Positions(hic, chrx, chry, x, y)

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

		this.chrpairview.axisy.remove()
		this.chrpairview.axisx.remove()
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
		arg.chr = this.chrx.chr
		arg.start = this.chrx.start
		arg.stop = this.chrx.stop
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

		arg2.chr = this.chry.chr
		arg2.start = this.chry.start
		arg2.stop = this.chry.stop
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

export async function init_hicstraw(hic: HicstrawInput, debugmode: boolean) {
	const hicstat = new Hicstat(hic, debugmode)
	await hicstat.render(hic)
	if (debugmode) {
		return hicstat.debug()
	}
}

export function showBtns(self: any) {
	//Show in any other view except whole genome
	self.dom.controlsDiv.genomeViewBtn.style('display', self.inwholegenome ? 'none' : 'inline-block')

	if (self.inhorizontal) {
		//Only show chrpairViewBtn if in horizonal or detail view
		//Include chr x and chr y in the button text
		self.dom.controlsDiv.chrpairViewBtn
			.html(`&#8810; Entire ${self.chrx.chr}-${self.chry.chr}`)
			.style('display', 'block')
		//Only show detailViewBtn in horizontal view
		self.dom.controlsDiv.detailViewBtn.style('display', 'block')
		//Hide if horizontal and zoom btns if previously displayed
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.zoomDiv.style('display', 'none')
	} else if (self.indetail) {
		self.dom.controlsDiv.chrpairViewBtn
			.html(`&#8810; Entire ${self.chrx.chr}-${self.chry.chr}`)
			.style('display', 'block')
		//Only show horizontalViewBtn and zoom buttons in detail view
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'block')
		self.dom.controlsDiv.zoomDiv.style('display', 'contents')
		//Hide previously shown detail view btn
		self.dom.controlsDiv.detailViewBtn.style('display', 'none')
	} else {
		self.dom.controlsDiv.chrpairViewBtn.style('display', 'none')
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.detailViewBtn.style('display', 'none')
		self.dom.controlsDiv.zoomDiv.style('display', 'none')
	}
}

//////////////////// __whole genome view__ ////////////////////

function makewholegenome_chrleadfollow(hic: any, lead: any, follow: any, self: any) {
	const binpx = self.wholegenome.binpx
	const obj = self.wholegenome.lead2follow.get(lead).get(follow)

	const leadchrlen = hic.genome.chrlookup[lead.toUpperCase()].len
	const followchrlen = hic.genome.chrlookup[follow.toUpperCase()].len

	const xbins = Math.ceil(leadchrlen / self.wholegenome.resolution)
	const ybins = Math.ceil(followchrlen / self.wholegenome.resolution)

	obj.canvas = hic.holder.append('canvas').style('display', 'none').node()

	obj.ctx = obj.canvas.getContext('2d')

	obj.canvas.width = xbins * binpx
	obj.canvas.height = ybins * binpx

	obj.img = self.wholegenome.layer_map
		.append('image')
		.attr('width', obj.canvas.width)
		.attr('height', obj.canvas.height)
		.attr('x', obj.x)
		.attr('y', obj.y)
		.on('click', async () => {
			self.chrx.chr = lead
			self.chry.chr = follow
			await self.init_chrPairView(hic, lead, follow, self)
		})
		.on('mouseover', () => {
			chrpair_mouseover(self, obj.img, lead, follow)
		})

	if (lead != follow) {
		obj.canvas2 = hic.holder.append('canvas').style('display', 'none').node()

		obj.ctx2 = obj.canvas2.getContext('2d')

		obj.canvas2.width = ybins * binpx
		obj.canvas2.height = xbins * binpx

		obj.img2 = self.wholegenome.layer_map
			.append('image')
			.attr('width', obj.canvas2.width)
			.attr('height', obj.canvas2.height)
			.attr('x', obj.y)
			.attr('y', obj.x)
			.on('click', async () => {
				await self.init_chrPairView(hic, follow, lead, self)
			})
			.on('mouseover', () => {
				chrpair_mouseover(self, obj.img2, follow, lead)
			})
	} else {
		obj.ctx2 = obj.ctx
	}
}

function chrpair_mouseover(self: any, img: any, x_chr: string, y_chr: string) {
	const p = img.node().getBoundingClientRect()
	self.wholegenome.pica_x
		.clear()
		.show(p.left, p.top)
		.d.style('top', null)
		.style('bottom', window.innerHeight - p.top - window.pageYOffset + 'px')
		.text(x_chr)
	self.wholegenome.pica_y
		.clear()
		.show(p.left, p.top)
		.d.style('left', null)
		.style('right', document.body.clientWidth - p.left - window.pageXOffset + 'px') // no scrollbar width
		.text(y_chr)
}

export async function getdata_leadfollow(hic: any, lead: any, follow: any, self: any) {
	const binpx = self.wholegenome.binpx
	const resolution = self.wholegenome.resolution
	const obj = self.wholegenome.lead2follow.get(lead).get(follow)
	obj.data = []
	obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
	if (obj.canvas2) {
		obj.ctx2.clearRect(0, 0, obj.canvas2.width, obj.canvas.height)
	}

	const arg = {
		matrixType: self.wholegenome.matrixType,
		file: hic.file,
		url: hic.url,
		pos1: hic.nochr ? lead.replace('chr', '') : lead,
		pos2: hic.nochr ? follow.replace('chr', '') : follow,
		nmeth: self.wholegenome.nmeth,
		resolution: resolution
	}

	try {
		const data = await client.dofetch2('/hicdata', {
			method: 'POST',
			body: JSON.stringify(arg)
		})
		if (data.error) throw lead + ' - ' + follow + ': ' + data.error.error //Fix for error message displaying [Object object] instead of error message
		if (!data.items || data.items.length == 0) {
			return
		}
		for (const [plead, pfollow, v] of data.items) {
			const leadpx = Math.floor(plead / resolution) * binpx
			const followpx = Math.floor(pfollow / resolution) * binpx

			obj.data.push([leadpx, followpx, v])

			const p =
				v >= self.wholegenome.bpmaxv ? 0 : Math.floor((255 * (self.wholegenome.bpmaxv - v)) / self.wholegenome.bpmaxv)
			obj.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			obj.ctx.fillRect(followpx, leadpx, binpx, binpx)
			obj.ctx2.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			obj.ctx2.fillRect(leadpx, followpx, binpx, binpx)
		}
		obj.img.attr('xlink:href', obj.canvas.toDataURL())
		if (obj.canvas2) {
			obj.img2.attr('xlink:href', obj.canvas2.toDataURL())
		}
	} catch (e: any) {
		self.errList.push(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

function makewholegenome_sv(hic: any, self: any) {
	const unknownchr = new Set()

	const radius = 8

	for (const item of hic.sv.items) {
		const _o = self.wholegenome.lead2follow.get(item.chr1)
		if (!_o) {
			unknownchr.add(item.chr1)
			continue
		}
		const obj = _o.get(item.chr2)
		if (!obj) {
			unknownchr.add(item.chr2)
			continue
		}

		const p1 = item.position1 / self.wholegenome.resolution
		const p2 = item.position2 / self.wholegenome.resolution
		self.wholegenome.layer_sv
			.append('circle')
			.attr('stroke', 'black')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('cx', obj.x + p1)
			.attr('cy', obj.y + p2)
			.attr('r', radius)
			.on('mouseover', (event: MouseEvent) => {
				tooltip_sv(event, hic, item)
			})
			.on('mouseout', () => {
				self.dom.tip.hide()
			})
			.on('click', () => {
				click_sv(hic, item)
			})

		if (obj.img2) {
			self.wholegenome.layer_sv
				.append('circle')
				.attr('stroke', 'black')
				.attr('fill', 'whilte')
				.attr('fill-opacity', 0)
				.attr('cy', obj.x + p1)
				.attr('cx', obj.y + p2)
				.attr('r', radius)
				.on('mouseover', (event: MouseEvent) => {
					tooltip_sv(event, self, item)
				})
				.on('mouseout', () => {
					self.dom.tip.hide()
				})
				.on('click', () => {
					click_sv(hic, item)
				})
		}
	}
}

function tooltip_sv(event: MouseEvent, self: any, item: any): void {
	self.dom.tip
		.clear()
		.show(event.clientX, event.clientY)
		.d.append('div')
		.text(
			item.chr1 == item.chr2
				? item.chr1 + ' : ' + item.position1 + ' - ' + item.position2
				: item.chr1 + ':' + item.position1 + ' > ' + item.chr2 + ':' + item.position2
		)
}

function click_sv(hic: any, item: any): void {
	const pane = client.newpane({ x: 100, y: 100 }) as Partial<Pane>
	;(pane.header as Pane['header']).text(
		hic.name +
			' ' +
			(item.chr1 == item.chr2
				? item.chr1 + ':' + item.position1 + '-' + item.position2
				: item.chr1 + ':' + item.position1 + ' > ' + item.chr2 + ':' + item.position2)
	)
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
		holder: pane.body,
		hostURL: hic.hostURL,
		jwt: hic.jwt,
		genome: hic.genome,
		nobox: 1,
		tklst: tracks
	}

	if (item.chr1 == item.chr2 && Math.abs(item.position2 - item.position1) < default_svpointspan * 2) {
		// two breakends overlap
		arg.chr = item.chr1
		const w = Math.abs(item.position2 - item.position1)
		arg.start = Math.max(1, Math.min(item.position1, item.position2) - w)
		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, Math.max(item.position1, item.position2) + w)
	} else {
		arg.chr = item.chr1
		arg.start = Math.max(1, item.position1 - default_svpointspan / 2)
		arg.stop = Math.min(hic.genome.chrlookup[item.chr1.toUpperCase()].len, item.position1 + default_svpointspan / 2)
		arg.width = default_subpanelpxwidth
		arg.subpanels = [
			{
				chr: item.chr2,
				start: Math.max(1, item.position2 - default_svpointspan / 2),
				stop: Math.min(hic.genome.chrlookup[item.chr2.toUpperCase()].len, item.position2 + default_svpointspan / 2),
				width: default_subpanelpxwidth,
				leftpad: 10,
				leftborder: subpanel_bordercolor
			}
		]
	}
	blocklazyload(arg)
}

//////////////////// __chrpair view__ ////////////////////

function tell_firstisx(hic: any, chrx: string, chry: string) {
	if (chrx == chry) return true
	return hic.chrorder.indexOf(chrx) < hic.chrorder.indexOf(chry)
}

export async function getdata_chrpair(hic: any, self: any) {
	const chrx = self.chrx.chr
	const chry = self.chry.chr
	const isintrachr = chrx == chry
	// const chrxlen = hic.genome.chrlookup[chrx.toUpperCase()].len
	// const chrylen = hic.genome.chrlookup[chry.toUpperCase()].len
	const firstisx = tell_firstisx(hic, chrx, chry)

	const resolution = self.chrpairview.resolution
	const binpx = self.chrpairview.binpx
	const ctx = self.chrpairview.ctx

	const arg = {
		matrixType: self.chrpairview.matrixType,
		jwt: hic.jwt,
		file: hic.file,
		url: hic.url,
		pos1: hic.nochr ? chrx.replace('chr', '') : chrx,
		pos2: hic.nochr ? chry.replace('chr', '') : chry,
		nmeth: self.chrpairview.nmeth,
		resolution: resolution
	}
	try {
		const data = await client.dofetch2('/hicdata', {
			method: 'POST',
			body: JSON.stringify(arg)
		})
		if (data.error) throw { message: chrx + ' - ' + chry + ': ' + data.error.error } //Fix for message displaying [object object] instead of error message

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
		const maxv = vlst.sort((a: number, b: number) => a - b)[Math.floor(vlst.length * 0.99)] as number
		self.chrpairview.bpmaxv = maxv
		self.dom.controlsDiv.inputBpMaxv.property('value', maxv)

		for (const [x, y, v] of self.chrpairview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			ctx.fillRect(x, y, binpx, binpx)
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
 * @param v view object
 * @returns
 */

export function nmeth2select(hic: any, v: any) {
	const options = hic.nmethselect.node().options
	if (!options) return //When only 'NONE' is available
	const selectedNmeth = Array.from(options).find((o: any) => o.value === hic.nmethselect.node().value) as any
	selectedNmeth.selected = true
	v.nmeth = selectedNmeth.value
}

//////////////////// __detail view__ ////////////////////

async function detailViewUpdateRegionFromBlock(hic: any, self: any) {
	self.chrx = self.detailview.xb.rglst[0]
	self.chry = self.detailview.yb.rglst[0]
	await detailViewUpdateHic(hic, self)
}

/** */
export function matrixType2select(v: any, self: any) {
	const options = self.dom.controlsDiv.matrixType.node().options
	const selectedOption = Array.from(options).find(
		(o: any) => o.value === self.dom.controlsDiv.matrixType.node().value
	) as any
	selectedOption.selected = true
	v.matrixType = selectedOption.value // Return the selected option value
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
	const chrx = (self.detailview.chrx = self.chrx.chr)
	const chry = (self.detailview.chry = self.chry.chr)
	const xstart = (self.detailview.xstart = self.chrx.start)
	const xstop = (self.detailview.xstop = self.chrx.stop)
	const ystart = (self.detailview.ystart = self.chry.start)
	const ystop = (self.detailview.ystop = self.chry.stop)

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
		const xfragment = await getXFragData(hic, resolution, chrx, xstart, xstop, self)
		if (!xfragment) {
			// use bpresolution, not fragment
			self.detailview.resolution = resolution
			self.dom.controlsDiv.resolution.text(common.bplen(resolution) + ' bp')
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

			const yfragment = await getYFragData(hic, chry, ystart, ystop)
			if (yfragment) {
				// got fragment index for y
				if (yfragment.error) throw { message: yfragment.error }
				if (!yfragment.items) throw { message: '.items[] missing' }
				const [err, map, start, stop] = hicparsefragdata(yfragment.items)
				if (err) throw { message: err }
				if (chrx == chry) {
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
				self.dom.controlsDiv.resolution.text(resolution! > 1 ? resolution + ' fragments' : 'single fragment')
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

async function getXFragData(hic: any, resolution: any, chrx: string, xstart: number, xstop: number, self: any) {
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
		rglst: [{ chr: chrx, start: xstart, stop: xstop }]
	}
	return await getBedData(arg, self)
}

async function getYFragData(hic: any, chry: string, ystart: number, ystop: number) {
	const arg = {
		getdata: 1,
		getBED: 1,
		file: hic.enzymefile,
		rglst: [{ chr: chry, start: ystart, stop: ystop }]
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
	const chrx = self.detailview.chrx
	const chry = self.detailview.chry

	const fg = self.detailview.frag

	// genomic coordinates
	const xstart = self.detailview.xstart
	const xstop = self.detailview.xstop
	const ystart = self.detailview.ystart
	const ystop = self.detailview.ystop

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

			const lst: any = []
			let err = 0
			let maxv = 0

			for (const [n1, n2, v] of data.items) {
				/*
			genomic position and length of either the bin, or the fragment
			*/
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

				maxv = Math.max(v, maxv)

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

			maxv *= 0.8

			self.detailview.bpmaxv = maxv
			self.dom.controlsDiv.inputBpMaxv.property('value', maxv)

			for (const [x, y, w, h, v] of lst) {
				const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
				ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'

				ctx.fillRect(x, y, w, h)
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
	console.log(items)
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
