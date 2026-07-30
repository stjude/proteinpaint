import tape from 'tape'
import { DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV, TermTypes } from '#types'
import { dtTermTypes } from '../terms.js'

/* test sections

dt term types are declared in TermTypes
*/

tape('\n', function (test) {
	test.comment('-***- terms specs -***-')
	test.end()
})

tape('dt term types are declared in TermTypes', t => {
	// TermTypes must list every dt term type at declaration, instead of being filled in at runtime from dtTerms[],
	// so that consumers importing TermTypes from '#types' see the same keys regardless of module load order
	t.deepEqual(
		[...dtTermTypes].sort(),
		[DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV].sort(),
		'the dt term types in dtTerms[] match the DT* constants'
	)
	const termTypeValues = new Set(Object.values(TermTypes))
	for (const dtTermType of dtTermTypes) {
		t.ok(termTypeValues.has(dtTermType), `TermTypes has an entry for '${dtTermType}'`)
	}
	t.end()
})
