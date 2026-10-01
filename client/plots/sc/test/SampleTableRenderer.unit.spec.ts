import tape from 'tape'
import * as d3s from 'd3-selection'
import { SampleTableRenderer } from '../view/SampleTableRenderer.ts'
import { SCViewRenderer } from '../view/SCViewRenderer.ts'

/**
 * Tests
 *   - constructor should set dom, interactions, and tableData
 *   - renderSamplesTable() should render table headers from columns
 *   - renderSamplesTable() should render correct number of rows
 *   - renderSamplesTable() onRowClick should build item with sID from sample column
 *   - renderSamplesTable() onRowClick should build item with eID from experiment column
 *   - renderSamplesTable() onRowClick should map custom column labels to keys
 *   - buildItemFromRow() should skip empty cell values
 *   - renderSamplesTable() onRowClick should throw when sID is missing
 *   - renderSamplesTable() onRowClick should call interactions.updateItem
 *   - renderSamplesTable() onRowClick should show plotsBtnsDiv
 *   - renderSamplesTable() onRowClick should toggle the select btn on sample selection
 *   - reapplyAllPlotButtons() should apply buttons for each active sample
 *   - updateTable() should remove buttons when sample no longer in activeSandboxes
 *   - updateTable() should not append buttons when no sandboxes exist for sample
 *   - updateTable() should append plot buttons for each sandbox
 *   - applyButtonsForSample() should find row by sample ID after sort mutation
 *   - updateTable() should skip rerendering btn when cell and plotIds are unchanged
 *   - updateTable() should re-render when plotIds change
 *   - updateTable() should preserve row DOM identity when sample list is unchanged
 *   - updateTable() should rebuild when the sample list changes
 *   - updateTable() should sync radio selection without rebuilding
 *   - deleteBtns() should remove buttons and clear rendered entry
 *   - appendPlotBtn() should truncate long plot names
 *   - appendPlotBtn() should not truncate short plot names
 *   - appendPlotBtn() should scroll sandbox into view on click
 */

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getTestTableData() {
	return {
		columns: [{ label: 'Sample', sortable: true }, { label: 'Shown plots' }, { label: 'Experiment', sortable: true }],
		rows: [
			[{ value: 'S1' }, { value: '' }, { value: 'EXP1' }],
			[{ value: 'S2' }, { value: '' }, { value: 'EXP2' }],
			[{ value: 'S3' }, { value: '' }, { value: 'EXP3' }]
		],
		selectedRows: [] as number[],
		sampleColIdx: 0
	}
}

function getMockDom(holder: any) {
	const selectBtn = holder.append('button') as any
	selectBtn.toggle = () => {}
	return {
		tableDiv: holder,
		plotsBtnsDiv: holder.append('div').style('display', 'none'),
		selectBtn
	} as any
}

function getMockInteractions(overrides: any = {}) {
	return {
		updateItem: overrides.updateItem || (() => {}),
		...overrides
	} as any
}

/** Stand-in for a subplot's sandbox div; only scrollIntoView() is ever invoked on it. */
function getMockDiv() {
	return { node: () => ({ scrollIntoView: () => {} }) }
}

/** Shared test teardown: remove the holder on success (leave it for inspection on failure), then end. */
function endTest(test: any, holder: any) {
	if (test['_ok']) holder.remove()
	test.end()
}

function getRenderer(overrides: any = {}) {
	const holder = getHolder()
	const dom = overrides.dom || getMockDom(holder)
	const interactions = overrides.interactions || getMockInteractions(overrides)
	const tableData = overrides.tableData || getTestTableData()
	const renderer = new SampleTableRenderer(dom, interactions, tableData)
	return { renderer, holder, dom, interactions, tableData }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/view/SampleTableRenderer -***-')
	test.end()
})

/* ---- constructor ---- */

tape('constructor should set dom, interactions, and tableData', test => {
	const { renderer, holder, dom, interactions, tableData } = getRenderer()

	test.equal(renderer.dom, dom, 'Should set dom reference')
	test.equal(renderer.interactions, interactions, 'Should set interactions reference')
	test.equal(renderer.tableData, tableData, 'Should set tableData reference')

	endTest(test, holder)
})

