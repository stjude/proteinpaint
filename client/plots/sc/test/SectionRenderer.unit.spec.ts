import tape from 'tape'
import { SectionRenderer } from '../view/SectionRenderer.ts'

/**
 * Tests
 *   - constructor should set sections, holder, plotId2Key, and groupBy
 *   - getSampleId() should return sID from subplot.sample
 *   - getSampleId() should return sID from subplot.singleCellPlot.sample
 *   - getSampleId() should return sID from subplot.term.term.sample
 *   - getSampleId() should return undefined when no sID is found
 *   - getPlotName() should return plotName from subplot
 *   - getPlotName() should return name from subplot.singleCellPlot
 *   - getPlotName() should return plot from subplot.term.term
 *   - getPlotName() should return 'Summary' for dictionary chartType
 *   - getPlotName() should return 'Summary' for summary chartType
 *   - getPlotName() should return 'Gene expression' for GeneExpInput chartType
 *   - makeSectionTitleText() should return empty string when groupBy is 'none'
 *   - makeSectionTitleText() should return key when groupBy is 'plot'
 *   - makeSectionTitleText() should return sample info when groupBy is 'sample'
 *   - makeSectionTitleText() should include case and project info when available
 *   - findSampleMetadata() should find item by sample name
 *   - findSampleMetadata() should find item by experiment sampleName
 *   - findSampleMetadata() should return undefined when sc has no items
 *   - findSampleMetadata() should return undefined when no match found
 *   - removeSandbox() should remove sandbox, clean up plotId2Key, and call sc.removeComponent
 *   - removeSandbox() should use provided key over plotId2Key lookup
 *   - removeSandbox() should return early when key is not found
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/view/SectionRender -***-')
	test.end()
})

/* ---- helpers ---- */

function getMockDiv() {
	return {} as any
}

function getMockSCViewer(overrides: any = {}) {
	return {
		id: 'sc1',
		items: overrides.items || [],
		components: { plots: overrides.plots || {} },
		app: {
			dispatch: overrides.dispatch || (() => {}),
			...(overrides.app || {})
		},
		removeComponent: overrides.removeComponent || (() => {}),
		initPlotComponent: overrides.initPlotComponent || (async () => {}),
		...overrides
	} as any
}

/* ---- constructor ---- */

tape('constructor should set sections, holder, plotId2Key, and groupBy', test => {
	const holder = getMockDiv()
	const sr = new SectionRenderer(holder, 'sample')

	test.deepEqual(sr.sections, {}, 'Should initialize sections as empty object')
	test.equal(sr.holder, holder, 'Should set holder')
	test.true(sr.plotId2Key instanceof Map, 'Should initialize plotId2Key as a Map')
	test.equal(sr.plotId2Key.size, 0, 'plotId2Key should be empty')
	test.equal(sr.groupBy, 'sample', 'Should set groupBy')
	test.end()
})

/* ---- getSampleId ---- */

tape('getSampleId() should return sID from subplot.sample', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const subplot = { sample: { sID: 'S1' } }
	test.equal(sr.getSampleId(subplot), 'S1', 'Should extract sID from subplot.sample')
	test.end()
})

tape('getSampleId() should return sID from subplot.singleCellPlot.sample', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const subplot = { singleCellPlot: { sample: { sID: 'S2' } } }
	test.equal(sr.getSampleId(subplot), 'S2', 'Should extract sID from singleCellPlot.sample')
	test.end()
})

tape('getSampleId() should return sID from subplot.term.term.sample', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const subplot = { term: { term: { sample: { sID: 'S3' } } } }
	test.equal(sr.getSampleId(subplot), 'S3', 'Should extract sID from term.term.sample')
	test.end()
})

tape('getSampleId() should return undefined when no sID is found', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	test.equal(sr.getSampleId({}), undefined, 'Should return undefined for empty subplot')
	test.equal(sr.getSampleId({ sample: {} }), undefined, 'Should return undefined when sample has no sID')
	test.end()
})

/* ---- getPlotName ---- */

tape('getPlotName() should return plotName from subplot', test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getPlotName({ plotName: 'UMAP' }), 'UMAP', 'Should return subplot.plotName')
	test.end()
})

tape('getPlotName() should return name from subplot.singleCellPlot', test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getPlotName({ singleCellPlot: { name: 'tSNE' } }), 'tSNE', 'Should return singleCellPlot.name')
	test.end()
})

tape('getPlotName() should return plot from subplot.term.term', test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getPlotName({ term: { term: { plot: 'Violin' } } }), 'Violin', 'Should return term.term.plot')
	test.end()
})

tape("getPlotName() should return 'Summary' for dictionary chartType", test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getPlotName({ chartType: 'dictionary' }), 'Summary', 'Should return Summary for dictionary')
	test.end()
})

