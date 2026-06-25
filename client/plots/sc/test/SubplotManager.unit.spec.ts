import tape from 'tape'
import { SubplotManager } from '../subplots/SubplotManager'

/**
 * Tests
 *	- constructor should initialize manager state from sc components
 *	- map() should remove stale plots and keep existing sandbox state for active plots
 *	- initSubplot() should derive sample and plot metadata from subplot shape
 *	- removeSubplot() should destroy the component and delete the record
 *	- setSandbox() and setSectionKey() should update existing records only
 *	- getActiveSubplotsFlat() should preserve insertion order
 *	- getSampleId() should read sample ids from supported subplot shapes
 *	- getPlotName() should resolve names from plot metadata and chart types
 *	- getPlotName() should resolve imagePlot labels and defaults
 *	- getSampleSandboxes() should group active plots by sample id
 * */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/subplots/SubplotManager -***-')
	test.end()
})

/* ---- helpers ---- */

function getMockSCViewer(overrides: any = {}) {
	return {
		id: 'sc1',
		components: { plots: overrides.plots || {} },
		viewModel: {
			metaResultIds: overrides.metaResultIds || new Set<string>()
		},
		app: {
			dispatch: overrides.dispatch || (() => {})
		},
		...overrides
	} as any
}

function getMockSubplot(overrides: any = {}) {
	return {
		id: overrides.id || 'plot1',
		plotName: overrides.plotName,
		chartType: overrides.chartType,
		sample: overrides.sample,
		singleCellPlot: overrides.singleCellPlot,
		term: overrides.term,
		...overrides
	}
}

/* ---- constructor ---- */

tape('constructor should initialize manager state from sc components', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)

	test.equal(manager.sc, sc, 'Should keep the SC viewer reference')
	test.equal(manager.scCompPlots, sc.components.plots, 'Should track the shared plots component map')
	test.equal(manager.records.size, 0, 'Should start with no subplot records')
	test.end()
})

/* ---- map / lifecycle ---- */

tape('map() should remove stale plots and keep existing sandbox state for active plots', test => {
	let destroyed = 0
	const activePlotComp = { destroy: () => {} }
	const stalePlotComp = {
		destroy: () => {
			destroyed++
		}
	}
	const sc = getMockSCViewer({
		plots: {
			activePlot: activePlotComp,
			stalePlot: stalePlotComp
		},
		metaResultIds: new Set(['sample-1'])
	})
	const manager = new SubplotManager(sc)
	manager.records.set('activePlot', {
		plotId: 'activePlot',
		sampleId: 'sample-1',
		plotName: 'Old name',
		sectionKey: 'section-a',
		subplot: getMockSubplot({ id: 'activePlot' }),
		sandboxDiv: { id: 'sandbox-a' },
		isMetaResult: true
	} as any)
	manager.records.set('stalePlot', {
		plotId: 'stalePlot',
		plotName: 'Stale',
		subplot: getMockSubplot({ id: 'stalePlot' })
	} as any)

	const result = manager.map([
		getMockSubplot({
			id: 'activePlot',
			plotName: 'Updated name',
			sample: { sID: 'sample-1' }
		})
	])

	test.equal(destroyed, 1, 'Should destroy stale subplot components')
	test.false('stalePlot' in sc.components.plots, 'Should remove stale plot from component map')
	test.false(manager.records.has('stalePlot'), 'Should remove stale subplot record')
	test.equal(result.length, 1, 'Should return only active subplots')
	test.equal(result[0].plotId, 'activePlot', 'Should preserve the active subplot id')
	test.equal(result[0].plotName, 'Updated name', 'Should refresh plot name from the latest subplot data')
	test.equal(result[0].sectionKey, 'section-a', 'Should preserve existing section key')
	test.equal(result[0].sandboxDiv.id, 'sandbox-a', 'Should preserve existing sandbox div')
	test.equal(result[0].isMetaResult, true, 'Should preserve meta result status from the sample id set')
	test.end()
})

tape('initSubplot() should derive sample and plot metadata from subplot shape', test => {
	const sc = getMockSCViewer({ metaResultIds: new Set(['meta-1']) })
	const manager = new SubplotManager(sc)
	manager.records.set('plot1', {
		plotId: 'plot1',
		plotName: 'Previous',
		sectionKey: 'section-1',
		subplot: getMockSubplot({ id: 'plot1' }),
		sandboxDiv: { id: 'sandbox-1' }
	} as any)

	manager.updateSubplotRecord(
		getMockSubplot({
			id: 'plot1',
			singleCellPlot: { name: 'UMAP', sample: { sID: 'meta-1' } }
		})
	)

	const record = manager.records.get('plot1')
	test.equal(record?.sampleId, 'meta-1', 'Should read sample id from singleCellPlot.sample')
	test.equal(record?.plotName, 'UMAP', 'Should prefer singleCellPlot.name for plot name')
	test.equal(record?.sectionKey, 'section-1', 'Should preserve the existing section key')
	test.equal(record?.sandboxDiv.id, 'sandbox-1', 'Should preserve the existing sandbox div')
	test.true(record?.isMetaResult, 'Should flag meta result samples')
	test.end()
})

