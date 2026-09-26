import tape from 'tape'
import fs from 'fs'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'

/* test sections

stripJsScript
cachedFetch
validateRglst
illegalpath()
doUpdateAttr
get_fasta
checkChr
fileurl() argv safety
fileurl() url protocol and host
*/

tape('\n', function (test) {
	test.comment('-***- server/utils specs -***-')
	test.end()
})

tape('stripJsScript', test => {
	/*** ALLOWED ***/
	// allow any one-word gene symbol including the word 'on'
	test.equal(utils.stripJsScript('on'), 'on', "should not change the exact 'on' word")
	// allow 'on=', in case it ever matches an actual data value
	test.equal(utils.stripJsScript('on='), 'on=', "should not change the exact 'on' word immediately followed by '='")
	// allow 'on* [a-zA-Z] ='
	test.equal(
		utils.stripJsScript('onco test='),
		'onco test=',
		"should not change the exact 'onco' word when followed by intervening characters before ending with '='"
	)
	// allow 'pon1=' as a gene symbol with additional nomenclature symbols
	test.equal(utils.stripJsScript('pon1='), 'pon1=', "should not change the exact word 'pon1='")
	// allow TONSL as a gene symbol
	test.equal(
		utils.stripJsScript('TONSL\ttonSL-AS1'),
		'TONSL\ttonSL-AS1',
		'should not change words with the gene symbol TONSL'
	)
	// allow a very long on* word up to 41 characters
	const longword = 'onchangeeventonclickselectinputmouseoverx='
	test.equal(
		utils.stripJsScript(`t ${longword}`),
		`t ${longword}`,
		`should allow a very long word that starts with 'on' (tested length=${longword.length - 1})`
	)

	/*** FORBIDDEN ***/
	// remove script tag
	test.equal(utils.stripJsScript('<sCRipt> test()</script>'), ' _> test()</script>', 'should strip script tags')
	// remove on* event handle keywords, regardless of spacing
	test.equal(
		utils.stripJsScript(" onc='harm()' onerror  =  'harm()' "),
		"  _'harm()'  _  'harm()' ",
		'should strip any on* words that could match an event hande keyword'
	)
	// multiline text
	test.equal(
		utils.stripJsScript(`<script 
			onload='harm()'
		>`),
		` _ 
			 _'harm()'
		>`,
		'should script tag and event handle keyword from multiline text'
	)

	test.end()
})

tape('cachedFetch', async test => {
	const fakeResponse = { body: { test: 1 } }
	const use = {
		metaKey: 'info',
		client: {
			get(url, opts) {
				return fakeResponse
			}
		}
	}
	const { body } = await utils.cachedFetch(`http://fake.org/data?random=${Date.now()}` + Date, {}, use)
	const cachedBody = fs.existsSync(body.info.cacheFile) && fs.readFileSync(body.info.cacheFile).toString('utf-8').trim()
	delete body.info
	test.deepEqual(
		body,
		JSON.parse(cachedBody),
		'should create a cache file in the serverconfig.cachedir with the expected content'
	)
	test.end()
})

tape('validateRglst', test => {
	{
		const rglst = [{ chr: 'x', start: 1, stop: 2 }]
		const q = { rglst: JSON.stringify(rglst) }
		utils.validateRglst(q)
		test.deepEqual(q, { rglst }, 'updates q{} in place to parse stringified rglst')
	}

	test.throws(() => utils.validateRglst({ rglst: 11 }), /q\.rglst\[\] not array/, 'throws with rglst=1')

	test.throws(
		() => utils.validateRglst({ rglst: ['aa'] }),
		/element of q\.rglst\[\] not object/,
		'throws with rglst[0] not object'
	)

	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: 11 }] }),
		/q\.rglst\[\]\.chr not string/,
		'throws with rglst[0].chr not string'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: '1', start: '1' }] }),
		/q\.rglst\[\]\.start not number/,
		'throws with rglst[0].start not number'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: '1', start: -1 }] }),
		/q\.rglst\[\]\.start\<0/,
		'throws with rglst[0].start<0'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: '1', start: 1, stop: -1 }] }),
		/q\.rglst\[\]\.stop\<0/,
		'throws with rglst[0].stop<0'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: '1', start: 10, stop: 1 }] }),
		/q\.rglst\[\]\.stop < start/,
		'throws with rglst[0].stop<start'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: '1', start: 1, stop: 10 }, {}] }),
		/q\.rglst\[\]\.chr not string/,
		'throws with 2nd region err'
	)

	const genome = {
		chrlookup: { XX: { len: 10 } }
	}
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: 'yy' }] }, genome),
		/q\.rglst\[\]\.chr invalid chr name/,
		'throws with rglst[0].chr invalid'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: 'xx', start: 99 }] }, genome),
		/q\.rglst\[\]\.start out of bound/,
		'throws with rglst[0].start out of bound'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: 'xx', start: 1, stop: 99 }] }, genome),
		/q\.rglst\[\]\.stop out of bound/,
		'throws with rglst[0].stop out of bound'
	)
	test.throws(
		() => utils.validateRglst({ rglst: [{ chr: 'xx', start: 1, stop: 10 }, { chr: 'yy' }] }, genome),
		/q\.rglst\[\]\.chr invalid chr name/,
		'throws with 2nd region err'
	)
	test.end()
})

