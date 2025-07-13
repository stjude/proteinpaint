import tape from 'tape'
import urlmap from '../urlmap'

/*************************
 reusable helper functions
**************************/

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- common/urlmap -***-')
	test.end()
})

tape('valid URL parameters', test => {
	test.deepEqual(
		Object.fromEntries(urlmap('?a=1&b=2')),
		{ a: 1, b: 2 },
		'should correctly parse non-JSON-encoded numeric URL parameters'
	)
	test.deepEqual(
		Object.fromEntries(urlmap('?a="1"&b="2"')),
		{ a: '1', b: '2' },
		'should correctly parse a non-nested, but JSON encoded URL parameters'
	)
	test.deepEqual(
		Object.fromEntries(urlmap(`?a="1"&b=${encodeURIComponent('{"c":[5,6]}')}`)),
		{ a: '1', b: { c: [5, 6] } },
		'should correctly parse a nested, JSON encoded URL parameters'
	)
	test.deepEqual(Object.fromEntries(urlmap('?a=1&&b=2&')), { a: 1, b: 2 }, 'should ignore empty URL parameters')
	test.end()
})

tape('invalid URL parameters', test => {
	{
		let warn
		urlmap('?a="1"&b="2=1"', str => {
			warn = str
		})
		test.equal(
			warn,
			"unexpected '=' character in the URL parameter value for 'b'",
			`should detect invalid an '=' character`
		)
	}
	{
		const message = 'should detect invalid json'
		try {
			urlmap(`?a="1"&b=${encodeURIComponent('{"c":[5,]}')}`, e => {
				throw e
			})
			test.fail(message)
		} catch (e) {
			test.true(e.toString().includes('Unexpected token'), message + ': ' + e.toString())
		}
	}

	test.end()
})
