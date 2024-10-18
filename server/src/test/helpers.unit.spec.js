import tape from 'tape'
import fs from 'fs'
import serverconfig from '../serverconfig.js'
import * as h from '../helpers'

tape('\n', function (test) {
	test.pass('-***- server/helpers specs -***-')
	test.end()
})

tape('joinUrl', test => {
	test.equal(h.joinUrl('', ''), null, 'returns null on blank string')
	test.equal(h.joinUrl('abc', ''), null, 'returns null on blank string')
	test.equal(h.joinUrl('', 'abc'), null, 'returns null on blank string')
	test.equal(h.joinUrl('a?b=c', 'xx'), null, 'search string not supported on p1')
	test.equal(h.joinUrl('/abc/', 'def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('/abc', '/def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('/abc/', '/def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('x://abc/d/e/', '/f/g/'), 'x://abc/d/e/f/g/', 'p1 // is preserved')
	test.equal(h.joinUrl(h.joinUrl('x://abc/d/', 'e/f'), '/g/h/'), 'x://abc/d/e/f/g/h/', '3 pieces joined')
	test.equal(
		h.joinUrl(
			h.joinUrl('https://api.gdc.cancer.gov/', 'ssms'),
			'4fb37566-16d1-5697-9732-27c359828bc7?fields=consequence.transcript.is_canonical,consequence.transcript.transcript_id'
		),
		'https://api.gdc.cancer.gov/ssms/4fb37566-16d1-5697-9732-27c359828bc7?fields=consequence.transcript.is_canonical,consequence.transcript.transcript_id',
		'joined a GDC url'
	)

	test.end()
})