tape("getPlotName() should return 'Summary' for summary chartType", test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getPlotName({ chartType: 'summary' }), 'Summary', 'Should return Summary for summary')
	test.end()
})

tape("getPlotName() should return 'Gene expression' for GeneExpInput chartType", test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(
		sr.getPlotName({ chartType: 'GeneExpInput' }),
		'Gene expression',
		'Should return Gene expression for GeneExpInput'
	)
	test.end()
})

/* ---- makeSectionTitleText ---- */

tape("makeSectionTitleText() should return empty string when groupBy is 'none'", test => {
	const sr = new SectionRenderer(getMockDiv(), 'none')
	test.equal(sr.makeSectionTitleText('anyKey'), '', 'Should return empty string for none groupBy')
	test.end()
})

tape("makeSectionTitleText() should return key when groupBy is 'plot'", test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.makeSectionTitleText('UMAP'), 'UMAP', 'Should return the key for plot groupBy')
	test.end()
})

tape("makeSectionTitleText() should return sample info when groupBy is 'sample'", test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const result = sr.makeSectionTitleText('S1')
	test.true(result.includes('Sample: S1'), 'Should include sample id in title')
	test.end()
})

tape('makeSectionTitleText() should include case and project info when available', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const item = { sample: 'CASE1', 'project id': 'PROJ1' } as any
	const result = sr.makeSectionTitleText('S1', item)
	test.true(result.includes('Sample: S1'), 'Should include sample id')
	test.true(result.includes('Case: CASE1'), 'Should include case text')
	test.true(result.includes('Project: PROJ1'), 'Should include project text')
	test.end()
})

/* ---- findSampleMetadata ---- */

tape('findSampleMetadata() should find item by sample name', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const items = [{ sample: 'S1' }, { sample: 'S2' }]
	const sc = getMockSCViewer({ items })
	const result = sr.findSampleMetadata('S2', sc)
	test.deepEqual(result, { sample: 'S2' }, 'Should find matching item by sample')
	test.end()
})

tape('findSampleMetadata() should find item by experiment sampleName', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const items = [{ sample: 'CASE1', experiments: [{ sampleName: 'EXP1' }, { sampleName: 'EXP2' }] }]
	const sc = getMockSCViewer({ items })
	const result = sr.findSampleMetadata('EXP2', sc)
	test.equal(result!.sample, 'CASE1', 'Should find item by experiment sampleName')
	test.end()
})

tape('findSampleMetadata() should return undefined when sc has no items', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const sc = getMockSCViewer({ items: undefined })
	test.equal(sr.findSampleMetadata('S1', sc), undefined, 'Should return undefined when items is undefined')
	test.end()
})

tape('findSampleMetadata() should return undefined when no match found', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const sc = getMockSCViewer({ items: [{ sample: 'S1' }] })
	test.equal(sr.findSampleMetadata('MISSING', sc), undefined, 'Should return undefined for unmatched sampleId')
	test.end()
})

/* ---- removeSandbox ---- */

tape('removeSandbox() should remove sandbox, clean up plotId2Key, and call sc.removeComponent', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	let removedComponent = ''
	const sc = getMockSCViewer({
		removeComponent: (id: string) => {
			removedComponent = id
		}
	})

	const mockSandboxDiv = { remove: () => {} }
	sr.sections['S1'] = {
		sectionWrapper: {} as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: { plot1: mockSandboxDiv }
	}
	sr.plotId2Key.set('plot1', 'S1')

	sr.removeSandbox('plot1', sc)

	test.equal(removedComponent, 'plot1', 'Should call sc.removeComponent with plotId')
	test.equal(sr.sections['S1'].sandboxes['plot1'], undefined, 'Should delete sandbox from sections')
	test.false(sr.plotId2Key.has('plot1'), 'Should delete plotId from plotId2Key')
	test.end()
})

tape('removeSandbox() should use provided key over plotId2Key lookup', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const sc = getMockSCViewer()

	const mockSandboxDiv = { remove: () => {} }
	sr.sections['PROVIDED'] = {
		sectionWrapper: {} as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: { plot1: mockSandboxDiv }
	}
	sr.plotId2Key.set('plot1', 'LOOKUP')

	sr.removeSandbox('plot1', sc, 'PROVIDED')

	test.equal(sr.sections['PROVIDED'].sandboxes['plot1'], undefined, 'Should use provided key')
	test.end()
})

tape('removeSandbox() should return early when key is not found', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	let removedComponent = false
	const sc = getMockSCViewer({
		removeComponent: () => {
			removedComponent = true
		}
	})

	// No sections or plotId2Key entries set up
	sr.removeSandbox('plot1', sc)

	test.true(removedComponent, 'Should still call sc.removeComponent')
	test.equal(sr.plotId2Key.size, 0, 'plotId2Key should remain empty')
	test.end()
})
