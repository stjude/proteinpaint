const tape = require('tape')
const d3s = require('d3-selection')
const TVSInit = require('../tvs').TVSInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify tvs.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

/*************************
 reusable helper functions
**************************/

function getOpts(_opts = {}) {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')
		.style('border', '1px solid #000')
		.style('max-width', '500px')

	const opts = Object.assign({ holder }, _opts)

	opts.tvs = TVSInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		debug: true,
		callback: function(tvs) {
			opts.tvsData = tvs
			opts.tvs.main(opts.tvsData)
		}
	})

	return opts
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/tvs -***-')
	test.end()
})

tape('tvs (common): buttons', async test => {
	const opts = getOpts({
		tvsData: {
			term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
			values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
		}
	})

	await opts.tvs.main(opts.tvsData)

	test.equal(opts.holder.node().querySelectorAll('.tvs_pill').length, 1, 'should have one filter buttons')

	test.equal(
		opts.holder.node().querySelectorAll('.term_name_btn')[0].innerHTML,
		opts.tvsData.term.name,
		'should label the pill with the correct term name'
	)

	test.equal(
		opts.holder.node().querySelectorAll('.negate_btn')[0].innerHTML,
		'IS',
		'should label the pill with the correct negate value'
	)

	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
		opts.tvsData.values[0].label,
		'should label the pill with the correct value label'
	)
	test.end()
})

tape('tvs categorical', async test => {
	const opts = getOpts({
		tvsData: {
			term: { id: 'diaggrp', name: 'Diagnosis Group', iscategorical: true },
			values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
		}
	})

	await opts.tvs.main(opts.tvsData)

	const pill = opts.holder.select('.tvs_pill').node()
	pill.click()

	await sleep(500)
	const tipd = opts.tvs.Inner.dom.tip.d

	test.equal(tipd.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	test.equal(tipd.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	test.equal(tipd.selectAll('.apply_btn').size(), 1, 'Should have 1 button to apply value change')
	test.equal(tipd.selectAll('.value_checkbox').size(), 27, 'Should have checkbox for each value')
	test.equal(
		tipd
			.selectAll('.value_checkbox')
			.filter(function(d) {
				return this.checked == true
			})
			.size(),
		1,
		'Should have 1 box checked for Wilms tumor'
	)

	tipd
		.node()
		.querySelectorAll('.value_checkbox')[0]
		.click()
	tipd
		.selectAll('.apply_btn')
		.node()
		.click()

	await sleep(800)
	test.equal(
		opts.holder
			.node()
			.querySelectorAll('.value_btn')[0]
			.innerHTML.split('<')[0],
		opts.tvsData.values.length + ' Groups',
		'should change the pill value after adding value from menu'
	)

	pill.click()

	await sleep(500)
	tipd.node().querySelectorAll('.negate_select')[0].selectedIndex = 1
	tipd
		.node()
		.querySelectorAll('.negate_select')[0]
		.dispatchEvent(new Event('change'))

	test.equal(
		opts.holder.node().querySelectorAll('.negate_btn')[0].innerHTML,
		'NOT',
		'should change the negate value of the pill'
	)

	test.end()
})
