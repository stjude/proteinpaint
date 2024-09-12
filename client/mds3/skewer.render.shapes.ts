import { Elem } from '../types/d3'

export function renderSkewerShapes(tk: any, skewer: any, shapeG: Elem, modefold: number) {
	const shapePath = shapeG
		.append('path')
		.attr('d', d => skewer.shape[1].calculatePath(getPathDimensions(skewer.shape[0], d)))
		.attr('fill', skewer.shape[1].isFilled ? d => tk.color4disc(d.mlst[0]) : 'white')
		.attr('stroke', d => tk.color4disc(d.mlst[0]))
}

function getPathDimensions(key: string, d: any) {
	//Add more shapes here using the key from #dom/shapes.js
	switch (key) {
		case 'emptyVerticalRectangle':
			return { width: d.radius * 1.4, height: d.radius * 2 }
		default:
			'Invalid shape key'
	}
}
