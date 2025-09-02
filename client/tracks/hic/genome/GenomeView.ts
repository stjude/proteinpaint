import * as client from '#src/client'
import blocklazyload from '#src/block.lazyload'
import type { MainPlotDiv } from '../../../types/hic.ts'
import type { Pane, SvgSvg, SvgG } from '../../../types/d3'
import { ColorizeElement } from '../dom/ColorizeElement.ts'
import { GridViewModel } from '../viewmodel/GridViewModel.ts'
import { GridRenderer } from '../grid/GridRenderer.ts'
import { GridElementsRenderer } from '../grid/GridElementsRenderer.ts'
import type { GridElementData } from '../grid/GridElementData.ts'
import type { GridElementDom } from '../grid/GridElementDom.ts'
import { GridElementsFormattedData } from '../data/GridElementsFormattedData.ts'

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
		this.svg = this.plotDiv.plot.append('svg').attr('data-testid', 'sjpp-hic-genome-svg')
		this.layer_map = this.svg.append('g').attr('data-testid', 'sjpp-hic-layerMap-g')
		this.layer_sv = this.svg.append('g').attr('data-testid', 'sjpp-hic-layerSv-g')
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

	render() {
		this.viewRender.render()
		this.gridElementsRenderer.render(this.hic.holder)
		if (this.hic.sv && this.hic.sv.items) {
			this.makeSv()
		}

		this.update(this.data)
	}

	update(data) {
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
			obj.data = this.gridFormattedData.formatData('genome', data.items, this.binpx, this.resolution)

			for (const [xPx, yPx, value] of obj.data) {
				this.colorizeElement.colorizeElement(xPx, yPx, value, obj, this.binpx, this.binpx, this.min, this.max, 'genome')
			}

			obj.img.attr('xlink:href', obj.canvas.toDataURL())
			if (obj.canvas2) {
				obj.img2!.attr('xlink:href', obj.canvas2.toDataURL())
			}
		}
		this.app.dispatch({ type: 'loading_active', active: false })
	}
}
