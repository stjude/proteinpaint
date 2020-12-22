const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'SJLife',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/scatter -***-')
	test.end()
})

tape('numeric term + overlay', function(test) {
	test.timeoutAfter(1000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						settings: { currViews: ['scatter'] },
						term: { id: 'aaclassic_5' },
						term2: { id: 'agedx' }
					}
				}
			}
		},
		scatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		testVisibleScatter(scatter)
		test.end()
	}

	function testVisibleScatter(scatter) {
		const div = scatter.Inner.dom.div
		test.equal(div.style('display'), 'block', 'should be visible when term and term2 are both numeric')
	}
})

tape('integer overlay', function(test) {
	test.timeoutAfter(1000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Treatment', 'Chemotherapy', 'Alkylating Agents'],
				visiblePlotIds: ['aaclassic_5'],
				plots: {
					aaclassic_5: {
						settings: { currViews: ['scatter'] },
						term: { id: 'aaclassic_5' },
						term2: { id: 'wgs_sample_age' }
					}
				}
			}
		},
		scatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		scatter.on('postRender.test', null)
		testVisibleScatter(scatter)
		triggerShowControls(scatter)
		testDisplayModeOptions(scatter)
		test.end()
	}

	function testVisibleScatter(scatter) {
		const div = scatter.Inner.dom.div
		test.equal(div.style('display'), 'block', 'should be visible when term and term2 are both numeric')
	}

	function triggerShowControls(scatter) {
		const plot = scatter.Inner.app.getComponents('tree.plots.aaclassic_5')
		plot
			.getComponents('controls.topbar')
			.Inner.features.burgerbtn.Inner.dom.btn.node()
			.click()
	}

	function testDisplayModeOptions(scatter) {
		const controlsConfig = scatter.Inner.app.getComponents('tree.plots.aaclassic_5.controls.config').Inner
		const viewTd = controlsConfig.dom.viewTr.node().lastChild
		const scatterOpt = [
			...viewTd.querySelectorAll(`[name="pp-termdb-display-mode-${controlsConfig.instanceNum}"]`)
		].filter(elem => elem.value === 'scatter')[0]
		if (!scatterOpt) test.fail('missing scatter option in display mode')
		else {
			test.equal(
				scatterOpt.parentNode.parentNode.style.display,
				'inline-block',
				'should be visible as a display mode option when an overlay is numeric'
			)
		}
	}
})
