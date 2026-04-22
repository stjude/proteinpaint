import tape from 'tape'
import { PlotButtons } from '../view/PlotButtons.ts'
import { getMockSCState } from './getMockSCApp.ts'

/**
 * Tests
 *   - constructor should set interactions, scTermdbConfig, and plotBtnsDom
 *   - update() should hide promptDiv when no item is selected
 *   - update() should set data, settings, and item when item is selected
 *   - update() should retain previous data when new data is null
 *   - getChartBtnOpts() should return configured plot buttons
 *   - getChartBtnOpts() Summary button should always be visible
 *   - getChartBtnOpts() Gene expression button should be visible when geneExpression is configured
 *   - getChartBtnOpts() Gene expression button should not be visible when geneExpression is not configured
 *   - getChartBtnOpts() Differential expression button should be visible when DEgenes is configured
 *   - getChartBtnOpts() plot button isVisible() should return false when plot is not in data
 *   - getSingleCellConfig() should return sampleScatter config
 *   - getSingleCellConfig() should throw when no item is selected
 *   - getSingleCellConfig() should throw when plot name is not found
 *   - getSingleCellConfig() should include colorTW when colorColumns are configured
 *   - makeScctTW() should return term wrapper with sample and $id
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/view/PlotButtons -***-')
	test.end()
})

/* ---- helpers ---- */

/** Chainable d3-like mock for Div/Elem */
function getMockDiv() {
	const self: any = {}
	for (const m of ['style', 'text', 'attr', 'on', 'classed']) {
		self[m] = (..._args: any[]) => self
	}
	self.append = (_tag: string) => getMockDiv()
	self.selectAll = (_sel: string) => getMockSelection()
	self.node = () => ({ value: '' })
	return self
}

function getMockSelection() {
	const self: any = {}
	self.data = (_d: any) => self
	self.enter = () => self
	self.remove = () => self
	self.filter = (_fn: any) => self
	for (const m of ['style', 'text', 'attr', 'on', 'append', 'classed']) {
		self[m] = (..._args: any[]) => self
	}
	return self
}

function getMockInteractions(overrides: any = {}) {
	const state = getMockSCState({
		termdbConfig: {
			queries: {
				singleCell: {
					data: {
						plots: [{ name: 'umap' }, { name: 'tsne' }]
					},
					geneExpression: overrides.geneExpression,
					DEgenes: overrides.DEgenes
				}
			},
			...(overrides.termdbConfig || {})
		}
	})
	return {
		id: 'sc1',
		getState: state,
		createSubplot: overrides.createSubplot || (async () => {}),
		...overrides
	} as any
}

function getPlotButtons(overrides: any = {}) {
	const interactions = getMockInteractions(overrides)
	const holder = getMockDiv()
	const pb = new PlotButtons(interactions, holder)
	return pb
}

/* ---- constructor ---- */

tape('constructor should set interactions, scTermdbConfig, and plotBtnsDom', test => {
	const pb = getPlotButtons()

	test.ok(pb.interactions, 'Should set interactions')
	test.equal(pb.interactions.id, 'sc1', 'Should have interactions.id')
	test.ok(pb.scTermdbConfig, 'Should set scTermdbConfig')
	test.deepEqual(
		pb.scTermdbConfig.data.plots.map((p: any) => p.name),
		['umap', 'tsne'],
		'Should have plots from termdbConfig'
	)
	test.ok(pb.plotBtnsDom, 'Should set plotBtnsDom')
	test.ok(pb.plotBtnsDom.promptDiv, 'Should have promptDiv')
	test.ok(pb.plotBtnsDom.selectPrompt, 'Should have selectPrompt')
	test.ok(pb.plotBtnsDom.btnsDiv, 'Should have btnsDiv')
	test.ok(pb.plotBtnsDom.tip, 'Should have tip (Menu)')
	test.end()
})

/* ---- update() ---- */

