const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- plots/matrix -***-')
	test.end()
})

tape('only dictionary terms', function(test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			2,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			120,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			1,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('with divide by terms', function(test) {
	test.timeoutAfter(5000)
	test.plan(3)
	runpp({
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						// the matrix autocomputes the colw based on available screen width,
						// need to set an exact screen width for consistent tests using getBBox()
						matrix: {
							availContentWidth: 1200
						}
					},
					divideBy: {
						id: 'sex'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'agedx', term: termjson['agedx'] },
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'aaclassic_5', term: termjson['aaclassic_5'] }
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(matrix) {
		matrix.on('postRender.test', null)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g').size(),
			3,
			`should render the expected number of serieses`
		)
		test.equal(
			matrix.Inner.dom.seriesesG.selectAll('.sjpp-mass-series-g rect').size(),
			180,
			`should render the expected number of cell rects`
		)
		test.equal(
			matrix.Inner.dom.cluster.selectAll('.sjpp-matrix-clusteroutlines rect').size(),
			2,
			`should render the expected number of cluster rects`
		)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})
