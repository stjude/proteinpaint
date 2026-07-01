import tape from 'tape'
import { SectionRenderer } from '../view/SectionRenderer.ts'
import { SubplotManager } from '../subplots/SubplotManager'

/**
 * Tests
 *   - constructor should set sections, holder, plotId2Key, and groupBy
 *   - getSampleId() should return sID from subplot.sample
 *   - getSampleId() should return sID from subplot.singleCellPlot.sample
 *   - getSampleId() should return sID from subplot.term.term.sample
 *   - getSampleId() should return undefined when no sID is found
 *   - getKey() should return 'none' when groupBy is 'none'
 *   - getKey() should return sampleId when groupBy is 'sample'
 *   - getKey() should return plotName when groupBy is 'plot'
 *   - getKey() should return undefined when no value can be determined
 *   - makeSectionTitleText() should return 'All plots' when groupBy is 'none'
 *   - makeSectionTitleText() should return key when groupBy is 'plot'
 *   - makeSectionTitleText() should return sample info when groupBy is 'sample'
 *   - makeSectionTitleText() should include case and project info when available
 *   - findSampleMetadata() should find item by sample name
 *   - findSampleMetadata() should find item by experiment sampleName
 *   - findSampleMetadata() should return undefined when sc has no items
 *   - findSampleMetadata() should return undefined when no match found
 *   - removeSandbox() should remove sandbox and clean up plotId2Key
 *   - removeSandbox() should use provided key over plotId2Key lookup
 *   - removeSandbox() should return early when key is not found
 *   - removeSection() should remove all sandboxes and dispatch app_refresh
 *   - removeSection() should delete section from sections map and remove all elements from dom
 *   - removeSection() should not dispatch when section has no sandboxes
 *   - update() should regroup and return early when groupBy changes
 *   - update() should remove inactive plots and init missing sandboxes
 *   - regroupSections() should reparent active sandbox and remove inactive subplot components
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/view/SectionRenderer -***-')
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
		subplotManager: {
			setSectionKey: overrides.setSectionKey || (() => {}),
			removeSubplot: overrides.removeSubplot || (() => {}),
			initSubplotSandbox: overrides.initSubplotSandbox || (async () => ({ remove: () => {} })),
			...(overrides.subplotManager || {})
		},
		app: {
			dispatch: overrides.dispatch || (() => {}),
			...(overrides.app || {})
		},
		...overrides
	} as any
}

function scWithSubplotManager(opts: any = {}) {
	const sc = getMockSCViewer(opts)
	const sm = new SubplotManager(sc)
	sc.subplotManager = sm
	return sc
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

/* ---- makeSectionTitleText ---- */

