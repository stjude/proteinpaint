import { renderTable } from './table'
import { createLollipopFromGene, createMatrixFromGenes } from './genePlotActions'
import type { ShowResultsTableOpts, ResultsDataItem } from './types/resultsTable'

/**
 * Renders a results table for biological items (genes, promoters, etc.).
 * Used by manhattan/volcano hover tooltips, click menus, and the grin2
 * top-genes table. Data-agnostic — pass `columns`/`rows` for custom shapes.
 *
 * When `app` is provided, the gene-specific Matrix/Lollipop buttons are
 * auto-injected; omit `app` for read-only or non-gene contexts.
 */
export function showResultsTable(opts: ShowResultsTableOpts): void {
	const {
		tableDiv,
		hits,
		app,
		clickMenu,
		columns: prebuiltColumns,
		rows: prebuiltRows,
		dataItems: prebuiltDataItems,
		getRowKey = (item: any) => item.gene,
		matrixButtonFormat = 'Matrix ({n})',
		...renderTableOpts
	} = opts

	const dataItems = prebuiltDataItems || hits

	if (!dataItems || dataItems.length === 0) return

	// Auto-build manhattan-default columns/rows only when hits look manhattan-shaped.
	// Non-manhattan callers (volcano, proteinView) must supply columns + rows.
	const useManhattanDefaults = !prebuiltColumns && hits && hits[0]?.chrom
	if (!prebuiltColumns && !useManhattanDefaults) {
		throw new Error('showResultsTable: `columns` is required when `hits` is not manhattan-shaped')
	}

	const columns = prebuiltColumns || [
		{ label: 'Gene' },
		{ label: `${hits![0].chrom.charAt(0).toUpperCase()}${hits![0].chrom.slice(1).toLowerCase()} pos` },
		{ label: 'Type' },
		{ label: 'Q-value', sortable: true },
		{ label: 'Subject count', sortable: true }
	]

	const rows =
		prebuiltRows ||
		hits!.map(d => [
			{ value: d.gene },
			{ html: `<span style="font-size:.8em">${d.start}-${d.end}</span>` },
			{ html: `<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}` },
			{ value: d.q_value.toPrecision(3) },
			{ value: d.nsubj }
		])

	const tableOptions: any = {
		div: tableDiv,
		columns,
		rows,
		showLines: false,
		showHeader: true,
		striped: true,
		resize: 'both',
		header: { allowSort: true },
		...renderTableOpts
	}

	if (app) {
		let lastTouchedGene: string | null = null
		let selectionOrder: number[] = []

		tableOptions.buttonsToLeft = true
		tableOptions.buttons = [
			{
				text: matrixButtonFormat.replace('{n}', '0'),
				callback: (selectedIndices: number[], buttonNode: HTMLButtonElement) => {
					if (selectedIndices.length > 0) {
						buttonNode.disabled = true
						const selectedGenes = selectedIndices.map(idx => getRowKey(dataItems[idx]))
						clickMenu?.hide()
						createMatrixFromGenes(selectedGenes, app)
					}
				},
				onChange: (selectedIndices: number[], buttonNode: HTMLButtonElement) => {
					buttonNode.textContent = matrixButtonFormat.replace('{n}', String(selectedIndices.length))
					buttonNode.disabled = selectedIndices.length === 0
				}
			},
			{
				text: 'Lollipop',
				callback: (_selectedIndices: number[], buttonNode: HTMLButtonElement) => {
					if (lastTouchedGene) {
						buttonNode.disabled = true
						clickMenu?.hide()
						createLollipopFromGene(lastTouchedGene, app)
					}
				},
				onChange: (selectedIndices: number[], buttonNode: HTMLButtonElement) => {
					const result = updateSelectionTracking(selectionOrder, selectedIndices, dataItems)
					selectionOrder = result.selectionOrder
					lastTouchedGene = result.lastTouchedGene
					buttonNode.textContent = result.buttonText
					buttonNode.disabled = result.buttonDisabled
				}
			}
		]
	}

	renderTable(tableOptions)
}

/**
 * Updates selection-order tracking and determines the last-touched gene.
 * Used by the Lollipop button to remember which gene the user touched most
 * recently across multi-select changes. Lives next to showResultsTable since
 * the button-state logic is its only caller.
 */
export function updateSelectionTracking(
	currentSelectionOrder: number[],
	selectedIndices: number[],
	dataSource: ResultsDataItem[]
): { selectionOrder: number[]; lastTouchedGene: string | null; buttonText: string; buttonDisabled: boolean } {
	const newlySelected = selectedIndices.filter(idx => !currentSelectionOrder.includes(idx))

	const updatedSelectionOrder = currentSelectionOrder.filter(idx => selectedIndices.includes(idx))
	updatedSelectionOrder.push(...newlySelected)

	let lastTouchedGene: string | null = null
	let buttonText = 'Lollipop'

	if (updatedSelectionOrder.length > 0) {
		const lastSelectedIdx = updatedSelectionOrder[updatedSelectionOrder.length - 1]
		const dataItem = dataSource[lastSelectedIdx]

		if (Array.isArray(dataItem)) {
			// First cell is by convention the gene/feature name; coerce to string
			// since `value` is widened to string | number across the table API.
			const v = dataItem[0]?.value
			lastTouchedGene = v != null ? String(v) : null
		}

		if (lastTouchedGene !== null) buttonText = `Lollipop (${lastTouchedGene})`
	}

	return {
		selectionOrder: updatedSelectionOrder,
		lastTouchedGene,
		buttonText,
		buttonDisabled: lastTouchedGene === null
	}
}
