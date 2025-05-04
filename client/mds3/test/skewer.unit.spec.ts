import tape from 'tape'
import { whenVisible } from '../../test/test.helpers'
import { showHoverTipOnDisk } from '../skewer.render.js'
import { Menu } from '#dom'

/*
Tests: 
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
