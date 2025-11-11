import type { SvgG } from '../../../types/d3'
import { Menu, renderTable } from '#dom'
import type { TableCell, TableColumn } from '#dom'

export type AlternativeCnvSet = {
	nameHtml?: string
	name?: string
	inuse?: boolean
	mlst: any[]
	attrs?: { [key: string]: string }
}

let isOpen = false
function parseSetLabel(set: AlternativeCnvSet, index: number) {
	let text = set.name || `Set ${index + 1}`
	let href: string | undefined
	let target = '_blank'

	if (set.nameHtml) {
		const parser = new DOMParser()
		const doc = parser.parseFromString(set.nameHtml, 'text/html')
		const anchor = doc.querySelector('a')
		if (anchor) {
			href = anchor.getAttribute('href') || undefined
			target = anchor.getAttribute('target') || '_blank'
			text = anchor.textContent?.trim() || text
		} else {
			text = doc.body.textContent?.trim() || text
		}
	}

	return { text, href, target }
}

/**
 * Render the CNV source label and a control inside the legend. Clicking the
 * control will display a menu with a table to choose among the
 * available CNV data sets.
 *
 * @param legendG - legend <g> element to append the label and control to
 * @param datasets - list of alternative CNV data sets from the server
 * @param fontSize - font size used in the legend
 * @param onChange - callback fired with the index of the selected data set
 */
export function renderCnvSourceLegend(
	legendG: SvgG,
	datasets: AlternativeCnvSet[],
	fontSize: number,
	onChange: (index: number) => void
) {
	if (!legendG || legendG.empty()) throw new Error('legendG is required')
	if (!datasets || datasets.length === 0) throw new Error('at least one dataset is required')

	legendG.select('g.sjpp-cnv-source').remove()

	const gBBox = legendG.node()!.getBBox()
	const cnvSrcWrapper = legendG
		.append('g')
		.attr('class', 'sjpp-cnv-source')
		.attr('transform', `translate(${gBBox.width},${gBBox.y + fontSize})`)

	const btnPaddingX = Math.round(fontSize * 0.8)
	const btnHgt = Math.round(fontSize * 1.8)

	const btnWrapper = cnvSrcWrapper
		.append('g')
		.attr('transform', `translate(${fontSize},${-btnHgt / 2})`)
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			event.stopPropagation()
			showCnvMenu(this)
		})

	const btnText = btnWrapper
		.append('text')
		.attr('x', 0)
		.attr('y', btnHgt / 2)
		.attr('font-size', fontSize)
		.attr('text-anchor', 'start')
		.attr('dominant-baseline', 'middle')
		.text('Select source ▲'.toUpperCase())

	const textW = btnText.node() ? Math.ceil(btnText.node()!.getBBox().width) : 0
	const btnWdt = textW + btnPaddingX * 2

	btnWrapper
		.insert('rect', ':first-child')
		.attr('width', btnWdt)
		.attr('height', btnHgt)
		.attr('rx', 10)
		.attr('ry', 10)
		.style('fill', '#f2f2f2')

	btnText.attr('x', btnWdt / 2).attr('text-anchor', 'middle')

	const cnvMenu = new Menu({
		onHide: () => {
			isOpen = !isOpen
			btnText.text(isOpen ? 'Select source ▼'.toUpperCase() : 'Select source ▲'.toUpperCase())
		}
	})

	function showCnvMenu(dom: Element) {
		cnvMenu.clear().showunder(dom)

		cnvMenu.d.append('div').text('Choose data source for CNV:').style('margin', '5px 5px 0 5px')

		const tableHolder = cnvMenu.d.append('div').style('padding', '5px')

		const { columns, rows } = buildTableData(datasets)
		const [, activeIndex] = getActiveDataset(datasets)

		renderTable({
			columns,
			rows,
			div: tableHolder,
			singleMode: true,
			maxWidth: '70vw',
			maxHeight: '60vh',
			selectedRows: [activeIndex],
			header: { allowSort: false },
			noButtonCallback: (rowIndex, node) => {
				const inputIndex = Number(node?.value)
				const selectedIndex = Number.isNaN(inputIndex) ? rowIndex : inputIndex
				if (!Number.isNaN(selectedIndex)) onChange(selectedIndex)
				cnvMenu.hide()
			}
		})
	}
}

function getActiveDataset(datasets) {
	let currentIndex = datasets.findIndex(d => d.inuse)
	if (currentIndex == -1) currentIndex = 0
	return [datasets[currentIndex], currentIndex]
}

function buildTableData(datasets: AlternativeCnvSet[]): { columns: TableColumn[]; rows: TableCell[][] } {
	const attrKeys: string[] = []
	for (const set of datasets) {
		if (!set.attrs) continue
		for (const key of Object.keys(set.attrs)) {
			if (!attrKeys.includes(key)) attrKeys.push(key)
		}
	}

	const columns: TableColumn[] = [{ label: 'Source' }]
	for (const key of attrKeys) columns.push({ label: key })

	const rows: TableCell[][] = datasets.map((set, index) => {
		const sourceInfo = parseSetLabel(set, index)
		const cells: TableCell[] = []

		if (set.nameHtml) cells.push({ html: set.nameHtml })
		else if (sourceInfo.href) cells.push({ value: sourceInfo.text, url: sourceInfo.href })
		else cells.push({ value: sourceInfo.text })

		for (const key of attrKeys) {
			const value = set.attrs?.[key]
			cells.push({ value: value ?? '' })
		}

		return cells
	})

	return { columns, rows }
}
