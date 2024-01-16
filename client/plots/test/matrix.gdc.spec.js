const tape = require('tape')
const helpers = require('../../test/front.helpers.js')

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
	test.pass('-***- plots/matrix.gdc (aka OncoMatrix) -***-')
	test.end()
})

tape('2 genes, 2 dict terms', function (test) {
	test.timeoutAfter(5000)
	test.plan(5)
	runpp({
		state: {
			nav: { header_mode: 'hidden' }, // must set to hidden for gdc, since it lacks termdb method to get cohort size..
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
							lst: [
								{ term: { name: 'IDH1', type: 'geneVariant' } },
								{ term: { name: 'EGFR', type: 'geneVariant' } },
								{ id: 'case.disease_type' },
								{ id: 'case.diagnoses.age_at_diagnosis' }
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
		test.equal(matrix.Inner.dom.seriesesG.selectAll('image').size(), 1, `should render 1 <image> element`)
		if (test._ok) matrix.Inner.app.destroy()
		test.end()
	}
})