tape('buildItemFromRow() should skip empty cell values', test => {
	const tableData = {
		columns: [{ label: 'Sample', sortable: true }, { label: 'Shown plots' }, { label: 'Experiment', sortable: true }],
		rows: [[{ value: 'S1' }, { value: '' }, { value: '' }]],
		selectedRows: [],
		sampleColIdx: 0
	}

	const { renderer, holder } = getRenderer()
	const item = renderer.buildItemFromRow(tableData as any, 0)

	test.equal(item.sID, 'S1', 'Should keep required sID field')
	test.equal('eID' in item, false, 'Should omit mapped keys for empty values')

	endTest(test, holder)
})

/* ---- renderSamplesTable() ---- */

tape('renderSamplesTable() should render table headers from columns', test => {
	const { holder } = getRenderer()

	const headers = holder.selectAll('th').nodes() as HTMLElement[]
	const headerTexts = headers.map(h => h.textContent?.replace(/[⇵⇅▲▼↑↓]/g, '').trim())
	test.ok(headerTexts.includes('Sample'), 'Should render Sample header')
	test.ok(headerTexts.includes('Shown plots'), 'Should render Shown plots header')
	test.ok(headerTexts.includes('Experiment'), 'Should render Experiment header')

	endTest(test, holder)
})

tape('renderSamplesTable() should render correct number of rows', test => {
	const { holder } = getRenderer()

	const rows = holder.selectAll('tr.sjpp_row_wrapper').nodes()
	test.equal(rows.length, 3, 'Should render 3 rows')
	test.equal(holder.selectAll('input[type="radio"]').nodes().length, 3, 'Should render one radio button per row')

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should build item with sID from sample column', test => {
	let capturedItem: any
	const { holder } = getRenderer({
		updateItem: (item: any) => {
			capturedItem = item
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(capturedItem.sID, 'S1', 'Should map sample column to sID')

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should build item with eID from experiment column', test => {
	let capturedItem: any
	const { holder } = getRenderer({
		updateItem: (item: any) => {
			capturedItem = item
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(capturedItem.eID, 'EXP1', 'Should map experiment column to eID')

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should map custom column labels to keys', test => {
	let capturedItem: any
	const tableData = {
		columns: [
			{ label: 'Sample', sortable: true },
			{ label: 'Shown plots' },
			{ label: 'Experiment', sortable: true },
			{ label: 'Project', sortable: true }
		],
		rows: [[{ value: 'S1' }, { value: '' }, { value: 'EXP1' }, { value: 'PROJ1' }]],
		selectedRows: [],
		sampleColIdx: 0
	}

	const holder = getHolder()
	const dom = getMockDom(holder)
	const interactions = getMockInteractions({
		updateItem: (item: any) => {
			capturedItem = item
		}
	})
	new SampleTableRenderer(dom, interactions, tableData)

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(capturedItem.project, 'PROJ1', 'Should use lowercase column label as key for custom columns')

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should throw when sID is missing', test => {
	const tableData = {
		columns: [{ label: 'Project', sortable: true }],
		rows: [[{ value: 'PROJ1' }]],
		selectedRows: [],
		sampleColIdx: 0
	}

	const { renderer, holder } = getRenderer()

	test.throws(
		() => {
			renderer.buildItemFromRow(tableData as any, 0)
		},
		/Selected item must have sID property/,
		'Should throw error about missing sID'
	)

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should call interactions.updateItem', test => {
	let called = false
	const { holder } = getRenderer({
		updateItem: () => {
			called = true
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.ok(called, 'Should call interactions.updateItem')

	endTest(test, holder)
})

tape('renderSamplesTable() onRowClick should show plotsBtnsDiv', test => {
	const { holder, dom } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(dom.plotsBtnsDiv.style('display'), 'block', 'Should set plotsBtnsDiv display to block')

	endTest(test, holder)
})

tape('renderSamplesTable() should hide the table on selection in each viewer', test => {
	const holders = [] as ReturnType<typeof getHolder>[]
	for (let viewer = 1; viewer <= 2; viewer++) {
		const holder = getHolder()
		holders.push(holder)
		const dom = getMockDom(holder)
		dom.tableDiv = holder.append('div')
		dom.controlsDiv = holder.append('div')
		const interactions = getMockInteractions()
		new SCViewRenderer({ dom, interactions } as any).renderSelectBtn()
		new SampleTableRenderer(dom, interactions, getTestTableData())

		const firstRow = dom.tableDiv.select('tr.sjpp_row_wrapper').node() as HTMLElement
		firstRow.click()

		test.equal(dom.tableDiv.style('display'), 'none', `Should hide the table in viewer ${viewer}`)
	}
	if (test['_ok']) holders.forEach(holder => holder.remove())
	test.end()
})

/* ---- updateTable() ---- */

tape('reapplyAllPlotButtons() should apply buttons for each active sample', test => {
	const { renderer, holder } = getRenderer()

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	sandboxes.set('S2', [{ plotId: 'p2', div: mockDiv, plotName: 'tSNE' }])

	renderer.updatePlotBtns(sandboxes)

	const s1Cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const s2Cell = renderer.table!.rowMap.get('S2').cells.shownPlots
	test.equal(s1Cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should render button for S1')
	test.equal(s2Cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should render button for S2')

	endTest(test, holder)
})

tape('updateTable() should remove buttons when sample no longer in activeSandboxes', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should have 1 button before removal')

	// Update with empty map - sample no longer active
	renderer.updatePlotBtns(new Map())

	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 0, 'Should remove buttons when sample removed')
	test.false(renderer.rendered.has('S1'), 'Should remove from rendered map')

	endTest(test, holder)
})

tape('updateTable() should not append buttons when no sandboxes exist for sample', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [])
	renderer.updatePlotBtns(sandboxes)

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const btns = cell.selectAll('.sjpp-sc-table-plot-btn').nodes()
	test.equal(btns.length, 0, 'Should not append buttons when sandboxes array is empty')

	endTest(test, holder)
})

tape('updateTable() should append plot buttons for each sandbox', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [
		{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' },
		{ plotId: 'p2', div: mockDiv, plotName: 'tSNE' }
	])
	renderer.updatePlotBtns(sandboxes)

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const btns = cell.selectAll('.sjpp-sc-table-plot-btn').nodes()
	test.equal(btns.length, 2, 'Should append 2 plot buttons')

	endTest(test, holder)
})

tape('updateTable() should show the Shown plots column when there are multiple plots total', test => {
	const { renderer, holder } = getRenderer()

	const shownPlotsHeader = holder
		.selectAll('th')
		.filter(function (this: any) {
			return !!(this as HTMLElement).textContent?.includes('Shown plots')
		})
	const shownPlotsCells = renderer.tableData.rows.map(
		row => renderer.table!.rowMap.get(String(row[renderer.tableData.sampleColIdx].value)).cells.shownPlots
	)

	const mockDiv = getMockDiv()
	const onePlot = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	onePlot.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(onePlot)

	test.equal(shownPlotsHeader.style('display'), 'none', 'Should hide the Shown plots header for one plot')

	const multiplePlots = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	multiplePlots.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	multiplePlots.set('S2', [{ plotId: 'p2', div: mockDiv, plotName: 'tSNE' }])
	renderer.updatePlotBtns(multiplePlots)

	test.equal(shownPlotsHeader.style('display'), 'table-cell', 'Should show the Shown plots header for multiple plots')
	test.equal(shownPlotsCells.length, 3, 'Should keep one Shown plots cell per data row')
	test.equal(shownPlotsCells[0].style('display'), 'table-cell', 'Should show Shown plots cells for multiple plots')

	endTest(test, holder)
})

tape('applyButtonsForSample() should find row by sample ID after sort mutation', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const rows = renderer.tableData.rows
	renderer.tableData.rows = [rows[1], rows[0], rows[2]]

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const s1Cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const s2Cell = renderer.table!.rowMap.get('S2').cells.shownPlots
	test.equal(
		s1Cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length,
		1,
		'Should render button in the moved S1 row'
	)
	test.equal(s2Cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 0, 'Should not render button in other rows')

	endTest(test, holder)
})

tape('updateTable() should skip rerendering btn when cell and plotIds are unchanged', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	// Add a marker to verify btn is not re-created
	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	;(btn as any).__marker = true

	// Call again with same data
	renderer.updatePlotBtns(sandboxes)

	const sameBtn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.ok((sameBtn as any).__marker, 'Should preserve existing btn elements (no re-render)')

	endTest(test, holder)
})

tape('updateTable() should re-render when plotIds change', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = getMockDiv()
	const sandboxes1 = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes1.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes1)

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should have 1 button initially')

	// Change plots for the same sample
	const sandboxes2 = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes2.set('S1', [
		{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' },
		{ plotId: 'p3', div: mockDiv, plotName: 'Violin' }
	])
	renderer.updatePlotBtns(sandboxes2)

	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 2, 'Should re-render with 2 buttons')

	endTest(test, holder)
})

tape('updateTable() should preserve row DOM identity when sample list is unchanged', test => {
	const { renderer, holder } = getRenderer()

	const firstRowNode = renderer.table!.rowMap.get('S1').row.node()
	const parentDivNode = renderer.table!.parentDiv.node()

	// Simulate SC's main()/update() re-running with a freshly built (but equivalent)
	// tableData object, as happens on every subplot state change.
	const nextTableData = getTestTableData()
	renderer.updateTable(nextTableData)

	test.equal(renderer.table!.rowMap.get('S1').row.node(), firstRowNode, 'Should keep the same row DOM node')
	test.equal(renderer.table!.parentDiv.node(), parentDivNode, 'Should not tear down and rebuild the table shell')

	endTest(test, holder)
})

tape('updateTable() should rebuild when the sample list changes', test => {
	const { renderer, holder } = getRenderer()

	const parentDivNode = renderer.table!.parentDiv.node()

	const nextTableData = getTestTableData()
	nextTableData.rows.push([{ value: 'S4' }, { value: '' }, { value: 'EXP4' }] as any)
	renderer.updateTable(nextTableData)

	test.notEqual(renderer.table!.parentDiv.node(), parentDivNode, 'Should rebuild the table shell when rows change')
	test.equal(renderer.table!.rowMap.size, 4, 'Should render all rows including the new one')

	endTest(test, holder)
})

tape('updateTable() should sync radio selection without rebuilding', test => {
	const { renderer, holder } = getRenderer()

	const parentDivNode = renderer.table!.parentDiv.node()
	const nextTableData = getTestTableData()
	nextTableData.selectedRows = [1] // select S2

	renderer.updateTable(nextTableData)

	test.equal(renderer.table!.parentDiv.node(), parentDivNode, 'Should not rebuild for a selection change')
	const s2Input = renderer.table!.rowMap.get('S2').row.select('input[type="radio"]').node() as HTMLInputElement
	test.ok(s2Input.checked, 'Should check the newly selected row')

	endTest(test, holder)
})

tape('updateTable() should keep the page scroll anchored: no DOM is replaced for an equivalent update', test => {
	const { renderer, holder } = getRenderer()

	const tbodyNode = holder.select('tbody').node()
	const tableNode = holder.select('table').node()
	renderer.updateTable(getTestTableData())
	renderer.updatePlotBtns(new Map())

	test.equal(holder.select('tbody').node(), tbodyNode, 'Should not redraw the rows')
	test.equal(holder.select('table').node(), tableNode, 'Should not redraw the table')
	test.equal(holder.selectAll('table').size(), 1, 'Should never have two tables')

	endTest(test, holder)
})

tape('subplot state updates should not move the page or the table scroll position', test => {
	// a tall spacer puts the table below the fold, like a dashboard with plots above it
	const spacer = d3s.select('body').append('div').style('height', '3000px')
	const tableData = (selectedRows: number[] = []) => ({
		columns: [{ label: 'Sample', sortable: true }, { label: 'Shown plots' }],
		rows: Array.from({ length: 80 }, (_, i) => [{ value: `S${i}` }, { value: '' }]),
		selectedRows,
		sampleColIdx: 0
	})
	const { renderer, holder } = getRenderer({ tableData: tableData() })
	const wrapper = renderer.table!.parentDiv.node() as HTMLElement
	// the sjpp_show_scrollbar stylesheet that makes the wrapper scroll is not loaded in the test page
	wrapper.style.overflow = 'auto'

	window.scrollTo(0, (holder.node() as HTMLElement).getBoundingClientRect().top + window.scrollY - 20)
	wrapper.scrollTop = 300
	const pageY = window.scrollY
	test.ok(pageY > 0 && wrapper.scrollTop > 0, 'Setup: the page and the table are both scrolled')

	// what SC does on each subplot state change: new equivalent tableData, new sandboxes, column toggle
	const two = new Map<string, any[]>()
	two.set('S60', [{ plotId: 'p1', div: getMockDiv(), plotName: 'UMAP' }])
	two.set('S61', [{ plotId: 'p2', div: getMockDiv(), plotName: 'tSNE' }])
	renderer.updatePlotBtns(two)
	renderer.updateTable(tableData([61]))
	renderer.updatePlotBtns(new Map())

	test.equal(window.scrollY, pageY, 'Should not scroll the page')
	test.equal(wrapper.scrollTop, 300, 'Should not move the table scroll position')
	test.equal(holder.selectAll('table').size(), 1, 'Should never have two tables')

	if (test['_ok']) spacer.remove()
	endTest(test, holder)
})

tape('clicking a sortable header should sort the rows, and show that the column is sortable', test => {
	const { holder } = getRenderer()
	const names = () => (holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]).map(tr => tr.cells[2].textContent)
	const headerButtons = holder.selectAll('thead th button').nodes() as HTMLButtonElement[]

	test.equal(headerButtons.length, 2, 'Sample and Experiment are sortable, Shown plots is not')
	test.ok(
		headerButtons.every(button => (button.textContent || '').trim().length > button.textContent!.trim().replace(/\W/g, '').length),
		'Every sortable header should show a sort indicator before it is clicked'
	)

	headerButtons[0].click()
	test.deepEqual(names(), ['S1', 'S2', 'S3'], 'First click sorts ascending')
	headerButtons[0].click()
	test.deepEqual(names(), ['S3', 'S2', 'S1'], 'Second click sorts descending')

	endTest(test, holder)
})

tape('sortable columns should have a filter box, and filtering should keep the plot buttons and selection', test => {
	const { renderer, holder } = getRenderer()
	const names = () => (holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]).map(tr => tr.cells[2].textContent)
	const input = holder.select('input[data-testid="sjpp-table-filter-0"]').node() as HTMLInputElement

	test.equal(holder.selectAll('.sjpp-table-filter-input').size(), 2, 'Should render a filter for Sample and Experiment')
	test.ok(holder.select('input[data-testid="sjpp-table-filter-1"]').empty(), 'Should not render one for Shown plots')

	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S2', [{ plotId: 'p1', div: getMockDiv(), plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	input.value = 's2'
	input.dispatchEvent(new Event('input', { bubbles: true }))
	test.deepEqual(names(), ['S2'], 'Should keep only matching samples')
	test.equal(
		renderer.table!.rowMap.get('S2').cells.shownPlots.selectAll('.sjpp-sc-table-plot-btn').size(),
		1,
		'Should restore the plot button in the redrawn cell'
	)

	endTest(test, holder)
})

