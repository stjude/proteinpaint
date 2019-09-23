const tape = require("tape")
const d3s = require("d3-selection")
const serverconfig = require('../../../../serverconfig')
const host = "http://localhost:" + serverconfig.port

tape("\n", function(test) {
	test.pass("-***- Tree App -***-")
	test.end()
})

tape('component access', function(test) {
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		treeapptest: {
			dslabel: 'SJLife',
			genome: 'hg38',
			defaultTerms:true,
			callbacks: {
				app: {
					'postInit.test': runTests
				}
			},
		}
	})

	function runTests(app) {
		// is it okay not to delete the callback?
		//app.on('postInit.test', null)
		testComponentAccess1(app)
		test.end()
	}

	function testComponentAccess1(app) {
		test.equal( typeof app, 'object', 'api is object')
	}
})
