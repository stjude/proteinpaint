const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- termdb store -***-')
	test.end()
})

tape('error message', function(test) {
	test.plan(2)
	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			callbacks: {
				app: {
					'postRender.test': testMissingGenome
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})
	function testMissingGenome(app) {
		setTimeout(() => {
			test.equal(
				app.Inner.dom.errdiv.selectAll('.sja_errorbar').size(),
				1,
				'should be displayed for missing opts.genome'
			)
		}, 100)
	}

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			genome: 'hg38',
			callbacks: {
				app: {
					'postRender.test': testMissingDslabel
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})

	function testMissingDslabel(app) {
		setTimeout(() => {
			test.equal(
				app.Inner.dom.errdiv.selectAll('.sja_errorbar').size(),
				1,
				'should be displayed for missing opts.dslabel'
			)
		}, 100)
	}
})

tape.skip('state overrides', function(test) {})
