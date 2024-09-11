export function renderSkewerShapes(tk, skewer, shapeG) {
	const shapePath = shapeG
		.append('path')
		.attr('d', d => skewer.shape[1].calculatePath(getPathDimensions(skewer.shape[0], d)))
		.attr('fill', skewer.shape[1].isFilled ? d => tk.color4disc(d.mlst[0]) : 'white')
		.attr('stroke', d => tk.color4disc(d.mlst[0]))
		.attr('transform', d => `translate(${-d.yoffset / 2},${-d.yoffset})`)
}

function getPathDimensions(key, d) {
	//Add more shapes here using the key from #dom/shapes.js
	switch (key) {
		case 'emptyVerticalRectangle':
			return { width: d.radius - 0.5, height: d.radius * 1.5 }
		default:
			'Invalid shape key'
	}
}
