/** Re-exports for backward compatibility. Canonical sources: model/IDCModel.ts, viewModel/IDCViewModel.ts, view/IDCTableView.ts */
export { IDCModel } from './model/IDCModel'
export { IDCViewModel } from './viewModel/IDCViewModel'
export { IDCTableView } from './view/IDCTableView'
import { type BaseType, type Selection } from 'd3-selection'

export function makeTransparentButton(
	button: Selection<HTMLButtonElement, unknown, any, any>
): Selection<HTMLButtonElement, unknown, any, any> {
	return button
		.style('cursor', 'pointer')
		.style('background', 'transparent')
		.style('border', 'none')
		.style('padding', '0')
		.style('margin', '0')
		.style('appearance', 'none')
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
	return selection.style('display', 'flex').style('align-items', 'center').style('justify-content', 'center')
}
