import tape from 'tape'
import fs from 'fs'
import serverconfig from '../serverconfig.js'
import * as h from '../helpers'

tape('\n', function (test) {
	test.pass('-***- server/helpers specs -***-')
	test.end()
})

tape('joinUrl', test => {
	test.throws(() => h.joinUrl('', ''), /blank string not allowed/, 'throws on blank string')
	test.throws(() => h.joinUrl('abc', ''), /blank string not allowed/, 'throws on blank string')
	test.throws(() => h.joinUrl('', 'abc'), /blank string not allowed/, 'throws on blank string')
	test.throws(() => h.joinUrl('a?b=c', 'xx'), /search string not allowed/, 'throws on search string')
	test.equal(h.joinUrl('/abc/', 'def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('/abc', '/def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('/abc/', '/def'), '/abc/def', 'url joined')
	test.equal(h.joinUrl('x://abc/d/e/', '/f/g/'), 'x://abc/d/e/f/g/', 'double slash // is preserved')
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
