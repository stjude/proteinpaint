import { Elem } from '../types/d3'

export function renderSkewerShapes(tk: any, skewer: any, shapeG: Elem) {
	shapeG
		.append('path')
		.attr('d', d => skewer.shape[1].calculatePath(getPathDimensions(skewer.shape[0], d)))
		.attr('fill', skewer.shape[1].isFilled ? d => tk.color4disc(d.mlst[0]) : 'white')
		.attr('stroke', skewer.shape[1].isFilled ? 'white' : d => tk.color4disc(d.mlst[0]))
}

export function renderShapeKick(skewer: any, discg: any) {
	const kick = discg
		.append('path')
		.attr('d', d => {
			d.radius = d.radius * 1.01
			console.log(d.radius)
			return skewer.shape[1].calculatePath(getPathDimensions(skewer.shape[0], d))
		})
		.attr('stroke-width', 1.5)

	return kick
}

function getPathDimensions(key: string, d: any) {
	//Add more shapes here using the key from #dom/shapes.js
	switch (key) {
		case 'emptyCircle':
			return { radius: d.radius }
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
