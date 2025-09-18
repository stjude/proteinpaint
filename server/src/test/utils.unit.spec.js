import tape from 'tape'
import fs from 'fs'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'

/* test sections

stripJsScript
cachedFetch
validateRglst
illegalpath()
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

	test.end()
})
