import tape from 'tape'
import * as d3s from 'd3-selection'
import { getSelectedCheckboxValues, renderCheckboxSelect } from '../checkboxSelect.ts'

tape('renderCheckboxSelect(): renders options and returns selected values', test => {
	const holder = d3s.select('body').append('div')
	const checkboxes = renderCheckboxSelect(
		holder,
		[
			{ value: 'somatic', label: 'Tumor acquired' },
			{ value: 'germline', label: 'Inherited' }
		],
		{
			className: 'origin-checkboxes',
			lastCheckedTitle: 'At least one origin must be selected'
		}
	)

	test.equal(holder.selectAll('.origin-checkboxes input').size(), 2, 'renders every option')
	test.deepEqual(
		holder
			.selectAll('.origin-checkboxes span')
			.nodes()
			.map(node => node.textContent),
		['Tumor acquired', 'Inherited'],
		'renders option labels'
	)
	test.deepEqual(
		getSelectedCheckboxValues(checkboxes),
		['somatic', 'germline'],
		'returns all values when every option is checked'
	)

	holder.remove()
	test.end()
})

tape('renderCheckboxSelect(): prevents deselecting the final option', test => {
	const holder = d3s.select('body').append('div')
	let changes = 0
	const checkboxes: any = renderCheckboxSelect(
		holder,
		[
			{ value: 1, label: 'Primary' },
			{ value: 2, label: 'Relapse' }
		],
		{
			className: 'sample-type-checkboxes',
			lastCheckedTitle: 'At least one sample type must be selected',
			onChange: () => changes++
		}
	)

	checkboxes[0].node().click()
	test.deepEqual(getSelectedCheckboxValues(checkboxes), ['2'], 'returns the remaining checked value')
	test.equal(
		checkboxes[1].node().parentNode.title,
		'At least one sample type must be selected',
		'marks the final checked option'
	)
	checkboxes[1].node().click()
	test.equal(checkboxes[1].property('checked'), true, 'keeps the final option checked')
	test.equal(changes, 1, 'runs the change callback only for an accepted change')

	holder.remove()
	test.end()
})

tape('renderCheckboxSelect(): omits selectors with fewer than two options', test => {
	const holder = d3s.select('body').append('div')
	const checkboxes = renderCheckboxSelect(holder, [{ value: 'somatic', label: 'Somatic' }], {
		className: 'origin-checkboxes',
		lastCheckedTitle: 'At least one origin must be selected'
	})

	test.equal(checkboxes, undefined, 'returns no selector')
	test.equal(holder.selectAll('input').size(), 0, 'renders no checkbox')

	holder.remove()
	test.end()
})
