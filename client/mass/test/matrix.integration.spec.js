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
tape('\n', function (test) {
	test.pass('-***- plots/matrix -***-')
	test.end()
})

tape.only('only dictionary terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(5)
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
									id: 'aaclassic_5',
									q: {
										mode: 'continuous'
									}
								},
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
			1,
			`should render the expected number of cluster rects`
		)
		// select the first series
		const sg0rects = matrix.Inner.dom.seriesesG.select('.sjpp-mass-series-g').selectAll('rect')
		test.equal(
			sg0rects.filter(d => d.key <= 0 && d.fill === 'transparent').size(),
			14,
			`should render special values with transparent rects`
		)
		const uniqueHts = new Set()
		sg0rects.each(d => uniqueHts.add(d.height))
		test.equal(uniqueHts.size, 45, `should render different rect heights for continuous mode bar plots`)

		// TODO: test for matrix bar plots of continuous mode terms with allowed negative value

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})

tape('with divide by terms', function (test) {
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

tape('long column group labels', function (test) {
	test.timeoutAfter(5000)
	test.plan(2)
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
						id: 'diaggrp'
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{ id: 'diaggrp', term: termjson['diaggrp'] },
								{ id: 'agedx', term: termjson['agedx'] },
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
		const y = matrix.Inner.dom.clipRect.property('y').baseVal.value
		test.true(y > -63 && y < -62, `should adjust the clip-path rect y-value to between -39 and -38, actual=${y}`)
		const h = matrix.Inner.dom.clipRect.property('height').baseVal.value
		test.true(h > 619 && h <= 620, `should adjust the clip-path height to between 595 and 596, actual=${h}`)

		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})
