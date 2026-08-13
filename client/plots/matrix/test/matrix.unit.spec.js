import tape from 'tape'
import { select } from 'd3-selection'
import { Matrix } from '../matrix'

/*************************
 reusable helper functions
**************************/

const filter0A = { op: 'in', content: { field: 'cases.project.project_id', value: 'TCGA-PAAD' } }
const filter0B = { op: 'in', content: { field: 'cases.project.project_id', value: 'TCGA-LAML' } }

let i = 0

// a minimal matrix instance, with only the properties that are used by
// getState() and mayDisplayCohortMessage(), to avoid a server request
function getMatrix() {
	const id = `_${i++}`
	const holder = select('body').append('div').attr('class', 'sja_root_holder')
	return {
		id,
		app: {
			vocabApi: {
				hasVerifiedToken: () => true,
				tokenVerificationMessage: undefined
			}
		},
		// as assigned in main(), where settings.matrix is filled-in from config.settings
		settings: { matrix: { showHints: ['genesetEdit'] } },
		dom: {
			cohortMsgDiv: holder.append('div').style('display', 'none')
		},
		controlsRenderer: { btns: select(null) },
		getState: Matrix.prototype.getState,
		mayDisplayCohortMessage: Matrix.prototype.mayDisplayCohortMessage
	}
}

function getAppState(filter0) {
	return {
		plots: [],
		termfilter: {
			filter: { type: 'tvslst', join: '', in: 1, lst: [] },
			filter0
		},
		termdbConfig: {},
		vocab: {},
		nav: {},
		groups: []
	}
}

// mimic how rx computes and assigns a component state before calling main()
function update(matrix, filter0) {
	const appState = getAppState(filter0)
	appState.plots.push({ id: matrix.id, settings: { matrix: {} } })
	matrix.state = matrix.getState(appState)
	matrix.mayDisplayCohortMessage()
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/matrix -***-')
	test.end()
})

tape('cohort message on filter0 change', function (test) {
	const matrix = getMatrix()

	// a matrix may be created with a cohort filter already applied, for example when launched
	// from the GDC portal; that initial filter0 must not be detected as a cohort change
	update(matrix, filter0A)
	test.equal(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should not display the cohort message on the initial render with a filter0'
	)

	update(matrix, filter0A)
	test.equal(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should not display the cohort message when filter0 does not change'
	)

	update(matrix, filter0B)
	test.notEqual(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should display the cohort message when filter0 changes'
	)
	test.true(
		matrix.dom.cohortMsgDiv.text().includes('The gene list is persisted across cohorts.'),
		'should display the expected cohort message text'
	)

	update(matrix, filter0B)
	test.equal(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should hide the cohort message on the next update after a cohort change'
	)

	test.end()
})

tape('no cohort message without filter0', function (test) {
	const matrix = getMatrix()

	// non-gdc datasets do not use filter0, the cohort message should never be displayed
	update(matrix, undefined)
	test.equal(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should not display the cohort message on the initial render without a filter0'
	)

	update(matrix, undefined)
	test.equal(
		matrix.dom.cohortMsgDiv.style('display'),
		'none',
		'should not display the cohort message on a subsequent render without a filter0'
	)

	test.end()
})
