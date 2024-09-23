import { Elem } from '../types/d3'
import { shapes } from '../dom/shapes.js'

export function renderSkewerShapes(tk: any, skewer: any, shapeG: Elem) {
	shapeG
		.append('path')
		.attr('d', d => shapes[d.shape].calculatePath(getPathDimensions(d.shape, d.radius, skewer)))
		.attr('fill', d => (shapes[d.shape].isFilled ? tk.color4disc(d.mlst[0]) : 'white'))
		.attr('stroke', d => (shapes[d.shape].isFilled ? 'white' : tk.color4disc(d.mlst[0])))
}

export function renderShapeKick(skewer: any, elem: any) {
	const kick = elem
		.append('path')
		.attr('d', d => {
			if (!d.shape) d.shape = d.groups[0].shape
			const radius = d.radius * 1.01 || d.maxradius + 2
			return shapes[d.shape].calculatePath(getPathDimensions(d.shape, radius, skewer))
		})
		.attr('stroke-width', 1.75)

	return kick
}

function getPathDimensions(key: string, radius: number, skewer: any) {
	//Add more shapes here using the key from #dom/shapes.js
	switch (key) {
		case 'filledCircle':
			return { radius: radius * 0.95 }
		case 'emptyCircle':
			return { radius }
		case 'filledVerticalRectangle':
			return { width: radius * 1.5, height: radius * 2.1 }
		case 'emptyVerticalRectangle':
			return { width: radius * 1.4, height: radius * 2 }
		case 'filledTriangle':
			return { width: radius * 2.1, height: radius * 2.1, isUp: skewer.pointup }
		case 'emptyTriangle':
			return { width: radius * 2, height: radius * 2, isUp: skewer.pointup }
		case 'filledSquare':
			return { width: radius * 1.7, height: radius * 1.7 }
		case 'emptySquare':
			return { width: radius * 1.7, height: radius * 1.7 }
		default:
			throw 'Invalid shape key. Add shape [getPathDimensions() skewer.render.shapes.ts]'
	}
}

export function setNumBaseline(key: string, pointup: boolean) {
	if (key.includes('Triangle')) {
		if (pointup) return 'central'
		else return `text-after-edge`
	} else return ''
}
