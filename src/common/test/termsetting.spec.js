const tape = require('tape')
const d3s = require('d3-selection')
const termsettingInit = require('../termsetting').termsettingInit

/*********
this is the direct functional testing of the component, without the use of runpp()
this currently doesn't work
will need to figure out how to allow node/browserify to work with import
*/

tape('\n', test => {
	test.pass('-***- common/termsetting -***-')
	test.end()
})

tape.skip('menu', test => {})

tape('disable_ReplaceRemove', test => {
	const pill = termsettingInit({
		holder: d3s.select('body').append('div'),
		genome: 'hg38',
		dslabel: 'SJLife',
		disable_ReplaceRemove: true,
		debug: true,
		callback: data => {
			// some logic here
		}
	})

	pill.main({
		term: {
			id: 'dummy',
			name: 'dummy',
			iscategorical: true,
			values: {
				cat1: { label: 'Cat 1' }
			}
		},
		q: { groupsetting: { inuse: false } }
	})

	// console.log(pill.Inner)
	// test against pill.Inner.dom
	// test.equal(...)
	test.pass('to do ...')
	test.end()
})

tape('use_bins_less', test => {
	const pill = termsettingInit({
		holder: d3s.select('body').append('div'),
		genome: 'hg38',
		dslabel: 'SJLife',
		use_bins_less: true,
		debug: true,
		callback: data => {
			// some logic here
		}
	})

	pill.main({
		term: {
			id: 'dummy',
			name: 'dummy',
			iscategorical: true,
			values: {
				cat1: { label: 'Cat 1' }
			}
		},
		q: { groupsetting: { inuse: false } }
	})

	// console.log(pill.Inner)
	// test against pill.Inner.dom
	// test.equal(...)
	test.pass('to do ...')
	test.end()
})
