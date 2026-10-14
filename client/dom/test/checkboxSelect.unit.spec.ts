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
			.selectAll<HTMLSpanElement, unknown>('.origin-checkboxes span')
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

tape('renderCheckboxSelect(): initializes only selected options', test => {
	const holder = d3s.select('body').append('div')
	let changes = 0
	const checkboxes = renderCheckboxSelect(
		holder,
		[
			{ value: 1, label: 'Primary' },
			{ value: 2, label: 'Relapse' }
		],
		{
			className: 'sample-type-checkboxes',
			lastCheckedTitle: 'At least one sample type must be selected',
			selected: ['2'],
			onChange: () => changes++
		}
	)!

	test.deepEqual(getSelectedCheckboxValues(checkboxes), ['2'], 'matches numeric option values as strings')
	test.equal(checkboxes[0].node().parentNode.title, '', 'does not mark the unchecked option')
	test.equal(
		checkboxes[1].node().parentNode.title,
		'At least one sample type must be selected',
		'marks the initially selected final option'
	)
	test.equal(checkboxes[1].node().parentNode.style.cursor, 'not-allowed', 'marks the final option cursor')
	test.equal(changes, 0, 'does not call onChange during initialization')
	checkboxes[1].node().click()
	test.deepEqual(getSelectedCheckboxValues(checkboxes), ['2'], 'keeps the initially selected final option checked')
	test.equal(changes, 0, 'does not call onChange for a rejected change')
	checkboxes[0].node().click()
	test.deepEqual(getSelectedCheckboxValues(checkboxes), ['1', '2'], 'allows selecting additional options')
	test.equal(checkboxes[1].node().parentNode.title, '', 'clears the final option title when both are checked')
	test.equal(checkboxes[1].node().parentNode.style.cursor, '', 'clears the final option cursor')
	test.equal(changes, 1, 'calls onChange for an accepted change')

	holder.remove()
	test.end()
})

tape('renderCheckboxSelect(): honors an empty selected array', test => {
	const holder = d3s.select('body').append('div')
	const checkboxes = renderCheckboxSelect(
		holder,
		[
			{ value: 'somatic', label: 'Somatic' },
			{ value: 'germline', label: 'Germline' }
		],
		{
			className: 'origin-checkboxes',
			lastCheckedTitle: 'At least one origin must be selected',
			selected: []
		}
	)

	test.deepEqual(getSelectedCheckboxValues(checkboxes), [], 'does not default an explicit empty selection to all')

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