tape("makeSectionTitleText() should return 'All plots' when groupBy is 'none'", test => {
	const sr = new SectionRenderer(getMockDiv(), 'none')
	test.equal(sr.makeSectionTitleText('anyKey'), 'All plots', "Should return 'All plots' for none groupBy")
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

tape('removeSandbox() should remove sandbox and clean up plotId2Key', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const sc = getMockSCViewer()

	const mockSandboxDiv = { remove: () => {} }
	sr.sections['S1'] = {
		sectionWrapper: {} as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: { plot1: mockSandboxDiv }
	}
	sr.plotId2Key.set('plot1', 'S1')

	sr.removeSandbox('plot1', sc)

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
	const sc = getMockSCViewer()

	// No sections or plotId2Key entries set up
	sr.removeSandbox('plot1', sc)

	test.equal(sr.plotId2Key.size, 0, 'plotId2Key should remain empty')
	test.end()
})

/* ---- getKey ---- */

tape("getKey() should return 'none' when groupBy is 'none'", test => {
	const sc = scWithSubplotManager()
	const sr = new SectionRenderer(getMockDiv(), 'none')
	test.equal(sr.getKey({ sample: { sID: 'S1' } }, sc), 'none', "Should always return 'none' regardless of subplot")
	test.equal(sr.getKey({}, sc), 'none', "Should return 'none' even for empty subplot")
	test.end()
})

tape("getKey() should return sampleId when groupBy is 'sample'", test => {
	const sc = scWithSubplotManager()
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	test.equal(sr.getKey({ sample: { sID: 'S1' } }, sc), 'S1', 'Should return sID from subplot.sample')
	test.equal(
		sr.getKey({ singleCellPlot: { sample: { sID: 'S2' } } }, sc),
		'S2',
		'Should return sID from singleCellPlot.sample'
	)
	test.equal(
		sr.getKey({ term: { term: { sample: { sID: 'S3' } } } }, sc),
		'S3',
		'Should return sID from term.term.sample'
	)
	test.end()
})

tape("getKey() should return plotName when groupBy is 'plot'", test => {
	const sc = scWithSubplotManager()
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	test.equal(sr.getKey({ plotName: 'UMAP' }, sc), 'UMAP', 'Should return plotName')
	test.equal(sr.getKey({ singleCellPlot: { name: 'tSNE' } }, sc), 'tSNE', 'Should return singleCellPlot.name')
	test.equal(sr.getKey({ chartType: 'dictionary' }, sc), 'Summary', 'Should return Summary for dictionary chartType')
	test.end()
})

tape('getKey() should return undefined when no value can be determined', test => {
	const sc = scWithSubplotManager()
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	test.equal(sr.getKey({}, sc), undefined, 'Should return undefined when sample has no sID')
	test.equal(sr.getKey({ sample: {} }, sc), undefined, 'Should return undefined when sID is missing')
	test.end()
})

/* ---- removeSection ---- */

tape('removeSection() should remove all sandboxes and dispatch app_refresh', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	let dispatched: any = null
	const sc = getMockSCViewer({
		dispatch: (action: any) => {
			dispatched = action
		}
	})
	// Override app.dispatch since getMockSCViewer nests it
	sc.app.dispatch = (action: any) => {
		dispatched = action
	}

	const mockSandbox1 = { remove: () => {} }
	const mockSandbox2 = { remove: () => {} }
	sr.sections['S1'] = {
		sectionWrapper: { remove: () => {} } as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: { plot1: mockSandbox1, plot2: mockSandbox2 }
	}
	sr.plotId2Key.set('plot1', 'S1')
	sr.plotId2Key.set('plot2', 'S1')

	sr.removeSection('S1', sc)

	test.equal(dispatched.type, 'app_refresh', 'Should dispatch app_refresh')
	test.equal(dispatched.subactions.length, 2, 'Should include a subaction for each sandbox')
	test.equal(dispatched.subactions[0].type, 'plot_delete', 'Subaction type should be plot_delete')
	test.equal(dispatched.subactions[0].parentId, 'sc1', 'Subaction parentId should be sc.id')
	test.end()
})

tape('removeSection() should delete section from sections map and remove all elements from dom', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	let wrapperRemoved = false
	const sc = getMockSCViewer()

	const mockSandbox = { remove: () => {} }
	sr.sections['S1'] = {
		sectionWrapper: {
			remove: () => {
				wrapperRemoved = true
			}
		} as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: { plot1: mockSandbox }
	}
	sr.plotId2Key.set('plot1', 'S1')

	sr.removeSection('S1', sc)

	test.equal(sr.sections['S1'], undefined, 'Should delete the section from sections map')
	test.true(wrapperRemoved, 'Should call remove() on sectionWrapper')
	test.false(sr.plotId2Key.has('plot1'), 'Should clean up plotId2Key entries')
	test.end()
})

tape('removeSection() should not dispatch when section has no sandboxes', test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	let dispatched = false
	const sc = getMockSCViewer()
	sc.app.dispatch = () => {
		dispatched = true
	}

	sr.sections['S1'] = {
		sectionWrapper: { remove: () => {} } as any,
		title: {} as any,
		subplots: {} as any,
		sandboxes: {}
	}

	sr.removeSection('S1', sc)

	test.false(dispatched, 'Should not dispatch when there are no sandboxes')
	test.equal(sr.sections['S1'], undefined, 'Should still delete the section')
	test.end()
})

/* ---- update / regroupSections ---- */

