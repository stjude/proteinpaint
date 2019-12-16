const tape = require('tape')
const d3s = require('d3-selection')
const termsettingInit = require('../termsetting').termsettingInit

/*********
the direct functional testing of the component, without the use of runpp()

run it as:
$ npx watchify termsetting.spec.js -o ../../../public/bin/spec.bundle.js -v

*/

tape('\n', test => {
	test.pass('-***- common/termsetting -***-')
	test.end()
})

tape.skip('menu', test => {})

tape('disable_ReplaceRemove', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')

	const pill = termsettingInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		disable_ReplaceRemove: true,
		debug: true,
		callback: () => {}
	})

	await pill.main({
		term: {
			id: 'dummy',
			name: 'disable_ReplaceRemove',
			iscategorical: true,
			values: {
				cat1: { label: 'Cat 1' }
			}
		}
	})

	const pilldiv = holder.node().querySelectorAll('.ts_pill')[0]
	test.ok(pilldiv, 'a <div class=ts_pill> is created for the pill')
	pilldiv.click()
	const tipd = pill.Inner.dom.tip.d
	test.equal(tipd.style('display'), 'block', 'tip is shown upon clicking pill')
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		0,
		'the second row of tip does not contain replace/remove buttons'
	)

	// delete the flag and click pill again to see if showing replace/remove buttons in tip
	// if pill.opts is frozen in future, just create a new pill
	delete pill.Inner.opts.disable_ReplaceRemove
	pilldiv.click()
	test.equal(
		tipd.node().childNodes[1].childNodes.length,
		2,
		'the second row of tip now contains replace/remove buttons after deleting opts.disable_ReplaceRemove'
	)

	test.end()
})

tape('use_bins_less', async test => {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '20px')
	const pill = termsettingInit({
		holder,
		genome: 'hg38',
		dslabel: 'SJLife',
		use_bins_less: true,
		debug: true,
		callback: () => {}
	})

	await pill.main({
		term: {
			id: 'dummy',
			name: 'use_bins_less',
			isfloat: true,
			bins: {
				less: { bin_size: 10, first_bin: { start: 0 } },
				default: { bin_size: 1, first_bin: { start: 0 } }
			}
		}
	})

	const pilldiv = holder.node().querySelectorAll('.ts_pill')[0]
	pilldiv.click()

	const tip = pill.Inner.dom.tip.d.node()
	const bin_size_input = tip.childNodes[0].childNodes[1].childNodes[0].childNodes[1].childNodes[0] // div // table // tr // td

	test.equal(bin_size_input.value, '10', 'has term.bins.less.bin_size as value')

	delete pill.Inner.opts.use_bins_less
	//TODO: need to tweak timeout, UI reflects true value
	pilldiv.click()
	setTimeout(() => {
		const bin_size_input = tip.childNodes[0].childNodes[1].childNodes[0].childNodes[1].childNodes[0]
		test.equal(bin_size_input.value, '1', 'has term.bins.default.bin_size as value')
		test.end()
	}, 200)
})
