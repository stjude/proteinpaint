const tape = require('tape')
const utils = require('../utils')
const fs = require('fs')
const serverconfig = require('../serverconfig')

tape('\n', function (test) {
	test.pass('-***- server/utils specs -***-')
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
