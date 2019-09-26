const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- app store -***-')
	test.end()
})

tape('opts.genome missing', function(test) {
	test.plan(1)
	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			callbacks: {
				app: {
					'postRender.test': testError
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})
	function testError(app) {
		test.equal(app.Inner.dom.errdiv.selectAll('.sja_errorbar').size(), 1, 'should have printed 1 error')
	}
})
tape('opts.dslabel missing', function(test) {
	test.plan(1)
	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			genome: 'hg38',
			callbacks: {
				app: {
					'postRender.test': testError
				}
			},
			debug: 1,
			fetchOpts: {
				serverData: helpers.serverData
			}
		}
	})
	function testError(app) {
		test.equal(app.Inner.dom.errdiv.selectAll('.sja_errorbar').size(), 1, 'should have printed 1 error')
	}
})