tape('removeSubplot() should destroy the component and delete the record', test => {
	let destroyed = false
	const sc = getMockSCViewer({
		plots: {
			plot1: {
				destroy: () => {
					destroyed = true
				}
			}
		}
	})
	const manager = new SubplotManager(sc)
	manager.records.set('plot1', {
		plotId: 'plot1',
		plotName: 'UMAP',
		subplot: getMockSubplot({ id: 'plot1' })
	} as any)

	manager.removeSubplot('plot1')

	test.true(destroyed, 'Should destroy the active subplot component')
	test.false(manager.records.has('plot1'), 'Should delete the subplot record')
	test.false('plot1' in sc.components.plots, 'Should delete the component entry')
	test.end()
})

/* ---- setters / getters ---- */

tape('setSandbox() and setSectionKey() should update existing records only', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)
	manager.records.set('plot1', {
		plotId: 'plot1',
		plotName: 'UMAP',
		subplot: getMockSubplot({ id: 'plot1' })
	} as any)

	manager.setSandbox('plot1', { id: 'sandbox-1' })
	manager.setSectionKey('plot1', 'section-1')
	manager.setSandbox('missing', { id: 'ignored' })
	manager.setSectionKey('missing', 'ignored')

	const record = manager.records.get('plot1')
	test.equal(record?.sandboxDiv.id, 'sandbox-1', 'Should store sandbox div on the record')
	test.equal(record?.sectionKey, 'section-1', 'Should store section key on the record')
	test.equal(manager.records.size, 1, 'Should ignore updates for missing records')
	test.end()
})

tape('getActiveSubplotsFlat() should preserve insertion order', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)
	manager.records.set('plot2', {
		plotId: 'plot2',
		plotName: 'B',
		subplot: getMockSubplot({ id: 'plot2' })
	} as any)
	manager.records.set('plot1', {
		plotId: 'plot1',
		plotName: 'A',
		subplot: getMockSubplot({ id: 'plot1' })
	} as any)

	const result = manager.getActiveSubplotsFlat()

	test.equal(result[0].plotId, 'plot2', 'Should return records in map insertion order')
	test.equal(result[1].plotId, 'plot1', 'Should include later records after earlier records')
	test.end()
})

tape('getSampleId() should read sample ids from supported subplot shapes', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)

	test.equal(manager.getSampleId({ sample: { sID: 'S1' } }), 'S1', 'Should read subplot.sample.sID')
	test.equal(
		manager.getSampleId({ singleCellPlot: { sample: { sID: 'S2' } } }),
		'S2',
		'Should read singleCellPlot.sample.sID'
	)
	test.equal(
		manager.getSampleId({ term: { term: { sample: { sID: 'S3' } } } }),
		'S3',
		'Should read term.term.sample.sID'
	)
	test.equal(manager.getSampleId({}), undefined, 'Should return undefined when no sample id exists')
	test.end()
})

tape('getPlotName() should resolve names from plot metadata and chart types', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)

	test.equal(manager.getPlotName({ plotName: 'Custom' }), 'Custom', 'Should prefer subplot.plotName')
	test.equal(manager.getPlotName({ singleCellPlot: { name: 'UMAP' } }), 'UMAP', 'Should prefer singleCellPlot.name')
	test.equal(
		manager.getPlotName({ chartType: 'dictionary' }),
		'Summary',
		'Should normalize dictionary plots to Summary'
	)
	test.equal(manager.getPlotName({ chartType: 'summary' }), 'Summary', 'Should normalize summary plots to Summary')
	test.equal(
		manager.getPlotName({ chartType: 'GeneExpInput' }),
		'Gene expression',
		'Should normalize GeneExpInput plots to Gene expression'
	)
	test.equal(manager.getPlotName({ term: { term: { plot: 'Violin' } } }), 'Violin', 'Should read term.term.plot')
	test.equal(manager.getPlotName({ chartType: 'scatter' }), 'scatter', 'Should fall back to chartType')
	test.end()
})

tape('getPlotName() should resolve imagePlot labels and defaults', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)

	test.equal(
		manager.getPlotName({ chartType: 'imagePlot', imgDir: { label: 'Tumor image' } }),
		'Tumor image',
		'Should use imgDir.label for imagePlot names when present'
	)
	test.equal(manager.getPlotName({ chartType: 'imagePlot' }), 'Image', 'Should default imagePlot names to Image')
	test.end()
})

tape('getSampleSandboxes() should group active plots by sample id', test => {
	const sc = getMockSCViewer()
	const manager = new SubplotManager(sc)
	manager.records.set('plot1', {
		plotId: 'plot1',
		sampleId: 'S1',
		plotName: 'UMAP',
		subplot: getMockSubplot({ id: 'plot1' }),
		sandboxDiv: { id: 'sandbox-1' }
	} as any)
	manager.records.set('plot2', {
		plotId: 'plot2',
		sampleId: 'S1',
		plotName: 'tSNE',
		subplot: getMockSubplot({ id: 'plot2' }),
		sandboxDiv: { id: 'sandbox-2' }
	} as any)
	manager.records.set('plot3', {
		plotId: 'plot3',
		sampleId: 'S2',
		plotName: 'Ignored',
		subplot: getMockSubplot({ id: 'plot3' })
	} as any)

	const sandboxes = manager.getSampleSandboxes()

	test.equal(sandboxes.size, 1, 'Should only include records with both sample and sandbox div')
	test.equal(sandboxes.get('S1')?.length, 2, 'Should group multiple plots for the same sample')
	test.equal(sandboxes.get('S1')?.[0].plotId, 'plot1', 'Should preserve the record plot id')
	test.equal(sandboxes.get('S1')?.[1].plotName, 'tSNE', 'Should preserve the record plot name')
	test.false(sandboxes.has('S2'), 'Should skip entries without a sandbox div')
	test.end()
})
