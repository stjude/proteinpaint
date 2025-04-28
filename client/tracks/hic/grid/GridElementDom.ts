import type { Selection } from 'd3-selection'

export interface GridElementDom {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	img: Selection<HTMLImageElement, any, any, any>
	canvas2?: HTMLCanvasElement
	ctx2?: CanvasRenderingContext2D
	img2?: Selection<HTMLImageElement, any, any, any>
}
