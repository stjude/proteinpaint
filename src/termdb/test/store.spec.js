const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- termdb store -***-')
	test.end()
})

tape('init errors', function(test) {
	test.timeoutAfter(1000)
	test.plan(3)
	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			callbacks: {
				app: {
					'postInit.test': testMissingState
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		},
		serverData: helpers.serverData
	})
	function testMissingState(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state{} missing', 'should be displayed for missing .state{}')
		}, 200)
	}

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {},
			callbacks: {
				app: {
					'postInit.test': testMissingGenome
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		},
		serverData: helpers.serverData
	})
	function testMissingGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state.genome missing', 'should be displayed for missing .state.genome')
		}, 200)
	}

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: { genome: 'hg38' },
			callbacks: {
				app: {
					'postInit.test': testMissingDslabel
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		},
		serverData: helpers.serverData
	})
	function testMissingDslabel(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state.dslabel missing', 'should be displayed for missing .state.dslabel')
			test.end()
		}, 400)
	}
})

tape.skip('state overrides', function(test) {})
