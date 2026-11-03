import tape from 'tape'
import { select } from 'd3-selection'
import { LegendItemMenu, getHiddenKeys } from '#dom'

/*
Tests:
    - getHiddenKeys
    - Menu options
    - Menu is skipped for the only hidden item
*/

const keys = ['a', 'b', 'c']

tape('\n', function (test) {
	test.comment('-***- dom/LegendItemMenu -***-')
	test.end()
})

tape('getHiddenKeys', test => {
	test.deepEqual(getHiddenKeys('toggle', 'a', keys, []), ['a'], 'Should hide a shown item')
	test.deepEqual(
		getHiddenKeys('toggle', 'a', keys, ['a', 'c']),
		['c'],
		'Should show a hidden item and keep the others hidden'
	)
	test.deepEqual(getHiddenKeys('only', 'b', keys, []), ['a', 'c'], 'Should hide all but the item')
	test.deepEqual(
		getHiddenKeys('only', 'a', keys, ['a', 'b']),
		['b', 'c'],
		'Should show a hidden item when showing only it'
	)
	test.deepEqual(getHiddenKeys('all', 'a', keys, ['a', 'b']), [], 'Should show all items')
	test.deepEqual(getHiddenKeys('toggle', 'a', keys, ['gone']), ['a'], 'Should drop keys that are not in the legend')
	test.end()
})

function getTarget() {
	return select('body').append('div').append('span').text('item').node() as Element
}

tape('Menu options', test => {
	test.timeoutAfter(500)
	let result: string[] | undefined
	const menu = new LegendItemMenu({ callback: hidden => (result = hidden) })
	const options = () => menu.tip.d.selectAll('.sja_menuoption').nodes() as HTMLElement[]

	menu.show({ target: getTarget(), key: 'a', keys, hiddenKeys: [] })
	test.deepEqual(
		options().map(o => o.textContent),
		['Hide', 'Show only'],
		'Should offer to hide and show only when nothing is hidden'
	)
	options()[0].click()
	test.deepEqual(result, ['a'], 'Should hide the item')

	menu.show({ target: getTarget(), key: 'a', keys, hiddenKeys: ['a', 'b'] })
	test.deepEqual(
		options().map(o => o.textContent),
		['Show', 'Show only', 'Show all'],
		'Should offer to show all when more than one item is hidden'
	)
	options()[1].click()
	test.deepEqual(result, ['b', 'c'], 'Should show only the item')
	menu.show({ target: getTarget(), key: 'a', keys, hiddenKeys: ['a', 'b'] })
	options()[2].click()
	test.deepEqual(result, [], 'Should show all items')

	menu.tip.hide()
	test.end()
})

tape('Menu is skipped for the only hidden item', test => {
	test.timeoutAfter(500)
	let result: string[] | undefined
	const menu = new LegendItemMenu({ callback: hidden => (result = hidden) })
	menu.show({ target: getTarget(), key: 'b', keys, hiddenKeys: ['b'] })
	test.deepEqual(result, [], 'Should show the only hidden item without a menu')
	test.end()
})
