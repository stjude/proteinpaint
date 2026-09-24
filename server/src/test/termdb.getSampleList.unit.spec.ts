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
function makeApiDs(label: string, termdbOpts: any = {}) {
	return {
		label,
		cohort: {
			termdb: {
				filterSamples: async () => new Set(sampleIds),
				...termdbOpts
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

tape('getSampleList(): api-backed dataset with a displaySampleIds option', async function (test) {
	test.timeoutAfter(500)

	const allSamples = sampleIds.map(id => ({ id }))
	// mock a logged-in request, with canDisplaySampleIds() returning the given value
	const makeLoggedInAuth = (canDisplay: boolean) => ({
		canDisplaySampleIds: () => canDisplay,
		isUserLoggedIn: () => true,
		mayAdjustFilter: () => {}
	})
	const req = makeReq('protectedDs')
	{
		const ds = makeApiDs('protectedDs', { displaySampleIds: false })
		const samples = await getSampleList(req, req.query, ds, makeLoggedInAuth(false))
		test.deepEqual(samples, [], 'should return no sample ids for a logged-in request when displaySampleIds is false')
	}
	{
		// a role policy that denies this request
		const ds = makeApiDs('protectedDs', { displaySampleIds: () => false })
		const samples = await getSampleList(req, req.query, ds, makeLoggedInAuth(false))
		test.deepEqual(
			samples,
			[],
			'should return no sample ids for a logged-in request when the role policy returns false'
		)
	}
	{
		const ds = makeApiDs('protectedDs', { displaySampleIds: () => true })
		const samples = await getSampleList(req, req.query, ds, makeLoggedInAuth(true))
		test.deepEqual(samples, allSamples, 'should return the sample ids when the role policy allows this request')
	}
	{
		const ds = makeApiDs('protectedDs', { displaySampleIds: true })
		const samples = await getSampleList(req, req.query, ds, makeLoggedInAuth(true))
		test.deepEqual(samples, allSamples, 'should return the sample ids when displaySampleIds is true')
	}
	{
		// the real AuthApi.canDisplaySampleIds() returns false for displaySampleIds: false
		const auth = makeProtectedAuthApi('protectedDs')
		const openReq = makeReq('openDs')
		const ds = makeApiDs('openDs', { displaySampleIds: false })
		const samples = await getSampleList(openReq, openReq.query, ds, auth)
		test.deepEqual(samples, [], 'should return no sample ids for an open-access dataset with displaySampleIds: false')
	}
	{
		const logoutAuth = { ...makeLoggedInAuth(true), isUserLoggedIn: () => false }
		const ds = makeApiDs('protectedDs', { displaySampleIds: true })
		const samples = await getSampleList(req, req.query, ds, logoutAuth)
		test.deepEqual(samples, [], 'should still require a session when displaySampleIds is true')
	}
	test.end()
})
