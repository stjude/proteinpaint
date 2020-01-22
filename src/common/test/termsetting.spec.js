const tape = require('tape')
const d3s = require('d3-selection')
const termsettingInit = require('../termsetting').termsettingInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify termsetting.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

/*************************
 reusable helper functions
**************************/

function getOpts(_opts = {}) {
	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	const opts = Object.assign({ holder }, _opts)

	opts.pill = termsettingInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		use_bins_less: opts.use_bins_less,
		disable_ReplaceRemove: opts.disable_ReplaceRemove,
		debug: true,
		callback: function(termsetting) {
			opts.tsData = termsetting
			opts.pill.main(opts.tsData)
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
	test.pass('-***- common/termsetting -***-')
	test.end()
})

tape.skip('menu', test => {})

tape('disable_ReplaceRemove', async test => {
	const opts = getOpts({
		disable_ReplaceRemove: true,
		tsData: {
			term: {
				id: 'dummy',
				name: 'disable_ReplaceRemove',
				iscategorical: true,
				values: {
					cat1: { label: 'Cat 1' }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	test.ok(pilldiv, 'a <div class=ts_pill> is created for the pill')
	pilldiv.click()
	const tipd = opts.pill.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking pill')
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		0,
		'the second row of tip does not contain replace/remove buttons'
	)

	// delete the flag and click pill again to see if showing replace/remove buttons in tip
	// if pill.opts is frozen in future, just create a new pill
	delete opts.pill.Inner.opts.disable_ReplaceRemove
	pilldiv.click()
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		2,
		'the second row of tip now contains replace/remove buttons after deleting opts.disable_ReplaceRemove'
	)

	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('use_bins_less', async test => {
	const opts = getOpts({
		use_bins_less: true,
		tsData: {
			term: {
				id: 'dummy',
				name: 'use_bins_less',
				isfloat: true,
				bins: {
					less: { bin_size: 10, first_bin: { start: 0 } },
					default: { bin_size: 1, first_bin: { start: 0 } }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()

	const tip = opts.pill.Inner.dom.tip.d.node()
	const bin_size_input = tip.childNodes[0].childNodes[1].childNodes[0].childNodes[1].childNodes[0] // div // table // tr // td

	test.equal(bin_size_input.value, '10', 'has term.bins.less.bin_size as value')

	delete opts.pill.Inner.opts.use_bins_less
	//TODO: need to tweak timeout, UI reflects true value
	pilldiv.click()
	const bin_size_input2 = tip.childNodes[0].childNodes[1].childNodes[0].childNodes[1].childNodes[0]
	test.equal(bin_size_input2.value, '1', 'has term.bins.default.bin_size as value')
	opts.pill.Inner.dom.tip.hide()
	test.end()
})

tape('caterogical term', async test => {
	const opts = getOpts({
		tsData: {
			term: {
				id: 'diaggrp',
				name: 'Diagnosis Group',
				iscategorical: true,
				isleaf: true,
				graph: {
					barchart: {
						categorical: {}
					}
				},
				values: {
					'Acute lymphoblastic leukemia': { label: 'Acute lymphoblastic leukemia' },
					'Acute myeloid leukemia': { label: 'Acute myeloid leukemia' },
					'Blood disorder': { label: 'Blood disorder' },
					'Central nervous system (CNS)': { label: 'Central nervous system (CNS)' },
					'Wilms tumor': { label: 'Wilms tumor' }
				}
			}
		}
	})

	await opts.pill.main(opts.tsData)

	const pilldiv = opts.holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()
	const tip = opts.pill.Inner.dom.tip

	test.equal(tip.d.selectAll('.group_btn').size(), 2, 'Should have 2 buttons for group config')
	test.equal(tip.d.selectAll('.replace_btn').size(), 1, 'Should have 1 button to replce the term')
	test.equal(tip.d.selectAll('.remove_btn').size(), 1, 'Should have 1 button to remove the term')
	test.end()
})