tape('the Shown plots column should stay hidden or shown through a sort and a filter redraw', test => {
	const { renderer, holder } = getRenderer()
	const shownPlotsDisplays = () =>
		(holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]).map(tr => getComputedStyle(tr.cells[3]).display)
	const headerDisplay = () =>
		getComputedStyle(
			(holder.selectAll('thead th').nodes() as HTMLElement[]).find(th => th.textContent?.includes('Shown plots'))!
		).display

	renderer.table!.sortByColumn(0)
	test.ok(shownPlotsDisplays().every(d => d == 'none'), 'Cells should stay hidden after a sort')
	test.equal(headerDisplay(), 'none', 'Header should stay hidden after a sort')

	renderer.table!.setShownPlotsColumnVisibility(true)
	renderer.table!.sortByColumn(0)
	test.ok(shownPlotsDisplays().every(d => d == 'table-cell'), 'Cells should stay shown after a sort')
	renderer.table!.setColumnFilter(0, 's1')
	test.deepEqual(shownPlotsDisplays(), ['table-cell'], 'Cells should stay shown after a filter')
	test.equal(headerDisplay(), 'table-cell', 'Header should stay shown')

	endTest(test, holder)
})

tape('sorting should restore the plot buttons that the row redraw removed', test => {
	const { renderer, holder } = getRenderer()

	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: getMockDiv(), plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)
	test.equal(renderer.table!.rowMap.get('S1').cells.shownPlots.selectAll('.sjpp-sc-table-plot-btn').size(), 1, 'Has a button')

	renderer.table!.sortByColumn(0) // ascending
	renderer.table!.sortByColumn(0) // descending: S3, S2, S1
	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').size(), 1, 'Should have a button in the new cell after the sort')
	test.deepEqual(
		(holder.selectAll('tbody tr').nodes() as HTMLTableRowElement[]).map(tr => tr.cells[2].textContent),
		['S3', 'S2', 'S1'],
		'Should have sorted the rows'
	)

	endTest(test, holder)
})

