import tape from 'tape'
import { FrontendVocab } from '../FrontendVocab'

/*
Tests:
    Missing state.vocab
    ** Comments
        Tested in vocab.unit
            getTermdbConfig()
            getTermChildren()
            findTerm()
            getDescrStats()
            getterm()
            getPercentile()
            graphable()

        Not testing
            syncTermData() - similar enough to termdbvocab not testing
            q_to_param() - exported elsewhere from ./vocabulary. Safe to remove?
            Should be in barchart test
                getNestedChartSeriesData()
                getCategories()

        Not used
            getTermInfo() - perpherial scan, only termdb getTermInfo used
            getCohortSampleCount() - only termdb getCohortSampleCount() used
            getFilteredSampleCount()
            getDensityPlotData()
            getNumericUncomputableCategories()
 */

/**************
 test sections
***************/

/* FrontendVocab tests */
tape('\n', function (test) {
	test.comment('-***- termdb/FrontendVocab -***-')
	test.end()
})

tape('Missing state.vocab', test => {
	test.timeoutAfter(100)

	const app = {
		opts: {
			state: {
				genome: 'hg38-test',
				dslabel: 'TermdbTest'
			}
		}
	}

	const message = 'Should error for missing .vocab'
	try {
		new FrontendVocab({
			app,
			state: app.opts.state
		})
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})
