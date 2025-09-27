import tape from 'tape'
import { dtcnv, mclass, mds3tkMclass } from '../common.js'

/* test sections

mds3tkMclass()
*/

tape('\n', function (test) {
	test.comment('-***- mclass specs -***-')
	test.end()
})

tape('mds3tkMclassi()', t => {
	t.deepEqual(
		mds3tkMclass(dtcnv),
		{
			color: '#858585',
			label: 'CNV',
			desc: 'Copy number variation'
		},
		'mds3tkMclass(dtcnv) returns custom object as expected'
	)
	t.deepEqual(mds3tkMclass('E'), mclass['E'], 'mds3tkMclass("E") returns built-in object as mclass["E"]')
	t.end()
})
