import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'GDC',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections

2 genes, 2 dict terms
***************/
tape('\n', function (test) {
	test.pass('-***- plots/hierCluster.gdc -***-')
	test.end()
})

tape('TME genes, 3 variables', function (test) {
	test.timeoutAfter(60000)
	test.plan(14)
	runpp({
		state: {
			nav: { header_mode: 'hidden' }, // must set to hidden for gdc, since it lacks termdb method to get cohort size..
			plots: [
				{
					chartType: 'hierCluster',
					settings: {
						hierCluster: {
							termGroupName: 'Gene Expression (CGC genes only)'
						}
					},
					genes: [
						{ gene: 'KIF11' },
						{ gene: 'BUB1B' },
						{ gene: 'BUB1' },
						{ gene: 'CDK1' },
						{ gene: 'CDC20' },
						{ gene: 'AURKB' },
						{ gene: 'TPX2' },
						{ gene: 'CCNB2' },
						{ gene: 'CCNA2' },
						{ gene: 'TOP2A' },
						{ gene: 'AURKA' },
						{ gene: 'KIF20A' },
						{ gene: 'KIF2C' },
						{ gene: 'CDCA8' }
					],
					termgroups: [
						{
							name: 'Variables',
							lst: [{ id: 'case.disease_type' }, { id: 'case.primary_site' }, { id: 'case.demographic.gender' }]
						}
					]
				}
			]
		},
		hierCluster: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(hierCluster) {
		hierCluster.on('postRender.test', null)
		await testhierClusterrendering(hierCluster)
		await testLegendRendering(hierCluster)
		await testBtnRendering(hierCluster)
		await testZoom(hierCluster)
		await testCaseLabelCharLimit(hierCluster)
		await testClusteringMethod(hierCluster)
		await testRowColumnDendrograms(hierCluster)
		await testzScoreCap(hierCluster)

		// if (test._ok) hierCluster.Inner.app.destroy()
		test.end()
	}

	async function testhierClusterrendering(hierCluster) {
		await detectOne({ elem: hierCluster.Inner.dom.seriesesG.node(), selector: 'image' })
		test.equal(hierCluster.Inner.dom.seriesesG.selectAll('image').size(), 1, `should render 1 <image> element`)
		test.equal(
			hierCluster.Inner.dom.svg.selectAll('.sjpp-matrix-term-label-g').node().querySelectorAll('text').length,
			17,
			`should render 17 <series> elements`
		)
		test.pass('hierCluster rendered')
	}

	async function testLegendRendering(hierCluster) {
		test.true(hierCluster.Inner.dom.legendG.nodes().length > 0, `should render legend`)
		test.true(hierCluster.Inner.dom.legendG.selectAll('rect').size() > 0, `should render legend rects`)
		test.true(hierCluster.Inner.dom.legendG.selectAll('text').size() > 0, `should render legend text`)
	}

	async function testBtnRendering(hierCluster) {
		test.equal(hierCluster.Inner.dom.controls.node().querySelectorAll('button').length, 9, `should render buttons`)
	}

	async function testZoom(hierCluster) {
		//test zoom in feature
		await hierCluster.Inner.app.dispatch({
			type: 'plot_edit',
			id: hierCluster.Inner.id,
			config: {
				settings: {
					hierCluster: {
						zoomLevel: 10
					},
					//note zoom works via matrix settings, not hierCluster
					matrix: {
						zoomLevel: 10
					}
				}
			}
		})
		test.equal(
			hierCluster.Inner.config.settings.hierCluster.zoomLevel,
			10,
			`config.settings.hiercluster.zoomlevel does not allow zoom in on the UI`
		)
		test.equal(
			hierCluster.Inner.config.settings.matrix.zoomLevel,
			10,
			`config.settings.matrix.zoomlevel allows zoom in on the UI`
		)
	}

	async function testCaseLabelCharLimit(hierCluster) {
		// test Case Label character limit feature
		await hierCluster.Inner.app.dispatch({
			type: 'plot_edit',
			id: hierCluster.Inner.id,
			config: {
				settings: {
					matrix: {
						collabelmaxchars: 10
					}
				}
			}
		})
		test.equal(
			hierCluster.Inner.config.settings.matrix.collabelmaxchars,
			10,
			`should limit case label characters to ${hierCluster.Inner.config.settings.matrix.collabelmaxchars}`
		)
	}

	async function testClusteringMethod(hierCluster) {
		// test clustering method feature
		await hierCluster.Inner.app.dispatch({
			type: 'plot_edit',
			id: hierCluster.Inner.id,
			config: {
				settings: {
					hierCluster: {
						clusterMethod: 'complete'
					}
				}
			}
		})
		test.equal(
			hierCluster.Inner.config.settings.hierCluster.clusterMethod,
			'complete',
			`should change clustering method to ${hierCluster.Inner.config.settings.hierCluster.clusterMethod}`
		)
	}

	async function testRowColumnDendrograms(hierCluster) {
		//test column dendrogram height and row dendrogram width
		await hierCluster.Inner.app.dispatch({
			type: 'plot_edit',
			id: hierCluster.Inner.id,
			config: {
				settings: {
					hierCluster: {
						colDendrogramHeight: 100,
						rowDendrogramWidth: 200
					}
				}
			}
		})
		test.equal(
			hierCluster.Inner.config.settings.hierCluster.colDendrogramHeight,
			100,
			`should change column dendrogram height to ${hierCluster.Inner.config.settings.hierCluster.colDendrogramHeight}`
		)
		test.equal(
			hierCluster.Inner.config.settings.hierCluster.rowDendrogramWidth,
			200,
			`should change row dendrogram width to ${hierCluster.Inner.config.settings.hierCluster.rowDendrogramWidth}`
		)
	}

	async function testzScoreCap(hierCluster) {
		//test zscore cap feature
		await hierCluster.Inner.app.dispatch({
			type: 'plot_edit',
			id: hierCluster.Inner.id,
			config: {
				settings: {
					hierCluster: {
						zScoreCap: 10
					}
				}
			}
		})
		test.equal(
			hierCluster.Inner.config.settings.hierCluster.zScoreCap,
			10,
			`should cap zscore at ${hierCluster.Inner.config.settings.hierCluster.zScoreCap}`
		)
	}
})