tape('illegalpath()', test => {
	// argument must be sub path relative to tp; returns true for bad path
	test.notOk(utils.illegalpath('ab/cd/'), 'ab/cd/ good')
	test.notOk(utils.illegalpath('!ab/cd/'), '!ab/cd/ good')
	test.notOk(utils.illegalpath('<ab/cd/'), '<ab/cd/ good')
	test.notOk(utils.illegalpath('>ab/cd/'), '>ab/cd/ good')
	test.notOk(utils.illegalpath('#ab/cd/'), '#ab/cd/ good')
	test.notOk(utils.illegalpath('*ab/cd'), '*ab/cd good')
	test.notOk(utils.illegalpath('\\ab/cd/'), '\\ab/cd/ good')

	// begin with root
	test.ok(utils.illegalpath('/ab/cd'), '/ab/cd bad')

	// tracing back with ..
	test.ok(utils.illegalpath('../ab/cd'), '../ab/cd bad')
	test.ok(utils.illegalpath('..ab/cd'), '..ab/cd bad')
	test.ok(utils.illegalpath('ab/../../../cd'), 'ab/../../../cd bad')

	// prohibited characters: " ' | & whitespace
	test.ok(utils.illegalpath('"a/b'), '"a/b bad')
	test.ok(utils.illegalpath("'a/b"), "'a/b bad")
	test.ok(utils.illegalpath('|ab/cd'), '|ab/cd bad')
	test.ok(utils.illegalpath('ab&/cd'), 'ab&/cd bad')
	test.ok(utils.illegalpath(' ab/cd'), ' ab/cd bad')

	test.ok(utils.illegalpath('ab\tcd'), 'tab bad')
	test.ok(utils.illegalpath('ab\ncd'), 'newline bad')
	test.ok(utils.illegalpath('ab\0cd'), 'null byte bad')

	// non-string or empty
	test.ok(utils.illegalpath(''), 'empty string bad')
	test.ok(utils.illegalpath(undefined), 'undefined bad')
	test.ok(utils.illegalpath(['ab/../../cd']), 'array bad')
	test.ok(utils.illegalpath({ ab: 1 }), 'object bad')

	// <script>
	test.ok(utils.illegalpath('<script>/cd'), '<script>/cd bad')
	test.ok(utils.illegalpath('ab/<sCripT>/cd'), 'ab/<sCripT>/cd bad')
	test.ok(utils.illegalpath('</script>/cd'), '</script>/cd bad')
	test.notOk(utils.illegalpath('<cript>/cd'), '<cript>/cd good')

	// by default whiteListPaths is missing; since serverconfig{} is modifiable, assign it
	serverconfig.whiteListPaths = [
		'a/b/c', // simple path
		'm/*/n/*', // wildcard
		// NOTE: entry order is relevant when a negated pattern starts with a similar parent path as other entries
		'x/y/a/*', // will be allowed since it's listed before a negated pattern in the same parent path
		'!x/y/**', // begins with ! for reverse match, will not be allowed
		'x/y/b/*' // will not be allowed since it's listed after a negated pattern in the same parent path
	]
	test.notOk(utils.illegalpath('a/b/c/FI', true), 'a/b/c/FI in white list, good')
	test.notOk(utils.illegalpath('m/x/n/FI', true), 'm/x/n/FI allowed by wildcard, good')
	test.ok(utils.illegalpath('b/c/FI', true), 'b/c/FI not in white list, bad')
	test.ok(utils.illegalpath('a/b/FI', true), 'a/b/FI not in white list, bad')
	test.ok(utils.illegalpath('x/y/FI', true), 'x/y/FI not allowed by reverse match, bad')
	test.notOk(utils.illegalpath('x/y/a/c', true), 'x/y/a/c allowed since it matched a non-negated pattern, good')
	// for safety, negated patterns are only used to identify illegal paths, not matching a negated pattern does NOT imply that a path is legal
	test.ok(
		utils.illegalpath('x/t/1', true),
		`x/t/1 not allowed since it is not explicitly allowed by a non-negated pattern, bad`
	)
	test.ok(
		utils.illegalpath('x/y/b/c', true),
		'x/y/b/c not allowed since it matched a negated pattern before matching an entry for a non-negated pattern, good'
	)

	// blacklist to protect files with certain extension
	test.ok(utils.illegalpath('a/b/c/FI.bam'), 'a/b/c/FI.bam not allowed by blacklisted extension, bad')

	// since serverconfig is loaded once in the same runtime,
	// must clear whitelistPaths that could affect other unit or integration specs
	delete serverconfig.whiteListPaths

	test.end()
})