tape('update() should regroup and return early when groupBy changes', async test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const sc = scWithSubplotManager()
	let regroupCalled = false
	;(sr as any).regroupSections = (_sc: any, _subplots: any[]) => {
		regroupCalled = true
	}
	await sr.update(sc, [{ id: 'plot1', plotName: 'UMAP' }], 'plot')

	test.equal(sr.groupBy, 'plot', 'Should update groupBy')
	test.true(regroupCalled, 'Should call regroupSections()')
	test.end()
})

tape('update() should remove inactive plots and init missing sandboxes', async test => {
	const sr = new SectionRenderer(getMockDiv(), 'sample')
	const removed: string[] = []
	const initialized: string[] = []
	const sectionKeyUpdates: { plotId: string; key: string }[] = []

	const sc = scWithSubplotManager({ plots: { activePlot: {}, stalePlot: {} } })
	sc.subplotManager.setSectionKey = (plotId: string, key: string) => {
		sectionKeyUpdates.push({ plotId, key })
	}

	;(sr as any).removeSandbox = (plotId: string) => removed.push(plotId)
	sr.getKey = () => 'S1'
	sr.initSection = (key: string) => {
		sr.sections[key] = {
			sectionWrapper: { remove: () => {} } as any,
			title: {} as any,
			subplots: { style: () => 'block' } as any,
			sandboxes: {}
		}
	}
	;(sr as any).initSandbox = async (_sc: any, subplot: any, key: string) => {
		sr.sections[key].sandboxes[subplot.id] = { remove: () => {} } as any
		initialized.push(subplot.id)
	}
	await sr.update(sc, [{ id: 'activePlot', sample: { sID: 'S1' } }], 'sample')

	test.deepEqual(removed, ['stalePlot'], 'Should remove stale component sandboxes')
	test.deepEqual(initialized, ['activePlot'], 'Should initialize missing active sandbox')
	test.equal(sr.plotId2Key.get('activePlot'), 'S1', 'Should track reverse lookup for active subplot')
	test.deepEqual(sectionKeyUpdates, [{ plotId: 'activePlot', key: 'S1' }], 'Should update subplot section key mapping')
	test.end()
})

tape('regroupSections() should reparent active sandbox and remove inactive subplot components', test => {
	const sr = new SectionRenderer(getMockDiv(), 'plot')
	const setSectionKeyCalls: { plotId: string; key: string }[] = []
	const removedSubplots: string[] = []
	const prependedNodes: any[] = []

	const sc = scWithSubplotManager({ plots: { plot1: {}, stalePlot: {} } })
	sc.subplotManager.setSectionKey = (plotId: string, key: string) => setSectionKeyCalls.push({ plotId, key })
	sc.subplotManager.removeSubplot = (plotId: string) => removedSubplots.push(plotId)

	const existingNode = { id: 'existingNode' }
	let detached = 0
	const existingSandbox = {
		remove: () => {
			detached++
		},
		node: () => existingNode
	}

	sr.sections = {
		OLD: {
			sectionWrapper: {} as any,
			title: {} as any,
			subplots: {} as any,
			sandboxes: { plot1: existingSandbox as any }
		}
	}
	sr.plotId2Key.set('plot1', 'OLD')
	;(sr as any).holder = {
		selectAll: () => ({
			remove: () => {}
		})
	}

	sr.initSection = (key: string) => {
		sr.sections[key] = {
			sectionWrapper: {} as any,
			title: {} as any,
			subplots: {
				node: () => ({ prepend: (node: any) => prependedNodes.push(node) })
			} as any,
			sandboxes: {}
		}
	}
	;(sr as any).regroupSections(sc, [{ id: 'plot1', plotName: 'UMAP' }])

	test.equal(detached, 1, 'Should detach existing sandbox from old section')
	test.deepEqual(removedSubplots, ['stalePlot'], 'Should remove inactive subplot components')
	test.deepEqual(prependedNodes, [existingNode], 'Should prepend existing sandbox node into new section')
	test.equal(sr.plotId2Key.get('plot1'), 'UMAP', 'Should update reverse lookup to new key')
	test.equal(sr.sections['UMAP'].sandboxes['plot1'], existingSandbox, 'Should reattach sandbox to regrouped section')
	test.deepEqual(setSectionKeyCalls, [{ plotId: 'plot1', key: 'UMAP' }], 'Should sync subplot section key')
	test.end()
})
