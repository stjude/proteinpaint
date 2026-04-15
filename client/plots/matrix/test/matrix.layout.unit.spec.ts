import tape from 'tape'
import { copyMerge } from '#rx'
import { getPlotConfig } from '../matrix.config'
import * as matrixLayout from '../matrix.layout'

/*************************
 reusable helper functions
**************************/

async function getObj(opts: any = {}) {
	const app = {
		vocabApi: {
			termdbConfig: {}
		}
	}

	const config = copyMerge(
		{
			devicePixelRatio: 1,
			settings: {
				matrix: {
					availContentHeight: 900
				}
			}
		},
		opts.config || {}
	)

	const obj: any = {
		state: {
			config: await getPlotConfig(config, app)
		},
		sampleOrder: opts.sampleOrder || new Array(5),
		visibleSampleGrps: new Set([1]),
		termOrder: [0, 1, 2, 3, 4, 5],
		termGroups: [{ name: 'test-test' }],
		numClusterTerms: opts.numClusterTerms || 50,
		dom: {
			contentNode: {
				getBoundingClientRect: () => ({ width: opts.boundingWidth || 1000 })
			},
			svg: {
				append: () => ({
					attr() {
						return this
					},
					append() {
						return {
							text() {
								return {
									attr() {
										return this
									},
									node() {
										return {
											getBBox: () => ({ width: 50 })
										}
									}
								}
							}
						}
					},
					remove() {}
				})
			}
		}
	}

	// the functions from matrix.layout are attached directly as
	// methods to an object instance that will become the `this`
	// context within the method
	for (const methodName in matrixLayout) {
		obj[methodName] = matrixLayout[methodName]
	}

	obj.settings = structuredClone(obj.state.config.settings)
	return obj
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/matrix/matrix.layout -***-')
	test.end()
})

tape('100 samples', async test => {
	const obj = await getObj({ sampleOrder: new Array(100) })
	obj.setAutoDimensions(0)
	test.deepEqual(
		obj.computedSettings,
		{
			useCanvas: false,
			colw: 8.3,
			zoomMin: 0.012048192771084336,
			zoomMax: 1.9277108433734937,
			colspace: 1,
			clusterRowh: 18
		},
		`should give the expected computedSettings for 100 samples and ${obj.availContentWidth}px width`
	)
	test.end()
})

tape('100 samples, narrow available width', async test => {
	// narrow width > 600, since matrix.layout hardcodes limit that switches from
	// using div width to document.body.contentWidth
	const obj = await getObj({ sampleOrder: new Array(100), boundingWidth: 634 })
	obj.setAutoDimensions(0)
	test.deepEqual(
		obj.computedSettings,
		{
			useCanvas: false,
			colw: 5.64,
			zoomMin: 0.01773049645390071,
			zoomMax: 2.8368794326241136,
			colspace: 0,
			clusterRowh: 18
		},
		`should give the expected computedSettings for 100 samples and ${obj.availContentWidth}px width`
	)
	test.end()
})

tape('100 samples, content div wider than needed', async test => {
	const obj = await getObj({ sampleOrder: new Array(100), boundingWidth: 2000 })
	obj.setAutoDimensions(0)
	test.deepEqual(
		obj.computedSettings,
		// test that colspace != 0,
		{ useCanvas: false, colw: 16, zoomMin: 0.00625, zoomMax: 1, colspace: 1, clusterRowh: 18 },
		`should give the expected computedSettings for 100 samples and ${obj.availContentWidth}px width, with colspace != 0`
	)
	test.end()
})

tape('1000 cases (simulated GDC gliomas)', async test => {
	// simulate GDC use case that previously led to incorrect imgW,
	// where colWithSpace was incorrectly used with s.colspace = 0
	const obj = await getObj({ sampleOrder: new Array(1000), boundingWidth: 1434 })
	obj.setAutoDimensions(130)
	test.deepEqual(
		obj.computedSettings,
		{
			useCanvas: false,
			colw: 1.234,
			zoomMin: 0.08103727714748785,
			zoomMax: 12.965964343598054,
			colspace: 0,
			clusterRowh: 18
		},
		`should give the expected computedSettings for simulated GDC gliomas hierCluster`
	)
	test.end()
})

tape('4873 cases (simulated ASH)', async test => {
	// simulate GDC use case that previously led to incorrect imgW,
	// where colWithSpace was incorrectly used with s.colspace = 0
	const obj = await getObj({ sampleOrder: new Array(4873), boundingWidth: 1521.96875, numClusterTerms: 36 })
	obj.setAutoDimensions(130)
	test.deepEqual(
		obj.computedSettings,
		{
			useCanvas: true,
			colw: 0.2712843730761338,
			zoomMin: 0.36861688296338324,
			zoomMax: 58.978701274141315,
			colspace: 0,
			clusterRowh: 20
		},
		`should give the expected computedSettings for simulated ASH hierCluster`
	)
	test.end()
})