tape('illegalPathSegment()', test => {
	test.notOk(utils.illegalPathSegment('abc'), 'abc good')
	test.notOk(utils.illegalPathSegment('a.b_at_c.org'), 'a.b_at_c.org good')
	test.notOk(utils.illegalPathSegment('localhost:3000'), 'localhost:3000 good')
	test.notOk(utils.illegalPathSegment('FI.bam'), 'FI.bam good, file extension is not checked')

	test.ok(utils.illegalPathSegment('.'), '. bad')
	test.ok(utils.illegalPathSegment('..'), '.. bad')
	test.ok(utils.illegalPathSegment('ab/cd'), 'ab/cd bad')
	test.ok(utils.illegalPathSegment('ab\\cd'), 'ab\\cd bad')
	test.ok(utils.illegalPathSegment('/ab'), '/ab bad')
	test.ok(utils.illegalPathSegment(''), 'empty string bad')
	test.ok(utils.illegalPathSegment(undefined), 'undefined bad')
	test.ok(utils.illegalPathSegment(['ab']), 'array bad')
	test.end()
})

tape('doUpdateAttr', test => {
	{
		const obj = { key1: 'value1' }
		utils.doUpdateAttr(obj, [['key1', 'xxx']])
		test.equal(obj.key1, 'xxx', 'key1 updated to "xxx"')
		utils.doUpdateAttr(obj, [['key1', 1]])
		test.equal(obj.key1, 1, 'key1 updated to 1')
		utils.doUpdateAttr(obj, [['key1', 0]])
		test.equal(obj.key1, 0, 'key1 updated to 0')
		utils.doUpdateAttr(obj, [['key1', undefined]]) // deletion
		test.equal(obj.key1, undefined, 'key1 is set to undefined')
	}
	{
		// compound obj and multi line update instruction with array
		const obj = {
			key1: { key2: { key3: 'value1' } },
			key4: [{ key5: 'value5' }, { key6: 'value6' }]
		}
		utils.doUpdateAttr(obj, [
			['key1', 'key2', 'key3', 'xxx'],
			['key4', 1, 'key6', 'zzz']
		])
		test.equal(obj.key1.key2.key3, 'xxx', 'key1.key2.key3 updated to "xxx"')
		test.equal(obj.key4[1].key6, 'zzz', 'key4[1].key6 updated to "zzz"')
		utils.doUpdateAttr(obj, [['key1', 'key2', 'xxx']]) // truncation
		test.equal(obj.key1.key2, 'xxx', 'key1.key2 updated to "xxx" replacing {key3:value}')
	}

	test.end()
})

