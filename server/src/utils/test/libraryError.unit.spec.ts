import tape from 'tape'
import { libraryErrorText } from '#src/utils/libraryError.ts'

/*
test sections:

libraryErrorText(): the paths in an error message
*/

tape('\n', test => {
	test.comment('-***- libraryError specs -***-')
	test.end()
})

tape('libraryErrorText(): the paths in an error message', test => {
	for (const [message, text] of [
		[
			"ENOENT: no such file or directory, open '/home/root/pp/tp/files/a.gz.tbi'",
			"ENOENT: no such file or directory, open 'a.gz.tbi'"
		],
		['cannot read /data/cache/http/a.org/x.gz/x.gz.tbi: bad magic', 'cannot read x.gz.tbi: bad magic'],
		['(/a/b.fa) and "/c/d.fai"', '(b.fa) and "d.fai"'],
		['/a/b.gz is truncated', 'b.gz is truncated'],
		['HTTP 404 fetching https://a.org/files/x.gz', 'HTTP 404 fetching https://a.org/files/x.gz'],
		['a ratio of 1/2 and ~/x', 'a ratio of 1/2 and ~/x'],
		['invalid tbi magic', 'invalid tbi magic']
	]) {
		test.equal(libraryErrorText(new Error(message)), text, `should give ${JSON.stringify(text)}`)
	}
	test.equal(
		libraryErrorText('/a/b is a string'),
		'/a/b is a string',
		'should keep a string, which is not a library error'
	)
	const o = { a: 1 }
	test.equal(libraryErrorText(o), o, 'should keep a value that is not an error')
	test.end()
})
