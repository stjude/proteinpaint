import tape from 'tape'
import * as d3s from 'd3-selection'
import { initByInput } from '../controls.config.js'

/*
Tests:
	number input: an out-of-range value is marked, and the value that is used instead is shown
*/

function getHolder() {
	return d3s.select('body').append('table').append('tr')
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

tape('\n', test => {
	test.comment('-***- plots/controls.config -***-')
	test.end()
})

tape('number input: an out-of-range value is marked, and the value that is used instead is shown', async test => {
	const holder = getHolder()
	const values: number[] = []
	const api = initByInput.number({
		holder,
		label: 'Groups',
		chartType: 'c',
		settingsKey: 'k',
		min: 2,
		max: 30,
		debounceInterval: 1,
		callback: (v: number) => values.push(v)
	})
	api.main({ settings: { c: { k: 8 } } })
	const input = holder.select<HTMLInputElement>('input')
	const type = (value: string, event: string) => {
		input.property('value', value)
		input.node()!.dispatchEvent(new Event(event))
	}
	// the inline style, which is set only for an out-of-range value
	const isMarked = () => !!input.node()!.style.backgroundColor

	type('40', 'input')
	test.ok(isMarked(), 'a typed value above the max is marked')
	test.equal(input.attr('title'), 'The value must be from 2 to 30', 'the title says the allowed range')

	type('12', 'input')
	test.notOk(isMarked(), 'a typed value in range is not marked')
	test.equal(input.attr('title'), null, 'and has no title')

	type('40', 'change')
	await sleep(20)
	test.deepEqual(values, [30], 'the max is used')
	test.equal(input.property('value'), '30', 'the input shows the value that is used')
	test.ok(isMarked(), 'the input stays marked')
	test.equal(
		input.attr('title'),
		'40 is not allowed, the value must be from 2 to 30: 30 is used instead',
		'the title says why'
	)

	// the plot is rendered again with the used value, which is the same as before
	api.main({ settings: { c: { k: 30 } } })
	test.ok(isMarked(), 'the mark stays after a render with the used value')

	// the setting changes otherwise, such as with an undo
	api.main({ settings: { c: { k: 12 } } })
	test.notOk(isMarked(), 'the mark is cleared when the setting changes otherwise')

	// a typed out-of-range value is replaced by a render of the setting, such as after an undo
	type('50', 'input')
	test.ok(isMarked(), 'a typed value above the max is marked')
	api.main({ settings: { c: { k: 12 } } })
	test.notOk(isMarked(), 'the mark of a typed value is cleared when the setting is rendered')
	test.equal(input.attr('title'), null, 'and its title is cleared')

	type('1', 'change')
	await sleep(20)
	test.deepEqual(values, [30, 2], 'the min is used for a value below it')
	test.equal(input.property('value'), '2', 'the input shows the min')

	if ((test as any)._ok) holder.node()!.closest('table')!.remove()
	test.end()
})
