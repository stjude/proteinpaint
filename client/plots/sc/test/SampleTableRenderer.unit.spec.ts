import tape from 'tape'
import * as d3s from 'd3-selection'
import { SampleTableRenderer } from '../view/SampleTableRenderer.ts'

/**
 * Tests
 *   - constructor should set dom, interactions, and tableData
 *   - renderSamplesTable() should render table headers from columns
 *   - renderSamplesTable() should render correct number of rows
 *   - renderSamplesTable() noButtonCallback should build item with sID from sample column
 *   - renderSamplesTable() noButtonCallback should build item with eID from experiment column
 *   - renderSamplesTable() noButtonCallback should map custom column labels to keys
 *   - buildItemFromRow() should set isMetaResult for metadata result rows
 *   - buildItemFromRow() should skip empty cell values
 *   - renderSamplesTable() noButtonCallback should throw when sID is missing
 *   - renderSamplesTable() noButtonCallback should call interactions.updateItem
 *   - renderSamplesTable() noButtonCallback should show plotsBtnsDiv
 *   - reapplyAllPlotButtons() should apply buttons for each active sample
 *   - updateTable() should remove buttons when sample no longer in activeSandboxes
 *   - updateTable() should not append buttons when no sandboxes exist for sample
 *   - updateTable() should append plot buttons for each sandbox
 *   - applyButtonsForSample() should find row by sample ID after sort mutation
 *   - updateTable() should skip rerendering btn when cell and plotIds are unchanged
 *   - updateTable() should re-render when plotIds change
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
		selectedRows: [],
		sampleColIdx: 0
	}
}

function getMockDom(holder: any) {
	return {
		tableDiv: holder,
		plotsBtnsDiv: holder.append('div').style('display', 'none')
	} as any
}

function getMockInteractions(overrides: any = {}) {
	return {
		updateItem: overrides.updateItem || (() => {}),
		...overrides
	} as any
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('buildItemFromRow() should set isMetaResult for metadata result rows', test => {
	const tableData = {
		columns: [{ label: 'Sample', sortable: true }, { label: 'Shown plots' }, { label: 'Experiment', sortable: true }],
		rows: [[{ value: 'S1' }, { value: 'meta', elemId: 'isMetaResult' }, { value: 'EXP1' }]],
		selectedRows: [],
		sampleColIdx: 0
	}

	const { renderer, holder } = getRenderer()
	const item = renderer.buildItemFromRow(tableData as any, 0)

	test.true(item.isMetaResult, 'Should set isMetaResult=true when row contains isMetaResult elemId')

	if ((test as any)._ok) holder.remove()
	test.end()
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

/* ---- renderSamplesTable() ---- */

