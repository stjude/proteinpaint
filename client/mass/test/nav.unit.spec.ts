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

	// a role per cohort
	const selectCohort = { values: [{ keys: ['abbrev'] }, { keys: ['full'] }] }
	const clientAuthResult = { abbrev: { role: 'user' }, full: { role: 'admin' } }
	test.equal(
		getUserTabMid({ requiredAuth, selectCohort, clientAuthResult }, 0),
		'USER',
		'should show the role of the first active cohort'
	)
	test.equal(
		getUserTabMid({ requiredAuth, selectCohort, clientAuthResult }, 1),
		'ADMIN',
		'should show the role of the second active cohort'
	)
	for (const activeCohort of [-1, 2, undefined]) {
		test.equal(
			getUserTabMid({ requiredAuth, selectCohort, clientAuthResult }, activeCohort),
			'',
			`should be empty for activeCohort=${activeCohort}`
		)
	}
	test.equal(
		getUserTabMid({ requiredAuth, selectCohort, clientAuthResult: { full: { role: 'admin' } } }, 0),
		'',
		'should be empty without a role for the active cohort'
	)
	test.equal(
		getUserTabMid({ selectCohort, clientAuthResult }, 1),
		'',
		'should not show a cohort role without requiredAuth'
	)
	test.equal(
		getUserTabMid({ requiredAuth, selectCohort, clientAuthResult: { ...clientAuthResult, role: 'public' } }, 1),
		'PUBLIC',
		'should prefer the role for the dataset'
	)
	test.end()
})