tape('clicking the already selected sample should select it again', test => {
	let selected = 0
	const { holder } = getRenderer({ updateItem: () => selected++ })

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()
	firstRow.click()

	test.equal(selected, 2, 'Should call updateItem on every click, because selecting also closes the table')

	endTest(test, holder)
})

/* ---- deleteBtns() ---- */

tape('deleteBtns() should remove buttons and clear rendered entry', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = getMockDiv()
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	test.true(renderer.rendered.has('S1'), 'Should have rendered entry before delete')

	renderer.deleteBtns('S1')

	test.false(renderer.rendered.has('S1'), 'Should remove from rendered map')
	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 0, 'Should remove buttons from table')

	endTest(test, holder)
})

/* ---- appendPlotBtn() ---- */

tape('appendPlotBtn() should truncate long plot names', test => {
	const { renderer, holder } = getRenderer()

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const mockDiv = getMockDiv()

	const longName = 'This is a very long plot name that exceeds 25 chars'
	renderer.appendPlotBtn(cell, mockDiv, longName, 'S1')

	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.equal(btn.textContent, 'This is a ve...', 'Should truncate to 12 chars + ...')

	endTest(test, holder)
})

tape('appendPlotBtn() should not truncate short plot names', test => {
	const { renderer, holder } = getRenderer()

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	const mockDiv = getMockDiv()

	renderer.appendPlotBtn(cell, mockDiv, 'UMAP', 'S1')

	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.equal(btn.textContent, 'UMAP', 'Should show full name for short plot names')

	endTest(test, holder)
})

tape('appendPlotBtn() should scroll sandbox into view on click', test => {
	const { renderer, holder } = getRenderer()

	const cell = renderer.table!.rowMap.get('S1').cells.shownPlots
	let scrollCalled = false
	const mockDiv = {
		node: () => ({
			scrollIntoView: () => {
				scrollCalled = true
			}
		})
	}

	renderer.appendPlotBtn(cell, mockDiv, 'UMAP', 'S1')

	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	btn.click()
	test.ok(scrollCalled, 'Should call scrollIntoView on click')

	endTest(test, holder)
})
