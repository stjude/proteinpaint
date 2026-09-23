import tape from 'tape'
import { getSampleList } from '../termdb.js'
import { AuthApi } from '#src/auth/AuthApi.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'termdb-getsamplelist-test-secret' // pragma: allowlist secret
const embedder = 'localhost'
const sampleIds = ['case1', 'case2']

// an api-backed dataset, with a ds-supplied filterSamples() method instead of a sqlite db
function makeApiDs(label: string) {
	return {
		label,
		cohort: {
			termdb: {
				filterSamples: async () => new Set(sampleIds)
			}
		}
	}
}

// pre-shaped credential (the shape after validateDsCredentials has processed it)
function makeProtectedAuthApi(dslabel: string) {
	const creds = {
		[dslabel]: {
			termdb: {
				[embedder]: {
					type: 'jwt',
					secret,
					headerKey: 'x-ds-access-token',
					authRoute: '/jwt-status',
					route: 'termdb',
					cookieId: 'x-ds-access-token',
					dslabel
				}
			}
		}
	}
	return new AuthApi(creds, {}, {}, { port: 3000, cachedir: '/tmp' })
}

function makeReq(dslabel: string) {
	return {
		query: { dslabel, embedder, getsamplelist: 1 },
		path: '/termdb',
		headers: {},
		cookies: {},
		get: () => embedder
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb getSampleList() specs -***-')
	test.end()
})

tape('getSampleList(): api-backed dataset', async function (test) {
	test.timeoutAfter(500)

	const auth = makeProtectedAuthApi('protectedDs')
	{
		const req = makeReq('protectedDs')
		const samples = await getSampleList(req, req.query, makeApiDs('protectedDs'), auth)
		test.deepEqual(samples, [], 'should return no sample ids for a logged-out request to a protected dataset')
	}
	{
		// the same auth api does not have credentials for this dataset
		const req = makeReq('openDs')
		const samples = await getSampleList(req, req.query, makeApiDs('openDs'), auth)
		test.deepEqual(
			samples,
			sampleIds.map(id => ({ id })),
			'should return the sample ids for an open-access dataset'
		)
	}
	{
		// mock a logged-in request, without a displaySampleIds option on the dataset
		const loggedInAuth = {
			canDisplaySampleIds: () => false,
			isUserLoggedIn: () => true,
			mayAdjustFilter: () => {}
		}
		const req = makeReq('protectedDs')
		const samples = await getSampleList(req, req.query, makeApiDs('protectedDs'), loggedInAuth)
		test.deepEqual(
			samples,
			sampleIds.map(id => ({ id })),
			'should return the sample ids for a logged-in request to a protected dataset'
		)
	}
	test.end()
})
