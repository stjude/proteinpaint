const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- tdb.tree -***-')
	test.end()
})

tape('error handling', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'ahg38'
			},
			callbacks: {
				app: {
					'postRender.test': testWrongGenome
				}
			},
			debug: 1,
			serverData: helpers.serverData
		},
		serverData: helpers.serverData
	})
	function testWrongGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		test.equal(d.text(), 'Error: invalid genome', 'should show for invalid genome')
	}
	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'xxx',
				genome: 'hg38'
			},
			callbacks: {
				app: {
					'postRender.test': testWrongDslabel
				}
			},
			debug: 1,
			serverData: helpers.serverData
		},
		serverData: helpers.serverData
	})
	function testWrongDslabel(app) {
		const d = app.Inner.dom.errdiv.select('.sja_errorbar').select('div')
		test.equal(d.text(), 'Error: invalid dslabel', 'should show for invalid dslabel')
	}
})

tape('default view', function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'hg38'
			},
			callbacks: {
				tree: {
					'postInit.test': runTests
				}
			},
			debug: 1,
			serverData: helpers.serverData
		},
		serverData: helpers.serverData
	})

	function runTests(tree) {
		tree.on('postInit.test', null)
		helpers
			.rideInit({ arg: tree })
			.run(testDom, 200)
			.done(() => test.end())
	}

	function testDom(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 4, 'should have 4 root terms')
	}
})

tape('rehydrated from saved state', function(test) {
	test.timeoutAfter(1000)
	test.plan(2)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'hg38',
				tree: {
					expandedTerms: ['root', 'Cancer-related Variables', 'Diagnosis']
				}
			},
			callbacks: {
				tree: {
					'postInit.test': runTests
				}
			},
			debug: 1,
			serverData: helpers.serverData
		},
		serverData: helpers.serverData
	})

	function runTests(tree) {
		tree.on('postInit.test', null)
		helpers
			.rideInit({ arg: tree })
			.run(testDom, 200)
			.done(() => test.end())
	}

	function testDom(tree) {
		test.equal(tree.Inner.dom.holder.selectAll('.termdiv').size(), 9, 'should have 9 expanded terms')
		test.equal(tree.Inner.dom.holder.selectAll('.termbtn').size(), 7, 'should have 7 term toggle buttons')
	}
})
