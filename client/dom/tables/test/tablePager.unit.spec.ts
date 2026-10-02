import tape from 'tape'
import * as d3s from 'd3-selection'
import { createPager, pageInfoText, pageWindow, renderPagerNav } from '../tablePager'

/*
Tests:
	pageWindow: short lists, windows with gaps, edges
	pageInfoText: first page, last partial page, empty
	renderPagerNav: buttons, disabled ends, current page, ellipses, click
	createPager: page size select
*/

tape('\n', test => {
	test.comment('-***- dom/tables/tablePager -***-')
	test.end()
})

tape('pageWindow: short lists, windows with gaps, edges', test => {
	test.deepEqual(pageWindow(1, 1), [1], 'one page')
	test.deepEqual(pageWindow(1, 3), [1, 2, 3], 'three pages need no gap')
	test.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5], 'five pages with the middle current')
	test.deepEqual(pageWindow(1, 20), [1, 2, 3, '…', 20], 'first page of many')
	test.deepEqual(pageWindow(20, 20), [1, '…', 18, 19, 20], 'last page of many')
	test.deepEqual(pageWindow(10, 20), [1, '…', 8, 9, 10, 11, 12, '…', 20], 'a gap on each side')
	test.deepEqual(pageWindow(4, 20), [1, 2, 3, 4, 5, 6, '…', 20], 'a window touching the first page has no gap there')
	test.deepEqual(pageWindow(6, 20), [1, '…', 4, 5, 6, 7, 8, '…', 20], 'a one-page gap is still shown as a gap')
	test.end()
})

tape('pageInfoText: first page, last partial page, empty', test => {
	test.equal(pageInfoText(0, 10, 25), 'Showing 1 to 10 of 25 entries', 'first page')
	test.equal(pageInfoText(20, 10, 25), 'Showing 21 to 25 of 25 entries', 'last partial page')
	test.equal(pageInfoText(0, 10, 0), 'Showing 0 entries', 'empty')
	test.equal(pageInfoText(0, 10, 3), 'Showing 1 to 3 of 3 entries', 'fewer rows than a page')
	test.end()
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

tape('renderPagerNav: buttons, disabled ends, current page, ellipses, click', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const nav = holder.append('nav')
	const went: number[] = []
	const labels = () => (nav.selectAll('button').nodes() as HTMLButtonElement[]).map(b => b.textContent)
	const button = (text: string) =>
		(nav.selectAll('button').nodes() as HTMLButtonElement[]).find(b => b.textContent === text)!

	renderPagerNav(nav, 1, 20, page => went.push(page))
	test.deepEqual(labels(), ['Previous', '1', '2', '3', '20', 'Next'], 'buttons on page 1')
	test.ok(button('Previous').disabled, 'Previous is disabled on the first page')
	test.notOk(button('Next').disabled, 'Next is enabled')
	test.equal(button('1').getAttribute('aria-current'), 'page', 'the current page is marked')
	test.equal(button('2').getAttribute('aria-label'), 'Page 2', 'page buttons have a full label')
	test.equal(button('Next').getAttribute('aria-label'), 'Go to next page', 'arrows have a full label')
	test.equal(nav.selectAll('span').size(), 1, 'one ellipsis')

	button('3').click()
	button('Next').click()
	test.deepEqual(went, [3, 2], 'page buttons go to their page, Next goes to the next one')
	button('Previous').click()
	test.deepEqual(went, [3, 2], 'a disabled button does nothing')

	renderPagerNav(nav, 20, 20, page => went.push(page))
	test.ok(button('Next').disabled, 'Next is disabled on the last page')
	test.equal(nav.selectAll('button').size(), 6, 'the nav is redrawn, not appended to')

	if ((test as any)._ok) holder.remove()
	test.end()
})

tape('createPager: page size select', test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const sizes: number[] = []
	const { info, nav } = createPager(holder, {
		pageSizeOptions: [10, 25, 50],
		pageSize: 25,
		onPageSize: size => sizes.push(size)
	})
	const select = holder.select('select').node() as HTMLSelectElement

	test.equal(select.getAttribute('aria-label'), 'Rows per page', 'the select is labelled')
	test.deepEqual(
		Array.from(select.options).map(o => o.value),
		['10', '25', '50'],
		'one option per size'
	)
	test.equal(select.value, '25', 'the current size is selected')
	select.value = '50'
	select.dispatchEvent(new Event('change', { bubbles: true }))
	test.deepEqual(sizes, [50], 'a change reports the chosen size as a number')
	test.ok(info.node() && nav.node(), 'returns holders for the info text and the buttons')
	test.equal(nav.attr('aria-label'), 'Pagination', 'the buttons are in a labelled nav')

	if ((test as any)._ok) holder.remove()
	test.end()
})
