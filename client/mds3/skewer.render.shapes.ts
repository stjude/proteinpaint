import { Elem } from '../types/d3'

export function renderSkewerShapes(tk: any, skewer: any, shapeG: Elem, modefold: number) {
	const shapePath = shapeG
		.append('path')
		.attr('d', d => skewer.shape[1].calculatePath(getPathDimensions(skewer.shape[0], d)))
		.attr('fill', skewer.shape[1].isFilled ? d => tk.color4disc(d.mlst[0]) : 'white')
		.attr('stroke', skewer.shape[1].isFilled ? 'white' : d => tk.color4disc(d.mlst[0]))
}

function getPathDimensions(key: string, d: any) {
	//Add more shapes here using the key from #dom/shapes.js
	switch (key) {
		case 'emptyVerticalRectangle':
			return { width: d.radius * 1.4, height: d.radius * 2 }
		case 'emptyTriangle':
			return { width: d.radius * 1.75, height: d.radius * 1.75 }
		case 'filledSquare':
			return { width: d.radius * 1.7, height: d.radius * 1.7 }
		case 'emptySquare':
			return { width: d.radius * 1.7, height: d.radius * 1.7 }
		default:
			'Invalid shape key'
	}
}
