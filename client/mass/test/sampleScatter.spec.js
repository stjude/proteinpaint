'use strict'
const tape = require('tape')
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38'
		}
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('initial tests', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					term: {
						id: 'diaggrp'
					},
					plot: { file: 'files/hg19/pnet/classification/methylome_tsne.csv', name: 'Methylome TSNE' }
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		console.log('running test...')
		testSymbolCount(scatter)
		//testAxisDimension(scatter)
		//test.fail('...')
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	let scatterDiv
	function testSymbolCount(scatter) {
		scatterDiv = scatter.Inner.dom.div
		const minSymbols = 50
		const numSymbols = scatterDiv.selectAll('circle').size()
		test.true(
			numSymbols > minSymbols,
			`There are ${numSymbols} circles. It should have more than ${minSymbols} scatter circles`
		)
	}
})
