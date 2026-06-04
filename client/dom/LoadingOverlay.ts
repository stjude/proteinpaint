import type { Div } from '../types/d3.d.ts'

export class DivWithLoadingOverlay {
	baseDiv: Div
	overlay: Div

	constructor(div: Div) {
		if (!div.style('position')) div.style('position', 'relative')
		this.baseDiv = div.append('div')
		this.overlay = div.append('div').style('height', '100%').style('width', '100%')
		this.overlay.append('div').attr('class', 'sjpp-spinner').style('display', 'none').style('position', 'absolute')
		//.style('top', '49%')
		//.style('left', '49%')
	}
}
