import tape from 'tape'
import { joinUrl } from '../joinUrl.js'

tape('\n', function (test) {
	test.comment('-***- #shared/joinUrl -***-')
	test.end()
})

tape('joinUrl', test => {
	test.throws(() => joinUrl(1, ''), /first argument must be string type/, 'throws on non-string argument')
	test.throws(() => joinUrl('', ''), /blank string not allowed/, 'throws on blank string')
	test.throws(() => joinUrl('abc', ''), /blank string not allowed/, 'throws on blank string')
	test.throws(() => joinUrl('', 'abc'), /blank string not allowed/, 'throws on blank string')
	test.throws(() => joinUrl('a?b=c', 'xx'), /search string not allowed/, 'throws on search string')
	test.equal(joinUrl('/abc/', 'def'), '/abc/def', 'url joined')
	test.equal(joinUrl('/abc', '/def'), '/abc/def', 'url joined')
	test.equal(joinUrl('/abc/', '/def'), '/abc/def', 'url joined')
	test.equal(joinUrl('x://abc/d/e/', '/f/g/'), 'x://abc/d/e/f/g/', 'double slash // is preserved')
	test.equal(joinUrl('x://abc/d/', 'e/f', '/g/h/'), 'x://abc/d/e/f/g/h/', '3 pieces joined')
	test.equal(
		joinUrl(
			joinUrl('https://api.gdc.cancer.gov/', 'ssms'),
			'4fb37566-16d1-5697-9732-27c359828bc7?fields=consequence.transcript.is_canonical,consequence.transcript.transcript_id'
		),
		'https://api.gdc.cancer.gov/ssms/4fb37566-16d1-5697-9732-27c359828bc7?fields=consequence.transcript.is_canonical,consequence.transcript.transcript_id',
		'joined a GDC url'
	)

	test.end()
})
