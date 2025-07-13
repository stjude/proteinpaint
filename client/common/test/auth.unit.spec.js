import tape from 'tape'
import * as auth from '../auth.js'

/*************************
 reusable helper functions
**************************/

const text2buf = new TextEncoder()

/**************
 test sections
***************/

tape('\n', test => {
	test.comment(`-***- common/auth unit -***-`)
	test.end()
})

tape('setDsAuthOk()', async test => {
	// clear saved tokens by not having 3rd argument
	await auth.setTokenByDsRoute('abc', 'termdb')
	await auth.setTokenByDsRoute('abc', '/**')
	await auth.setTokenByDsRoute('xyz', '/**')

	const opts = {
		dsAuth: [
			{ dslabel: 'abc', route: 'termdb', type: 'basic', insession: false },
			{ dslabel: 'xyz', route: '/**', type: 'basic', insession: true }
		]
	}
	//const fakeDofetch3 = () => ({ status: 'ok' }) // uncomment only if there is a saved token for one of the test dslabels
	await auth.setDsAuthOk(opts /*, fakeDofetch3 */)
	test.equal(auth.isInSession('abc', 'termdb'), false, 'should detect a dslabel that is not in session')
	test.equal(auth.isInSession('xyz', 'fake-route'), true, 'should detect a dslabel that is in session')
	await auth.setTokenByDsRoute(opts.dsAuth[0].dslabel, opts.dsAuth[0].route) // clear jwtByDsRoute[dslabel][route]
	await auth.setTokenByDsRoute(opts.dsAuth[1].dslabel, opts.dsAuth[1].route) // clear jwtByDsRoute[dslabel][route]
	test.end()
})

tape('setTokenByDsRoute()', async test => {
	const dslabel = 'ppp'
	const route = '/**'
	const fakeJwt = `fake-jwt-string`
	await auth.setTokenByDsRoute(dslabel, route)
	await auth.setTokenByDsRoute(dslabel, route, fakeJwt)
	const savedJwt = auth.getSavedToken(dslabel, route)
	test.equal(savedJwt, fakeJwt, `should save a jwt by dslabel and route`)
	await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
	test.end()
})

tape('mayAddJwtToRequest()', async test => {
	{
		const dslabel = 'p2'
		const route = '/**'
		await auth.setTokenByDsRoute(dslabel, route)
		const init = { headers: {} }
		auth.mayAddJwtToRequest(init, { dslabel }, '/fake-route')
		test.equal(init.headers?.authorization, undefined, `should not add JWT, if not set, to request init() option`)
		await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
	}
	{
		const dslabel = 'p3'
		const route = '/**'
		const fakeJwt = `fake-jwt-string`
		await auth.setTokenByDsRoute(dslabel, route, fakeJwt)
		const init = { headers: {} }
		auth.mayAddJwtToRequest(init, { dslabel }, '/fake-route')
		test.equal(
			init.headers?.authorization,
			`Bearer ${btoa(fakeJwt)}`,
			`should add JWT, if set based on request.body.dslabel, to request init() option`
		)
		await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
	}
	{
		const dslabel = 'p4'
		const route = '/**'
		const fakeJwt = `fake-jwt-string`
		await auth.setTokenByDsRoute(dslabel, route, fakeJwt)
		const init = { headers: {} }
		auth.mayAddJwtToRequest(init, {}, `/fake-route?dslabel=${dslabel}`)
		test.equal(
			init.headers?.authorization,
			`Bearer ${btoa(fakeJwt)}`,
			`should add JWT, if set based on URL dslabel, to request init() option`
		)
		await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
	}
	test.end()
})

tape('mayShowAuthUi()', async test => {
	test.timeoutAfter(200)
	test.plan(2)

	const dslabel = 'p5'
	const route = '/**'
	await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]

	const opts = {
		dsAuth: [{ dslabel, route, type: 'basic', insession: false }]
	}
	//const fakeDofetch3 = () => ({ status: 'ok' }) // uncomment only if there is a saved token for one of the test dslabels
	await auth.setDsAuthOk(opts /*, fakeDofetch3*/)

	//await auth.setTokenByDsRoute(dslabel, route, fakeJwt)
	const init = { body: JSON.stringify({ dslabel }) }
	await auth.mayShowAuthUi(init, '/fake-path', {
		setDomRefs: refs => {
			test.true(refs.pwd?.node() instanceof HTMLElement, `should display a password input`)
			test.notEqual(refs.mask?.style('display'), 'none', `should display an overlay mask`)
			refs.mask.remove()
			auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
			test.end()
		}
	})
})

tape('getRequiredAuth()', async test => {
	test.timeoutAfter(200)
	test.plan(1)

	const dslabel = 'p6'
	const route = '/fake-route'
	await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]

	const dsAuthEntry = { dslabel, route, type: 'basic', insession: false }
	const opts = {
		dsAuth: [structuredClone(dsAuthEntry)]
	}
	// const fakeDofetch3 = () => ({ status: 'ok' }) // uncomment only if there is a saved token for one of the test dslabels
	await auth.setDsAuthOk(opts /*, fakeDofetch3*/)
	test.deepEqual(auth.getRequiredAuth(dslabel, route), dsAuthEntry, `should return the expected required auth`)

	await auth.setTokenByDsRoute(dslabel, route) // clear jwtByDsRoute[dslabel][route]
	test.end()
})
