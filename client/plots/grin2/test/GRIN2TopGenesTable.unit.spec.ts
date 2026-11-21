import tape from 'tape'
import * as d3s from 'd3-selection'
import { GRIN2TopGenesTable } from '../view/GRIN2TopGenesTable'
import type { TableBaseColumn, TableBaseRow } from '#dom'

/*
Tests:
	Renders the table, its header, a row per gene and the circles column
	Sorting shows the restore button, and restoring puts the rows back in the order the server sent
	Filtering a column keeps only the matching genes
	Matrix and Lollipop buttons follow the selection
	Download icon without more lines downloads the table at once, without the circles column
	Download icon with more lines opens a menu; the first line downloads the table as sorted
	Download icon menu runs the callback of the second line
	render() is idempotent and remove() takes the icon and the table away
*/

/*************************
 reusable helper functions
**************************/

function getHolder(): any {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

const columns: TableBaseColumn[] = [
	{ label: '', width: '20px' },
	{ label: 'Gene', sortable: true },
	{ label: 'Chromosome', sortable: true },
	{ label: 'Q-value (Loss)', sortable: true },
	{ label: 'Subject Count (Loss)', sortable: true }
]
const geneCol = 1
const qCol = 3

/** a fresh array every time: the table holds the array it is given */
function getRows(): TableBaseRow[] {
	return [
		[{ value: '', html: '<span>circle</span>' }, { value: 'NRAS' }, { value: 'chr1' }, { value: 0.5 }, { value: 12 }],
		[{ value: '', html: '' }, { value: 'KRAS' }, { value: 'chr12' }, { value: 0.01 }, { value: 30 }],
		[{ value: '', html: '<span>circle</span>' }, { value: 'CDKN2A' }, { value: 'chr9' }, { value: 1e-9 }, { value: 80 }]
	]
}

function makeTable(holder: any, extra: any = {}) {
	const rows = getRows()
	return new GRIN2TopGenesTable({
		holder,
		app: { dispatch() {} },
		columns,
		rows,
		dataItems: rows.map(row => row.slice(1)),
		downloadTitle: 'Download top 3 genes (TSV)',
		fileName: 'top_genes.tsv',
		...extra
	})
}

/** the gene names in the order the table shows them. A row starts with the selection cell, then the circles cell */
function geneOrder(holder: any): string[] {
	return [...holder.node().querySelectorAll('tbody tr')].map(
		(tr: HTMLElement) => tr.querySelectorAll('td')[geneCol + 1].textContent ?? ''
	)
}

function restoreButton(holder: any): HTMLButtonElement {
	return holder.node().querySelector('[data-testid="sjpp-table-restore-button"]')
}

function actionButtons(holder: any): string[] {
	return [...holder.node().querySelectorAll('.sjpp-table-buttons button')]
		.filter((b: HTMLElement) => b.getAttribute('data-testid') != 'sjpp-table-restore-button')
		.map((b: HTMLElement) => b.textContent || '')
}

function downloadIcon(holder: any): HTMLElement {
	return holder.node().querySelector('div[role="button"]')
}

/** Runs fn while clicks on a link are caught instead of downloading, and returns what the link would have saved */
function catchDownloads(fn: () => void): { fileName: string | null; text: string }[] {
	const saved: { fileName: string | null; text: string }[] = []
	const click = HTMLAnchorElement.prototype.click
	HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
		const href = this.getAttribute('href') || ''
		saved.push({
			fileName: this.getAttribute('download'),
			text: decodeURIComponent(href.slice(href.indexOf(',') + 1)).replace(/^\uFEFF/, '')
		})
	}
	try {
		fn()
	} finally {
		HTMLAnchorElement.prototype.click = click
	}
	return saved
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/grin2/GRIN2TopGenesTable -***-')
	test.end()
})

tape('Renders the table, its header, a row per gene and the circles column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	makeTable(holder)

	test.ok(holder.node().querySelector('table[data-testid="sjpp-grin2-top-genes-table"]'), 'table has the test id')
	const labels = [...holder.node().querySelectorAll('thead th .sjpp-table-header-label')].map((s: any) => s.textContent)
	test.deepEqual(
		labels,
		columns.map(c => c.label),
		'a header cell for every column'
	)
	test.deepEqual(geneOrder(holder), ['NRAS', 'KRAS', 'CDKN2A'], 'a row per gene, in the order of the server')
	const firstRow = holder.node().querySelector('tbody tr')
	test.equal(firstRow.querySelectorAll('td')[1].innerHTML, '<span>circle</span>', 'the circles column shows its html')
	test.equal(
		holder.node().querySelectorAll('thead th button[aria-haspopup]').length,
		columns.length - 1,
		'every column but the circles column has a sort and filter button'
	)

	holder.remove()
	test.end()
})

