import { dtsnvindel, dtsv, dtfusionrna } from '#shared/common'

export function renderSkewerShapes(tk, skewer, shapeG) {
	//svg holder for shape
	const shapeSvg = shapeG
		.append('svg')
		.attr('width', 16)
		.attr('height', 16)
		.attr('fill', 'currentColor')
		.attr('viewBox', '0 0 16 16')

	const shapePath = shapeSvg.append('path').attr('d', skewer.shape)

	return shapeG
}
