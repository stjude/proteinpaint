import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../singleCellCellType.ts'
import { TermTypeGroups, SINGLECELL_CELLTYPE } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

function getUsecase(plotName = 'Plot A') {
	return {
		target: 'sampleScatter',
		detail: 'term',
		specialCase: {
			config: { name: plotName }
		}
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/singleCellCellType -***-')
	test.end()
})

tape('validateOpts() should require callback, termType2terms, and specialCase.config.name', test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				app: { vocabApi: { termdbConfig: { termType2terms: {} } } },
				usecase: getUsecase('Plot A')
			}),
		/callback is required/,
		'Should throw when callback is missing'
	)

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				callback: () => {},
				app: { vocabApi: { termdbConfig: {} } },
				usecase: getUsecase('Plot A')
			}),
		/termType2terms is required in termdbConfig for singleCellCellType handler/,
		'Should throw when termType2terms is missing'
	)

	test.throws(
		() =>
			handler.validateOpts({
				holder,
				callback: () => {},
				app: {
					vocabApi: {
						termdbConfig: {
							termType2terms: {
								[TermTypeGroups.SINGLECELL_CELLTYPE]: []
							}
						}
					}
				},
				usecase: { target: 'sampleScatter', detail: 'term' }
			}),
		/usecase\.specialCase\.config\.name defining the plot is required/,
		'Should throw when plot name is missing'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should render only terms matching usecase plot and call callback on click', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	let selectedTerm: any
	const scctTerms = [
		{ id: 't1', name: 'Myeloid', type: SINGLECELL_CELLTYPE, plot: 'Plot A' },
		{ id: 't2', name: 'Lymphoid', type: SINGLECELL_CELLTYPE, plot: 'Plot A' },
		{ id: 't3', name: 'Nonmatching', type: SINGLECELL_CELLTYPE, plot: 'Plot B' }
	]

	await handler.init({
		holder,
		callback: t => {
			selectedTerm = t
		},
		app: {
			vocabApi: {
				termdbConfig: {
					termType2terms: {
						[TermTypeGroups.SINGLECELL_CELLTYPE]: scctTerms
					}
				}
			}
		},
		usecase: getUsecase('Plot A')
	})

	const labels = holder.selectAll('.termlabel')
	test.equal(labels.size(), 2, 'Should render only two matching terms for Plot A')
	test.deepEqual(
		labels.nodes().map((n: any) => n.textContent),
		['Myeloid', 'Lymphoid'],
		'Should render labels in the filtered order'
	)

	const firstLabel: any = labels.nodes()[0]
	firstLabel.click()
	test.equal(selectedTerm?.id, 't1', 'Should pass clicked term object to callback')
	test.equal(selectedTerm?.type, SINGLECELL_CELLTYPE, 'Callback term type should be singleCellCellType')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should render sayerror when termType2terms key is missing for singleCellCellType', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	await handler.init({
		holder,
		callback: () => {},
		app: {
			vocabApi: {
				termdbConfig: {
					termType2terms: {
						[TermTypeGroups.DICTIONARY_VARIABLES]: []
					}
				}
			}
		},
		usecase: getUsecase('Plot A')
	})

	const errorDiv = holder.select('.sja_errorbar').node()
	test.ok(errorDiv, 'Should render an error message when singleCellCellType terms are missing')
	test.ok(
		holder
			.text()
			.includes(
				`termType2terms[${TermTypeGroups.SINGLECELL_CELLTYPE}]:[] is required in termdbConfig for singleCellCellType handler`
			),
		'Should show expected configuration error text'
	)
	test.equal(holder.selectAll('.termlabel').size(), 0, 'Should not render term labels when config is missing')

	if (test['_ok']) holder.remove()
	test.end()
})
