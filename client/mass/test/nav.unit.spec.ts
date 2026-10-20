import tape from 'tape'
import { getUserTabMid } from '../nav.ts'

/**
 * Tests
 *  - getUserTabMid()
 */

const requiredAuth = [{ route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token' }]

tape('\n', test => {
	test.comment('-***- mass/nav -***-')
	test.end()
})

tape('getUserTabMid()', test => {
	test.equal(
		getUserTabMid({ requiredAuth, clientAuthResult: { role: 'admin' } }),
		'ADMIN',
		'should show the role in upper case'
	)
	test.equal(getUserTabMid({ clientAuthResult: { role: 'admin' } }), '', 'should not show a role without requiredAuth')
	test.equal(
		getUserTabMid({ requiredAuth: [], clientAuthResult: { role: 'admin' } }),
		'',
		'should ignore an empty requiredAuth'
	)
	test.equal(getUserTabMid({ requiredAuth }), '', 'should be empty without clientAuthResult')
	test.equal(
		getUserTabMid({ requiredAuth, clientAuthResult: { role: 5 } }),
		'',
		'should ignore a role that is not a string'
	)
	test.equal(getUserTabMid(undefined), '', 'should be empty without termdbConfig')
	test.equal(
		getUserTabMid({ requiredAuth, clientAuthResult: { full: { role: 'admin' }, abbrev: { role: 'public' } } }),
		'',
		'should not pick a role from a nested cohort entry'
	)
	test.end()
})
