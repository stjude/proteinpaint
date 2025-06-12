import tape from 'tape'
import { whenVisible } from '../../test/test.helpers'
import { showHoverTipOnDisk } from '../skewer.render.js'
import { dataGood4sunburst } from '../clickVariant.js'
import { getVariantLabelText } from '../leftlabel.variant.js'
import { Menu } from '#dom'

/*
Tests: 

showHoverTipOnDisk()
dataGood4sunburst()
getVariantLabelText()
*/

tape('\n', test => {
	test.pass('-***- skewer unit -***-')
	test.end()
})

tape('showHoverTipOnDisk()', async function (test) {
	const tk = {
		hovertip: new Menu()
	}
	const evt = { clientX: 1, clientY: 1 }

	// invalid d.mlst[]
	showHoverTipOnDisk(evt, { mlst: [] }, tk)
	await whenVisible(tk.hovertip.d)
	// tsc err: ! to assert it's not null
	test.true(
		tk.hovertip.d.node()!.innerHTML.includes('d.mlst[] missing or blank'),
		'should show err msg on invalid d.mlst'
	)

	// invalid class
	showHoverTipOnDisk(evt, { mlst: [{ class: 'xxx' }] }, tk)
	await whenVisible(tk.hovertip.d)
	test.true(tk.hovertip.d.node()!.innerHTML.includes('_unknown'), 'should show _unknown')

	// valid class, single m
	showHoverTipOnDisk(evt, { mlst: [{ class: 'M' }] }, tk)
	await whenVisible(tk.hovertip.d)
	test.true(tk.hovertip.d.node()!.innerHTML.includes('MISSENSE'), 'should show MISSENSE')

	// single m with occurrence
	showHoverTipOnDisk(evt, { mlst: [{ class: 'M', occurrence: 1 }] }, tk)
	await whenVisible(tk.hovertip.d)
	test.true(tk.hovertip.d.node()!.innerHTML.includes('MISSENSE'), 'should show MISSENSE')
	test.true(tk.hovertip.d.node()!.innerHTML.includes('1 sample'), 'should show 1 sample')

	// two snvindel with occurrence
	showHoverTipOnDisk(
		evt,
		{
			mlst: [
				{ class: 'M', occurrence: 1, dt: 1 },
				{ class: 'M', occurrence: 2, dt: 1 }
			]
		},
		tk
	)
	await whenVisible(tk.hovertip.d)
	test.true(tk.hovertip.d.node()!.innerHTML.includes('3 samples'), 'should show 3 samples')
	test.true(tk.hovertip.d.node()!.innerHTML.includes('2 variants'), 'should show 2 variants')

	// two fusion with occurrence
	showHoverTipOnDisk(
		evt,
		{
			mlst: [
				{ class: 'Fuserna', occurrence: 1, dt: 2 },
				{ class: 'Fuserna', occurrence: 2, dt: 1 }
			]
		},
		tk
	)
	await whenVisible(tk.hovertip.d)
	test.true(tk.hovertip.d.node()!.innerHTML.includes('3 samples'), 'should show 3 samples')
	test.true(tk.hovertip.d.node()!.innerHTML.includes('2 alterations'), 'should show 2 alterations')

	if (test['_ok']) tk.hovertip.d.remove()
	test.end()
})

tape('dataGood4sunburst()', function (test) {
	test.throws(
		() => {
			dataGood4sunburst({ nodes: 11 })
		},
		/nodes not array/,
		'should throw'
	)
	test.throws(
		() => {
			dataGood4sunburst({ nodes: [] })
		},
		/nodes empty array/,
		'should throw'
	)
	test.equal(
		dataGood4sunburst({ nodes: [{}] }),
		false,
		'returns false when data.nodes.length==1 to disable sunburst rendering'
	)
	test.throws(
		() => {
			dataGood4sunburst({ nodes: [{}, {}] })
		},
		/node name missing/,
		'should throw'
	)
	/* disabled test, cohortsize is allowed to be missing
	test.throws(
		() => {
			dataGood4sunburst({ nodes: [{}, { name: 'x' }] })
		},
		/node cohortsize not integer/,
		'should throw'
	)
	*/
	test.equal(dataGood4sunburst({ nodes: [{}, { name: 'x', cohortsize: 1 }] }), true, 'returns true on good data')
	test.equal(
		dataGood4sunburst({ nodes: [{}, { name: 'x' }] }),
		true,
		'returns true on good data with missing cohortsize'
	)
	test.end()
})

tape('getVariantLabelText()', function (test) {
	{
		// nothing
		const data = {},
			tk = {},
			block = {}
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], 'No data', 'correct label')
	}
	{
		// custom snv
		const data = {},
			tk = {
				custom_variants: [{ dt: 1 }, { dt: 1 }],
				skewer: {
					viewModes: [{ inuse: true, type: 'skewer' }],
					data: [{ x: 1, mlst: [1, 1] }]
				}
			},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '2 variants', 'correct label')
	}
	{
		// native snv
		const data = {},
			tk = {
				skewer: {
					rawmlst: [{ dt: 1 }, { dt: 1 }],
					viewModes: [{ inuse: true, type: 'skewer' }],
					data: [{ x: 1, mlst: [1, 1] }]
				}
			},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '2 variants', 'correct label')
	}
	{
		// custom cnv
		const data = { cnv: { cnvs: [1, 1] } },
			tk = {
				custom_variants: [{ dt: 4 }, { dt: 4 }]
			},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '2 CNVs', 'correct label')
	}
	{
		// native cnv
		const data = { cnv: { cnvs: [{ dt: 4 }, { dt: 4 }] } },
			tk = {},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '2 CNVs', 'correct label')
	}
	{
		// native snv and cnv
		const data = { cnv: { cnvs: [{ dt: 4 }, { dt: 4 }] } },
			tk = {
				skewer: {
					rawmlst: [{ dt: 1 }, { dt: 1 }],
					viewModes: [{ inuse: true, type: 'skewer' }],
					data: [{ x: 1, mlst: [1, 1] }]
				}
			},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '4 variants', 'correct label')
	}
	{
		// cnv density
		const data = { cnvDensity: { segmentCount: 10 } },
			tk = {},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '10 CNVs', 'correct label')
	}
	{
		// native snv and cnv density
		const data = { cnvDensity: { segmentCount: 10 } },
			tk = {
				skewer: {
					rawmlst: [{ dt: 1 }, { dt: 1 }],
					viewModes: [{ inuse: true, type: 'skewer' }],
					data: [{ x: 1, mlst: [1, 1] }]
				}
			},
			block = { width: 10 }
		const re = getVariantLabelText(data, tk, block)
		test.equal(re[0], '12 variants', 'correct label')
	}

	test.end()
})
