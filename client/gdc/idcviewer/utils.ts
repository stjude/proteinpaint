import { type BaseType, type Selection } from 'd3-selection'
import { applyStyles, sharedStyles } from './styling'

export function makeTransparentButton(
	button: Selection<HTMLButtonElement, unknown, any, any>
): Selection<HTMLButtonElement, unknown, any, any> {
	return applyStyles(button, sharedStyles.transparentButton)
}

export function addSvg<GElement extends BaseType, Datum, PElement extends BaseType, PDatum>(
	selection: Selection<GElement, Datum, PElement, PDatum>,
	paths: string[]
): Selection<GElement, Datum, PElement, PDatum> {
	const svg = selection

		.append('svg')
		.attr('xmlns', 'http://www.w3.org/2000/svg')
		.attr('viewBox', '0 0 16 16')
		.attr('width', '16')
		.attr('height', '16')
	paths.forEach(path => {
		svg.append('path').attr('d', path).attr('fill', 'currentColor')
	})
	return selection
}

export function makeCenteredFlex<GElement extends BaseType, Datum, PElement extends BaseType, PDatum>(
	selection: Selection<GElement, Datum, PElement, PDatum>
): Selection<GElement, Datum, PElement, PDatum> {
	return applyStyles(selection, sharedStyles.centeredFlex)
}