tape('update() should hide promptDiv when no item is selected', test => {
	const pb = getPlotButtons()
	let displayValue
	;(pb.plotBtnsDom.promptDiv as any).style = (prop: string, val?: string) => {
		if (prop === 'display' && typeof val === 'string' && val !== undefined) {
			displayValue = val
		}
		return pb.plotBtnsDom.promptDiv
	}
	const settings = { sc: { item: undefined } } as any
	pb.update(settings, null)

	test.equal(displayValue, 'none', 'Should hide promptDiv when no item')
	test.end()
})

tape('update() should set data, settings, and item when item is selected', test => {
	const pb = getPlotButtons()
	// Override renderChartBtns to avoid d3 data join in test
	pb.renderChartBtns = () => {}
	const item = { sID: 'S1', eID: 'EXP1' }
	const settings = { sc: { item } } as any
	const data = { plots: [{ name: 'umap' }] }
	pb.update(settings, data)

	test.deepEqual(pb.data, data, 'Should set data')
	test.deepEqual(pb.settings, settings, 'Should set settings')
	test.deepEqual(pb.item, item, 'Should set item')
	test.end()
})

tape('update() should retain previous data when new data is null', test => {
	const pb = getPlotButtons()
	pb.renderChartBtns = () => {}
	const item = { sID: 'S1', eID: 'EXP1' }
	const settings = { sc: { item } } as any
	const data = { plots: [{ name: 'umap' }] }

	pb.update(settings, data)
	pb.update(settings, null)

	test.deepEqual(pb.data, data, 'Should retain previous data when new data is null')
	test.end()
})

/* ---- getChartBtnOpts() ---- */

