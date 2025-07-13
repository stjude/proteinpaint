import tape from 'tape'
import { negateFilter } from '../filter'

/**************
 test sections
**************

negateFilter

*/

tape('\n', test => {
	test.comment('-***- filter/unit -***-')
	test.end()
})

tape('negateFilter', test => {
	{
		const f = { tag: 'filterUiRoot', in: true }
		const f2 = negateFilter(f)
		test.equal(f2.in, false, 'f.in toggled to false')
		const f3 = negateFilter(f2)
		test.equal(f3.in, true, 'f.in toggled to true')
	}

	{
		const f = {
			type: 'tvslst',
			lst: [
				{ tag: 'othertag', in: true },
				{ tag: 'filterUiRoot', in: true }
			]
		}
		const f2 = negateFilter(f)
		test.equal(f2.lst[1].in, false, 'f.lst[1].in toggled to false')
		const f3 = negateFilter(f, 'othertag')
		test.equal(f3.lst[0].in, false, 'f.lst[0].in toggled to false (by custom tag)')
	}

	// tvslst with single tvs. this is from groups UI generating a custom term by a single group
	{
		const f = {
			type: 'tvslst',
			lst: [{ type: 'tvs', tvs: {} }]
		}
		const f2 = negateFilter(f)
		test.equal(f2.lst[0].tvs.isnot, true, 'f.lst[0].tvs.isnot toggled to true')
	}

	// tvslst with multiple tvs.
	{
		const f = {
			type: 'tvslst',
			in: true,
			lst: [{}, {}]
		}
		const f2 = negateFilter(f)
		test.equal(f2.in, false, 'f.in toggled to false')
	}

	test.throws(() => negateFilter({}), /cannot negate filter/, 'throws')

	test.end()
})
