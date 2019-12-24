const tape = require('tape')
const d3s = require('d3-selection')
const filterInit = require('../filter').filterInit

/*********

run it as:
$ npx watchify filter.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

tape('\n', test => {
	test.pass('-***- the recursive filter -***-')
	test.end()
})

tape('dummy test', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')

	const api = filterInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		debug: true,
		callback: () => {}
	})

	await api.main({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'diaggrp',
						name: 'Diagnosis group',
						iscategorical: true
					},
					values: [{ key: 'ALL', label: 'Acute lymphoblastic leukemia' }]
				}
			},

			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'sex',
						name: 'Sex',
						iscategorical: true
					},
					values: [{ key: '0', label: 'Male' }]
				}
			}
		]
	})

	test.equal(api.Inner.dom.toggle_emptyAdd.style('display'), 'none', 'toggle_emptyAdd <div> is hidden')
	const glancediv = api.Inner.dom.toggle_glanceDiv
	test.equal(glancediv.style('display'), 'block', 'toggle_glanceDiv <div> is visible')

	glancediv.node().click()

	const tipd = api.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking glanceDiv')

	const clickbtn_bottom_and = tipd.node().querySelectorAll('.clickbtn_bottom_and')[0]
	const clickbtn_bottom_or = tipd.node().querySelectorAll('.clickbtn_bottom_or')[0]
	test.ok(clickbtn_bottom_and, 'shows the "clickbtn_bottom_and" button')
	test.ok(clickbtn_bottom_or, 'shows the "clickbtn_bottom_or" button')

	test.end()
})
