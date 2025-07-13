import tape from 'tape'
import { filterTerms } from '../termdb.server.init.ts'
import * as authApi from '../auth'

tape('\n', function (test) {
	test.comment('-***- termdb access control specs -***-')
	test.end()
})

tape('filterTerms()', async function (test) {
	const req = {
		//headers:{authorization:'Bearer mock-token'}, // is this needed?
		query: {
			// lacking dslabel/embedder somehow did not cause auth.getNonsensitiveInfo to throw
		}
	}

	const ds = {
		cohort: {
			termdb: {}
		}
	}
	const terms = [{ id: 'termRole1' }, { id: 'termRole2' }]

	{
		const result = filterTerms(req, ds, terms)
		test.deepEqual(result, terms, 'ds lacks access control and all terms are shown')
	}

	// mock a controller on ds
	ds.cohort.termdb.isTermVisible = (authResult, id) => {
		// FIXME authResult is undefined
		//console.log(2,authResult)
		return id == 'termRole1'
	}

	{
		const result = filterTerms({ query: { dslabel: 'TermdbTest', embedder: 'http://localhost' } }, ds, terms)
		test.deepEqual(result, [terms[0]], '1 term left after filtering')
	}

	test.end()
})