tape('getChartBtnOpts() should return configured plot buttons', test => {
	const pb = getPlotButtons()
	pb.data = { plots: [{ name: 'umap' }, { name: 'tsne' }] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const labels = btns.map(b => b.label)

	test.ok(labels.includes('umap'), 'Should include umap button')
	test.ok(labels.includes('tsne'), 'Should include tsne button')
	test.ok(labels.includes('Summary'), 'Should include Summary button')
	test.ok(labels.includes('Gene expression'), 'Should include Gene expression button')
	test.ok(labels.includes('Differential expression'), 'Should include Differential expression button')
	test.end()
})

tape('getChartBtnOpts() Summary button should always be visible', test => {
	const pb = getPlotButtons()
	pb.data = { plots: [] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const summary = btns.find(b => b.label === 'Summary')

	test.ok(summary, 'Should have Summary button')
	test.ok(summary!.isVisible(), 'Summary should always be visible')
	test.end()
})

tape('getChartBtnOpts() Gene expression button should be visible when geneExpression is configured', test => {
	const pb = getPlotButtons({ geneExpression: true })
	pb.data = { plots: [] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const geneExp = btns.find(b => b.label === 'Gene expression')

	test.ok(geneExp!.isVisible(), 'Gene expression should be visible when geneExpression is configured')
	test.end()
})

tape('getChartBtnOpts() Gene expression button should not be visible when geneExpression is not configured', test => {
	const pb = getPlotButtons()
	pb.data = { plots: [] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const geneExp = btns.find(b => b.label === 'Gene expression')

	test.notOk(geneExp!.isVisible(), 'Gene expression should not be visible when geneExpression is not configured')
	test.end()
})

tape('getChartBtnOpts() Differential expression button should be visible when DEgenes is configured', test => {
	const pb = getPlotButtons({ DEgenes: { termId: 'cluster' } })
	pb.data = { plots: [] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const de = btns.find(b => b.label === 'Differential expression')

	test.ok(de!.isVisible(), 'Differential expression should be visible when DEgenes is configured')
	test.end()
})

tape('getChartBtnOpts() plot button isVisible() should return false when plot is not in data', test => {
	const pb = getPlotButtons()
	pb.data = { plots: [{ name: 'umap' }] }
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const btns = pb.getChartBtnOpts()
	const umap = btns.find(b => b.label === 'umap')
	const tsne = btns.find(b => b.label === 'tsne')

	test.ok(umap!.isVisible(), 'umap should be visible when in data.plots')
	test.notOk(tsne!.isVisible(), 'tsne should not be visible when not in data.plots')
	test.end()
})

/* ---- getSingleCellConfig() ---- */

tape('getSingleCellConfig() should return sampleScatter config', async test => {
	const pb = getPlotButtons()
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const config = (await pb.getSingleCellConfig('umap')) as any

	test.equal(config.chartType, 'sampleScatter', 'Should set chartType to sampleScatter')
	test.equal(config.name, 'Sample: S1', 'Should set name with sample sID')
	test.deepEqual(config.sample, { sID: 'S1', eID: 'EXP1' }, 'Should include sample')
	test.equal(config.singleCellPlot.name, 'umap', 'Should set singleCellPlot.name')
	test.deepEqual(config.singleCellPlot.sample, { sID: 'S1', eID: 'EXP1' }, 'Should set singleCellPlot.sample')
	test.end()
})

tape('getSingleCellConfig() should throw when no item is selected', async test => {
	const pb = getPlotButtons()
	pb.item = undefined

	try {
		await pb.getSingleCellConfig('umap')
		test.fail('Should have thrown')
	} catch (e: any) {
		test.ok(e.message.includes('No item selected'), 'Should throw "No item selected"')
	}
	test.end()
})

tape('getSingleCellConfig() should throw when plot name is not found', async test => {
	const pb = getPlotButtons()
	pb.item = { sID: 'S1', eID: 'EXP1' }

	try {
		await pb.getSingleCellConfig('nonexistent')
		test.fail('Should have thrown')
	} catch (e: any) {
		test.ok(e.message.includes('No plot by name nonexistent'), 'Should throw when plot name not found')
	}
	test.end()
})

tape('getSingleCellConfig() should include colorTW when colorColumns are configured', async test => {
	const pb = getPlotButtons({
		termdbConfig: {
			queries: {
				singleCell: {
					data: {
						plots: [{ name: 'umap', colorColumns: [{ name: 'cellType' }] }]
					}
				}
			},
			termType2terms: {
				'Single-cell Cell Type': [{ name: 'cellType', plot: 'umap', id: 'ct1' }]
			}
		}
	})
	pb.item = { sID: 'S1', eID: 'EXP1' }

	const config = (await pb.getSingleCellConfig('umap')) as any

	test.ok(config.colorTW, 'Should include colorTW')
	test.ok(config.colorTW.$id, 'Should have $id on colorTW')
	test.deepEqual(config.colorTW.term.sample, { sID: 'S1', eID: 'EXP1' }, 'Should set sample on colorTW term')
	test.end()
})

/* ---- makeScctTW() ---- */

tape('makeScctTW() should return term wrapper with sample and $id', async test => {
	const pb = getPlotButtons({
		termdbConfig: {
			queries: {
				singleCell: {
					data: {
						plots: [{ name: 'umap', colorColumns: [{ name: 'cellType' }] }]
					}
				}
			},
			termType2terms: {
				'Single-cell Cell Type': [{ name: 'cellType', plot: 'umap', id: 'ct1' }]
			}
		}
	})
	const item = { sID: 'S1', eID: 'EXP1' }
	const plot = { name: 'umap', colorColumns: [{ name: 'cellType' }] }

	const tw = await pb.makeScctTW(item, plot)

	test.ok(tw.$id, 'Should have $id')
	test.equal(typeof tw.$id, 'string', '$id should be a string')
	test.deepEqual(tw.term.sample, item, 'Should set sample on term')
	test.equal(tw.term.name, 'cellType', 'Should preserve term name')
	test.equal(tw.term.plot, 'umap', 'Should preserve term plot')
	test.end()
})

tape('makeScctTW() should throw when no matching term is found', async test => {
	const pb = getPlotButtons()
	const item = { sID: 'S1', eID: 'EXP1' }
	const plot = { name: 'umap', colorColumns: [{ name: 'nonexistent' }] }

	try {
		await pb.makeScctTW(item, plot)
		test.fail('Should have thrown')
	} catch (e: any) {
		test.ok(e.message.includes('No term found for colorColumn=nonexistent'), 'Should throw when term not found')
	}
	test.end()
})
