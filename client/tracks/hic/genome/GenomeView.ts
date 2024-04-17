import { select as d3select, Selection } from 'd3-selection'
import * as client from '#src/client'
import blocklazyload from '#src/block.lazyload'
import {
	HicstrawArgs,
	MainPlotDiv,
	HicstrawDom,
	DetailViewAxis,
	// WholeGenomeView,
	// ChrPairView,
	HorizontalView,
	DetailView
} from '../../../types/hic.ts'

import { Div, SvgSvg, SvgG } from '../../../types/d3'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { GridViewModel } from '../viewmodel/GridViewModel.ts'
import { GridRenderer } from '../grid/GridRenderer.ts'
import { GridElementsRenderer } from '../grid/GridElementsRenderer.ts'
import { GridElementData } from '../grid/GridElementData.ts'
import { GridElementDom } from '../grid/GridElementDom.ts'
import { GridElementsFormattedData } from '../data/GridElementsFormattedData.ts'

type Pane = {
	pain: Selection<HTMLDivElement, any, any, any>
	mini: boolean
	header: Selection<HTMLDivElement, any, any, any>
	body: Selection<any, any, any, any>
}

export class GenomeView {
	viewModel: GridViewModel
	viewRender: GridRenderer
	gridElementsRenderer: GridElementsRenderer
	gridFormattedData: GridElementsFormattedData

	/** opts */
	app: any
	hic: any
	plotDiv: MainPlotDiv
	resolution: number
	parent: (prop: string) => string | number
	colorizeElement: any

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
	min = 0
	max = 0

	constructor(opts) {
		this.app = opts.app
		this.hic = opts.hic
		this.plotDiv = opts.plotDiv
		this.data = opts.data
		this.parent = opts.parent
		this.resolution = opts.resolution || opts.hic.bpresolution[0]
		this.svg = this.plotDiv.plot.append('svg')
		this.layer_map = this.svg.append('g')
		this.layer_sv = this.svg.append('g')
		this.colorizeElement = new ColorizeElement()
		this.viewModel = new GridViewModel(opts)
		this.viewRender = new GridRenderer(this.svg, this.layer_map, this.layer_sv, this.viewModel.grid)
		this.gridElementsRenderer = new GridElementsRenderer(this.viewModel.grid, this.layer_map, this.app)
		this.gridFormattedData = new GridElementsFormattedData()
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
		this.viewRender.render()
		this.gridElementsRenderer.render(this.hic.holder)
		if (this.hic.sv && this.hic.sv.items) {
			this.makeSv()
		}

		await this.update(this.data)
	}

	async update(data) {
		this.data = data
		this.min = this.parent('min') as number
		this.max = this.parent('max') as number
		for (const data of this.data) {
			//Fix for when M chr has no data and is removed from hic.chrlst.
			if (!this.hic.chrlst.includes(data.lead) || !this.hic.chrlst.includes(data.follow)) continue
			const obj = this.viewModel.grid.chromosomeMatrix.get(data.lead)!.get(data.follow) as GridElementData &
				GridElementDom
			if (!obj) continue

			obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height)
			if (obj.canvas2) {
				obj.ctx2!.clearRect(0, 0, obj.canvas2.width, obj.canvas.height)
			}
			obj.data = this.gridFormattedData.formatData(data.items, this.binpx, this.resolution)

			for (const [xPx, yPx, value] of obj.data) {
				await this.colorizeElement.colorizeElement(
					xPx,
					yPx,
					value,
					obj,
					this.binpx,
					this.binpx,
					this.min,
					this.max,
					'genome'
				)
			}

			obj.img.attr('xlink:href', obj.canvas.toDataURL())
			if (obj.canvas2) {
				obj.img2!.attr('xlink:href', obj.canvas2.toDataURL())
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
	/** Rendering properities specific to the horizontal (2 chr subpanel pair) view */
	horizontalview: Partial<HorizontalView>
	/** Rendering properities specific to the detail view */
	detailview: Partial<DetailView>
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
		this.x = {}
		this.y = {}
	}

	async init_detailView(hic: any, chrx: string, chry: string, x: number, y: number) {
		// this.dom.controlsDiv.view.text('Detailed')
		//nmeth2select(hic, this.detailview, true)
		//matrixType2select(this.detailview, this, true)

		// this.ingenome = false
		// this.inchrpair = false
		// this.indetail = true
		// this.inhorizontal = false

		// const isintrachr = chrx == chry
		//showBtns(this)

		//if (!this.x.start || !this.x.stop || !this.y.start || !this.y.stop) this.set_Positions(hic, chrx, chry, x, y)

		// // default view span
		// const viewrangebpw = this.chrpairview.resolution! * initialbinnum_detail

		//let resolution: number | null = null
		// for (const res of hic.bpresolution) {
		// 	if (viewrangebpw / res > minimumbinnum_bp) {
		// 		resolution = res
		// 		break
		// 	}
		// }
		// if (resolution == null) {
		// 	// use finest
		// 	resolution = hic.bpresolution[hic.bpresolution.length - 1]
		// }
		// let binpx = 2
		// while ((binpx * viewrangebpw) / resolution! < mincanvassize_detail) {
		// 	binpx += 2
		// }

		// px width of x and y blocks
		// const blockwidth = Math.ceil((binpx * viewrangebpw) / resolution!)
		const blockwidth = 500
		this.detailview.xb!.width = blockwidth
		this.detailview.yb!.width = blockwidth

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
	}

	async init_horizontalView(hic: any, chrx: string, chry: string, x: number, y: number) {
		//if (!this.x.start || !this.x.stop || !this.y.start || !this.y.stop) this.set_Positions(hic, chrx, chry, x, y)

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

		// this.dom.infoBarDiv.colorScaleDiv.style('display', 'none')
		// this.dom.infoBarDiv.colorScaleLabel.style('display', 'none')
	}
}

//////////////////// __detail view__ ////////////////////

async function detailViewUpdateRegionFromBlock(hic: any, self: any) {
	self.x = self.detailview.xb.rglst[0]
	self.y = self.detailview.yb.rglst[0]
	await detailViewUpdateHic(hic, self)
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
			// self.dom.infoBarDiv.resolution.text(common.bplen(resolution) + ' bp')
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

function getdata_detail(hic: any, self: any) {
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
				//firstisx = tell_firstisx(hic, chrx, chry)
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

			// setViewCutoff(vlst, self.detailview, self)

			for (const [x, y, w, h, v] of lst) {
				//colorizeElement(x, y, v, self.detailview, self, ctx, w, h)
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