tape('renderSamplesTable() should render table headers from columns', test => {
	const { holder } = getRenderer()

	const headers = holder.selectAll('th').nodes() as HTMLElement[]
	const headerTexts = headers.map(h => h.textContent?.replace(/[⇵↑↓]/g, '').trim())
	test.ok(headerTexts.includes('Sample'), 'Should render Sample header')
	test.ok(headerTexts.includes('Shown plots'), 'Should render Shown plots header')
	test.ok(headerTexts.includes('Experiment'), 'Should render Experiment header')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() should render correct number of rows', test => {
	const { holder } = getRenderer()

	const rows = holder.selectAll('tr.sjpp_row_wrapper').nodes()
	test.equal(rows.length, 3, 'Should render 3 rows')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should build item with sID from sample column', test => {
	let capturedItem: any
	const { holder } = getRenderer({
		updateItem: (item: any) => {
			capturedItem = item
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(capturedItem.sID, 'S1', 'Should map sample column to sID')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should build item with eID from experiment column', test => {
	let capturedItem: any
	const { holder } = getRenderer({
		updateItem: (item: any) => {
			capturedItem = item
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(capturedItem.eID, 'EXP1', 'Should map experiment column to eID')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should map custom column labels to keys', test => {
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should throw when sID is missing', test => {
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

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should call interactions.updateItem', test => {
	let called = false
	const { holder } = getRenderer({
		updateItem: () => {
			called = true
		}
	})

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.ok(called, 'Should call interactions.updateItem')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('renderSamplesTable() noButtonCallback should show plotsBtnsDiv', test => {
	const { holder, dom } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	test.equal(dom.plotsBtnsDiv.style('display'), 'block', 'Should set plotsBtnsDiv display to block')

	if ((test as any)._ok) holder.remove()
	test.end()
})

/* ---- updateTable() ---- */

tape('reapplyAllPlotButtons() should apply buttons for each active sample', test => {
	const { renderer, holder } = getRenderer()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	sandboxes.set('S2', [{ plotId: 'p2', div: mockDiv, plotName: 'tSNE' }])

	renderer.updatePlotBtns(sandboxes)

	const s1Row = renderer.tableData.rows.find(r => r[renderer.tableData.sampleColIdx].value === 'S1') as any
	const s2Row = renderer.tableData.rows.find(r => r[renderer.tableData.sampleColIdx].value === 'S2') as any
	test.equal(s1Row[1].__td.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should render button for S1')
	test.equal(s2Row[1].__td.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should render button for S2')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('updateTable() should remove buttons when sample no longer in activeSandboxes', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should have 1 button before removal')

	// Update with empty map - sample no longer active
	renderer.updatePlotBtns(new Map())

	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 0, 'Should remove buttons when sample removed')
	test.false(renderer.rendered.has('S1'), 'Should remove from rendered map')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('updateTable() should not append buttons when no sandboxes exist for sample', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [])
	renderer.updatePlotBtns(sandboxes)

	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	const btns = cell.selectAll('.sjpp-sc-table-plot-btn').nodes()
	test.equal(btns.length, 0, 'Should not append buttons when sandboxes array is empty')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('updateTable() should append plot buttons for each sandbox', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [
		{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' },
		{ plotId: 'p2', div: mockDiv, plotName: 'tSNE' }
	])
	renderer.updatePlotBtns(sandboxes)

	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	const btns = cell.selectAll('.sjpp-sc-table-plot-btn').nodes()
	test.equal(btns.length, 2, 'Should append 2 plot buttons')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('applyButtonsForSample() should find row by sample ID after sort mutation', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const rows = renderer.tableData.rows
	renderer.tableData.rows = [rows[1], rows[0], rows[2]]

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const s1Row = renderer.tableData.rows.find(r => r[renderer.tableData.sampleColIdx].value === 'S1') as any
	const s2Row = renderer.tableData.rows.find(r => r[renderer.tableData.sampleColIdx].value === 'S2') as any
	test.equal(
		s1Row[1].__td.selectAll('.sjpp-sc-table-plot-btn').nodes().length,
		1,
		'Should render button in the moved S1 row'
	)
	test.equal(
		s2Row[1].__td.selectAll('.sjpp-sc-table-plot-btn').nodes().length,
		0,
		'Should not render button in other rows'
	)

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('updateTable() should skip rerendering btn when cell and plotIds are unchanged', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	// Add a marker to verify btn is not re-created
	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	;(btn as any).__marker = true

	// Call again with same data
	renderer.updatePlotBtns(sandboxes)

	const sameBtn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.ok((sameBtn as any).__marker, 'Should preserve existing btn elements (no re-render)')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('updateTable() should re-render when plotIds change', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes1 = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes1.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes1)

	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 1, 'Should have 1 button initially')

	// Change plots for the same sample
	const sandboxes2 = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes2.set('S1', [
		{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' },
		{ plotId: 'p3', div: mockDiv, plotName: 'Violin' }
	])
	renderer.updatePlotBtns(sandboxes2)

	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 2, 'Should re-render with 2 buttons')

	if ((test as any)._ok) holder.remove()
	test.end()
})

/* ---- deleteBtns() ---- */

tape('deleteBtns() should remove buttons and clear rendered entry', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }
	const sandboxes = new Map<string, { plotId: string; div: any; plotName: string }[]>()
	sandboxes.set('S1', [{ plotId: 'p1', div: mockDiv, plotName: 'UMAP' }])
	renderer.updatePlotBtns(sandboxes)

	test.true(renderer.rendered.has('S1'), 'Should have rendered entry before delete')

	renderer.deleteBtns('S1')

	test.false(renderer.rendered.has('S1'), 'Should remove from rendered map')
	const row = renderer.tableData.rows[0] as any
	const cell = row[1].__td
	test.equal(cell.selectAll('.sjpp-sc-table-plot-btn').nodes().length, 0, 'Should remove buttons from table')

	if ((test as any)._ok) holder.remove()
	test.end()
})

/* ---- appendPlotBtn() ---- */

tape('appendPlotBtn() should truncate long plot names', test => {
	const { renderer, holder } = getRenderer()

	// Click first row so __td is populated
	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const cell = (renderer.tableData.rows[0] as any)[1].__td
	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }

	const longName = 'This is a very long plot name that exceeds 25 chars'
	renderer.appendPlotBtn(cell, mockDiv, longName, 'S1')

	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.equal(btn.textContent, 'This is a ve...', 'Should truncate to 12 chars + ...')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('appendPlotBtn() should not truncate short plot names', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const cell = (renderer.tableData.rows[0] as any)[1].__td
	const mockDiv = { node: () => ({ scrollIntoView: () => {} }) }

	renderer.appendPlotBtn(cell, mockDiv, 'UMAP', 'S1')

	const btn = cell.select('.sjpp-sc-table-plot-btn').node() as HTMLElement
	test.equal(btn.textContent, 'UMAP', 'Should show full name for short plot names')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('appendPlotBtn() should scroll sandbox into view on click', test => {
	const { renderer, holder } = getRenderer()

	const firstRow = holder.select('tr.sjpp_row_wrapper').node() as HTMLElement
	firstRow.click()

	const cell = (renderer.tableData.rows[0] as any)[1].__td
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

	if ((test as any)._ok) holder.remove()
	test.end()
})
