import tape from 'tape'
import { setHostpathOptions, getHostpathOptions, getRetry, clearHostpathOptions } from '#src/xfetch.hostpath.ts'

/*
test sections:
- getHostpathOptions()
- getRetry()
- setHostpathOptions(): hostpath order
- setHostpathOptions(): owners
- setHostpathOptions(): invalid options
*/

tape('\n', test => {
	test.comment('-***- xfetch.hostpath specs -***-')
	test.end()
})

tape('getHostpathOptions()', test => {
	clearHostpathOptions()
	setHostpathOptions({ 'example.com': { networkErrorMessage: 'Example is busy.' } }, 'ds1')
	test.equal(
		getHostpathOptions('https://api.example.com/items?x=1')?.networkErrorMessage,
		'Example is busy.',
		'should match a url that has the hostpath'
	)
	test.equal(getHostpathOptions('https://api.example.org/files'), undefined, 'should not match another host')
	clearHostpathOptions()
	test.end()
})

tape('getRetry()', test => {
	clearHostpathOptions()
	const delay = (n: number) => 1000 * 2 ** (n - 1)
	const retry = { limit: 2, methods: ['GET', 'POST'], delay }
	setHostpathOptions({ 'example.com': { retry } }, 'ds1')

	const r1 = getRetry('https://api.example.com/items')
	test.deepEqual(r1?.methods, ['get', 'post'], 'should lowercase the registered methods')
	test.deepEqual(retry.methods, ['GET', 'POST'], 'should not change the methods of the dataset option')
	test.equal(r1?.delay, delay, 'should use a registered function as given')
	test.equal(getRetry('https://api.example.org/files'), undefined, 'should not have a retry option for another host')

	const r2 = getRetry('https://api.example.com/cases')
	test.notEqual(r2, r1, 'should return a copy of the retry option for each request')
	r2!.methods = ['get']
	test.deepEqual(
		getRetry('https://api.example.com/files')?.methods,
		['get', 'post'],
		'should not change the retry option of a later request when a copy is changed'
	)

	setHostpathOptions({ 'example.com': { networkErrorMessage: 'Example is busy.' } }, 'ds1')
	test.equal(getRetry('https://api.example.com/items'), undefined, 'should not have a retry option without one')
	clearHostpathOptions()
	test.end()
})

tape('setHostpathOptions(): hostpath order', test => {
	clearHostpathOptions()
	setHostpathOptions({ 'example.com': { networkErrorMessage: 'host' } }, 'ds1')
	setHostpathOptions({ 'example.com/query/values': { networkErrorMessage: 'path' } }, 'ds2')
	test.equal(
		getHostpathOptions('https://api.example.com/query/values')?.networkErrorMessage,
		'path',
		'should match a host and path before its host'
	)
	test.equal(
		getHostpathOptions('https://api.example.com/cases')?.networkErrorMessage,
		'host',
		'should match the host for another path'
	)
	clearHostpathOptions()
	test.end()
})

tape('setHostpathOptions(): owners', test => {
	clearHostpathOptions()
	setHostpathOptions({ 'example.com': { networkErrorMessage: 'a' }, 'api.example.org': {} }, 'ds1')
	test.throws(
		() => setHostpathOptions({ 'example.com': { networkErrorMessage: 'b' } }, 'ds2'),
		/already registered by ds1/,
		'should throw for a hostpath that another owner registered'
	)
	test.equal(
		getHostpathOptions('https://api.example.com/cases')?.networkErrorMessage,
		'a',
		'should keep the options after a rejected call'
	)

	setHostpathOptions({ 'example.com': { networkErrorMessage: 'c' } }, 'ds1')
	test.equal(
		getHostpathOptions('https://api.example.com/cases')?.networkErrorMessage,
		'c',
		'should replace the options of the same owner'
	)
	test.equal(
		getHostpathOptions('https://api.example.org/files'),
		undefined,
		'should remove a hostpath that the same owner no longer registers'
	)
	clearHostpathOptions()
	test.end()
})

tape('setHostpathOptions(): invalid options', test => {
	clearHostpathOptions()
	for (const [byHostpath, label] of [
		[[], 'an array instead of an object'],
		[{ '': {} }, 'an empty hostpath'],
		[{ 'example.com': 3 }, 'options that are not an object'],
		[{ 'example.com': { networkErrorMessage: ' ' } }, 'a blank networkErrorMessage'],
		[{ 'example.com': { networkErrorMessage: 3 } }, 'a networkErrorMessage that is not a string'],
		[{ 'example.com': { retry: 3 } }, 'a retry option that is not an object'],
		[{ 'example.com': { retry: { methods: 'post' } } }, 'retry methods that are not an array']
	] as [any, string][]) {
		test.throws(() => setHostpathOptions(byHostpath, 'ds1'), `should throw for ${label}`)
	}
	test.equal(getHostpathOptions('https://api.example.com/cases'), undefined, 'should not register invalid options')
	test.end()
})
