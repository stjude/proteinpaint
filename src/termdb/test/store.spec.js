const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	debug: 1,
	fetchOpts: {
		serverData: helpers.serverData
	}
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb store -***-')
	test.end()
})

tape('init errors', function(test) {
	test.timeoutAfter(1000)
	test.plan(3)
	runpp({
		app: {
			callbacks: {
				'postInit.test': testMissingState
			}
		}
	})
	function testMissingState(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state{} missing', 'should be displayed for missing .state{}')
		}, 200)
	}

	runpp({
		state: {},
		app: {
			callbacks: {
				'postInit.test': testMissingGenome
			}
		}
	})
	function testMissingGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state.genome missing', 'should be displayed for missing .state.genome')
		}, 200)
	}

	runpp({
		state: { genome: 'hg38' },
		app: {
			callbacks: {
				'postInit.test': testMissingDslabel
			}
		}
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
