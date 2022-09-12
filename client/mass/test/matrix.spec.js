const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
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

tape.skip('matrix', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'matrix',

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
						} /*{
						name: 'Clinical',
						lst: [{
							term: {id: 'diaggrp', type: 'categorical'},
							q: {mode: 'values'}
						}]
					},*/ /*{
						name: '',
						lst: [{

						}]
					}*/
					],

					samplegroup: [
						{
							name: 'Acute lymphoblastic leukemia',
							filter: {
								type: 'tvs',
								tvs: {
									id: 'diaggrp',
									values: [{ key: 'Acute lymphoblastic leukemia' }]
								}
							}
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
		console.log(73, matrix.Inner)
		matrix.on('postRender.test', null)
		test.fail('should start writing tests')
		test.end()
	}
})