tape('get_fasta', async test => {
	const g = { genomefile: 'NA', chrlookup: { CHR1: { name: 'chr1', len: 1000 } } }
	test.equal(await utils.get_fasta(g, 'chr1:2-4'), '>chr1:2-4\nNNN', 'should return sequence for a valid coord')
	test.equal(await utils.get_fasta(g, 'CHR1:2-4'), '>chr1:2-4\nNNN', 'should use the canonical chr name')
	for (const coord of [
		'-cr/etc/passwd',
		'--fai-idx=/tmp/x',
		'chrX:1-2',
		'chr1:-5-10',
		'chr1:1-2 -o/tmp/x',
		undefined
	]) {
		try {
			await utils.get_fasta(g, coord)
			test.fail(`should reject coord=${coord}`)
		} catch (e) {
			test.equal(e, 'invalid coordinate', `should reject coord=${coord}`)
		}
	}
	test.end()
})

tape('checkChr', test => {
	const g = { chrlookup: { CHR1: { name: 'chr1', len: 1000 } } }
	test.doesNotThrow(() => utils.checkChr(g, 'chr1'), 'should accept a known chr')
	test.doesNotThrow(() => utils.checkChr(g, 'Chr1'), 'should accept a known chr case-insensitively')
	for (const chr of ['-o/tmp/x', '-fc', 'chrX', '', undefined, { a: 1 }]) {
		test.throws(() => utils.checkChr(g, chr), /invalid chr/, `should reject chr=${JSON.stringify(chr)}`)
	}
	test.end()
})

tape('fileurl() argv safety', test => {
	test.deepEqual(
		utils.fileurl({ query: { url: '-o/tmp/x://abcde' } }),
		['url must not start with "-"'],
		'should reject url starting with "-"'
	)
	test.deepEqual(
		utils.fileurl({ query: { url: ['-o/tmp/x', 'https://a.org/b.bam'] } }),
		['url must be a string'],
		'should reject url from a repeated query parameter'
	)
	test.equal(
		utils.fileurl({ query: { url: 'https://a.org/b.bam' } })[1],
		'https://a.org/b.bam',
		'should accept a normal url'
	)
	test.end()
})

tape('fileurl() url protocol and host', test => {
	for (const url of ['/etc/passwd.bb', 'x/y.hic', 'file:///etc/x.bb', 'data://text/plain,abcde'])
		test.equal(utils.fileurl({ query: { url } }).length, 1, `should reject url=${url}`)
	for (const url of [
		'http://localhost/x.bb',
		'http://a.localhost/x.bb',
		'http://127.0.0.1:3000/x.bb',
		'http://2130706433/x.bb', // decimal form of 127.0.0.1
		'http://0x7f.1/x.bb',
		'http://169.254.169.254/latest/meta-data',
		'http://10.1.2.3/x.bb',
		'http://172.16.0.1/x.bb',
		'http://192.168.1.1/x.bb',
		'http://0.0.0.0/x.bb',
		'http://[::1]/x.bb',
		'http://[::ffff:127.0.0.1]/x.bb',
		'http://[fe80::1]/x.bb',
		'http://[fd00::1]/x.bb'
	])
		test.deepEqual(utils.fileurl({ query: { url } }), ['url host is not allowed'], `should reject url=${url}`)
	for (const url of ['https://a.org/b.bb', 'ftp://ftp.a.org/b.bb', 'http://8.8.8.8/b.hic', 'http://172.32.0.1/b.bb'])
		test.equal(utils.fileurl({ query: { url } })[1], url, `should accept url=${url}`)

	serverconfig.urlHosts = ['a.org', '.b.org', '127.0.0.1']
	for (const url of ['https://a.org/x.bb', 'https://c.b.org/x.bb', 'http://127.0.0.1:3000/x.bb'])
		test.equal(utils.fileurl({ query: { url } })[1], url, `should accept url=${url} listed in serverconfig.urlHosts`)
	for (const url of ['https://c.a.org/x.bb', 'https://b.org/x.bb', 'https://xb.org/x.bb', 'http://localhost/x.bb'])
		test.deepEqual(
			utils.fileurl({ query: { url } }),
			['url host is not allowed'],
			`should reject url=${url} not listed in serverconfig.urlHosts`
		)
	delete serverconfig.urlHosts
	test.end()
})