tape('Sorting shows the restore button, and restoring puts the rows back in the order the server sent', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder)

	test.equal(restoreButton(holder).style.display, 'none', 'restore button is hidden before a sort')
	table.sortByColumn(qCol, true)
	test.deepEqual(geneOrder(holder), ['CDKN2A', 'KRAS', 'NRAS'], 'rows sorted by q-value, ascending')
	test.notEqual(restoreButton(holder).style.display, 'none', 'restore button is shown after a sort')

	restoreButton(holder).click()
	test.deepEqual(geneOrder(holder), ['NRAS', 'KRAS', 'CDKN2A'], 'rows are back in the order of the server')
	test.equal(restoreButton(holder).style.display, 'none', 'restore button is hidden again')

	table.sortByColumn(qCol, true)
	table.render()
	test.notEqual(
		restoreButton(holder).style.display,
		'none',
		'a new render keeps showing the button while the sort holds'
	)

	holder.remove()
	test.end()
})

tape('Filtering a column keeps only the matching genes', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder)

	table.setColumnFilter(geneCol, 'ras')
	test.deepEqual(geneOrder(holder), ['NRAS', 'KRAS'], 'a text filter on the gene column')
	table.setColumnFilter(geneCol, '')
	table.setColumnFilter(4, '>=30')
	test.deepEqual(geneOrder(holder), ['KRAS', 'CDKN2A'], 'a numeric filter on a subject count')

	holder.remove()
	test.end()
})

tape('Matrix and Lollipop buttons follow the selection', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder)

	test.deepEqual(actionButtons(holder), ['Matrix (0 genes selected)', 'Lollipop'], 'buttons before a selection')
	const buttons = holder.node().querySelectorAll('.sjpp-table-buttons button')
	test.ok(
		[...buttons].filter((b: any) => b.textContent != 'Restore row order').every((b: any) => b.disabled),
		'disabled'
	)

	table.setSelectedIndexes([1, 2])
	test.deepEqual(
		actionButtons(holder),
		['Matrix (2 genes selected)', 'Lollipop (CDKN2A)'],
		'Matrix counts the selected genes; Lollipop names the last one selected'
	)
	test.deepEqual(table.getSelectedIndexes(), [1, 2], 'indexes are into the rows the table was given')

	table.sortByColumn(qCol, true)
	test.deepEqual(table.getSelectedIndexes(), [1, 2], 'the selection survives a sort')

	holder.remove()
	test.end()
})

tape('Download icon without more lines downloads the table at once, without the circles column', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder)

	table.sortByColumn(qCol, true)
	const saved = catchDownloads(() => downloadIcon(holder).click())
	test.equal(saved.length, 1, 'one file')
	test.equal(saved[0]?.fileName, 'top_genes.tsv', 'named as asked')
	const lines = saved[0]?.text
		.trim()
		.split('\n')
		.map(l => l.split('\t'))
	test.deepEqual(
		lines?.[0],
		['Gene', 'Chromosome', 'Q-value (Loss)', 'Subject Count (Loss)'],
		'header has no circles column'
	)
	test.deepEqual(
		lines?.map(l => l[0]).slice(1),
		['CDKN2A', 'KRAS', 'NRAS'],
		'rows are in the order the table shows them'
	)

	holder.remove()
	test.end()
})

tape('Download icon with more lines opens a menu; the first line downloads the table as sorted', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder, {
		moreDownloads: [
			{ text: 'Download all 3 genes in output (TSV)', callback: () => {}, testId: 'sjpp-grin2-download-all-genes' }
		]
	})

	table.sortByColumn(qCol, true)
	const saved = catchDownloads(() => {
		downloadIcon(holder).click()
		const lines = [...document.querySelectorAll('.sja_menuoption')] as HTMLElement[]
		test.deepEqual(
			lines.map(l => l.textContent),
			['Download top 3 genes (TSV)', 'Download all 3 genes in output (TSV)'],
			'two lines, the table first'
		)
		lines[0].click()
	})
	test.equal(saved.length, 1, 'the first line downloads the table')
	test.deepEqual(
		saved[0]?.text
			.trim()
			.split('\n')
			.map(l => l.split('\t')[0])
			.slice(1),
		['CDKN2A', 'KRAS', 'NRAS'],
		'in the order the table shows'
	)

	table.remove()
	holder.remove()
	test.end()
})

tape('Download icon menu runs the callback of the second line', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	let called = 0
	const table = makeTable(holder, {
		moreDownloads: [{ text: 'Download all', callback: () => called++, testId: 'sjpp-grin2-download-all-genes' }]
	})

	const saved = catchDownloads(() => {
		downloadIcon(holder).click()
		;(document.querySelector('[data-testid="sjpp-grin2-download-all-genes"]') as HTMLElement).click()
	})
	test.equal(called, 1, 'the callback of the second line ran')
	test.equal(saved.length, 0, 'and the table was not downloaded')

	table.remove()
	holder.remove()
	test.end()
})

tape('render() is idempotent and remove() takes the icon and the table away', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const table = makeTable(holder)

	table.render().render()
	test.equal(holder.node().querySelectorAll('table').length, 1, 'one table after repeated renders')
	test.equal(holder.node().querySelectorAll('div[role="button"]').length, 1, 'one download icon after repeated renders')

	table.remove()
	test.equal(holder.node().querySelectorAll('table').length, 0, 'the table is gone')
	test.equal(holder.node().querySelectorAll('div[role="button"]').length, 0, 'the download icon is gone')

	holder.remove()
	test.end()
})
