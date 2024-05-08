import { SvgG } from 'types/d3'
import { ChrsTooltips } from '../genome/ChrsTooltips'
import { Selection } from 'd3-selection'

export class GridElementRenderer {
	private layerMap: SvgG
	private app: any
	private tooltips: ChrsTooltips

	constructor(layerMap: SvgG, app: any) {
		this.app = app
		this.layerMap = layerMap
		this.tooltips = new ChrsTooltips()
	}

	render(obj: any, lead: string, follow: string, holder: any) {
		obj.canvas = holder.append('canvas').style('display', 'none').node() as Selection<HTMLCanvasElement, any, any, any>
		obj.ctx = (obj.canvas as HTMLCanvasElement).getContext('2d')

		obj.canvas.width = obj.xbins
		obj.canvas.height = obj.ybins

		obj.img = this.layerMap
			.append('image')
			.attr('width', obj.canvas.width)
			.attr('height', obj.canvas.height)
			.attr('x', obj.x)
			.attr('y', obj.y)
			.on('click', async () => {
				//maybe pass as a callback instead of passing app for dispatch?
				await this.app.dispatch({
					type: 'view_create',
					view: 'chrpair',
					config: {
						x: {
							chr: lead
						},
						y: {
							chr: follow
						}
					}
				})
			})
			.on('mouseover', () => {
				this.tooltips.render(obj.img, lead, follow)
			})

		if (lead != follow) {
			obj.canvas2 = holder.append('canvas').style('display', 'none').node() as Selection<
				HTMLCanvasElement,
				any,
				any,
				any
			>

			obj.canvas2.width = obj.ybins
			obj.canvas2.height = obj.xbins

			obj.ctx2 = (obj.canvas2 as HTMLCanvasElement).getContext('2d')

			obj.img2 = this.layerMap
				.append('image')
				.attr('width', obj.canvas2.width)
				.attr('height', obj.canvas2.height)
				.attr('x', obj.y)
				.attr('y', obj.x)
				.on('click', async () => {
					await this.app.dispatch({
						type: 'view_create',
						view: 'chrpair',
						config: {
							x: {
								chr: follow
							},
							y: {
								chr: lead
							}
						}
					})
				})
				.on('mouseover', () => {
					this.tooltips.render(obj.img2, follow, lead)
				})
		} else {
			obj.ctx2 = obj.ctx
		}
	}
}
