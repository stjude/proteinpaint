import tape from 'tape'
import * as d3s from 'd3-selection'
import { Menu } from '#dom/menu'
import { detectStyle } from '../../test/test.helpers.js'
/**
Tests:
	new Menu()
	show(), clear(), and hide(), no args
	clear() with arg
	show() with args
	onHide() callback
	showunder()
	showunderoffset()
	fadeout()
	toggle()
	getCustomApi()
 */

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

const longText =
	'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum'

function getTestMenu() {
	const menu = new Menu()
	menu.d.append('div').text('Test').style('display', 'block')

	return menu
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/menu -***-')
	test.end()
})

tape('new Menu()', test => {
	test.timeoutAfter(100)

	const testMenu = new Menu()

	test.equal(typeof testMenu.d, 'object', 'Should have a menu.d object')
	test.equal(typeof testMenu.dnode, 'object', 'Should have a menu.dnode (i.e. d.node()) object')
	test.equal(typeof testMenu.clear, 'function', 'Should have a menu.clear() function')
	test.equal(typeof testMenu.show, 'function', 'Should have a menu.show() function')
	test.equal(typeof testMenu.showunder, 'function', 'Should have a menu.showunder() function')
	test.equal(typeof testMenu.hide, 'function', 'Should have a menu.hide() function')
	test.equal(typeof testMenu.fadeout, 'function', 'Should have a menu.fadeout() function')
	test.equal(typeof testMenu.toggle, 'function', 'Should have a menu.toggle() function')
	test.equal(typeof testMenu.getCustomApi, 'function', 'Should have a menu.getCustomApi() function')
	test.equal(typeof testMenu.destroy, 'function', 'Should have a menu.destroy() function')

	testMenu.destroy()
	test.end()
})

tape('show(), clear(), and hide(), no args', async test => {
	test.timeoutAfter(500)
	//Test basic function collectively to use freely in later tests

	const testMenu = getTestMenu()
	testMenu.show()

	let appendedDiv
	appendedDiv = testMenu.dnode.childNodes[0]
	test.ok(appendedDiv.style.display == 'block' && appendedDiv.innerText == 'Test', `Should display 'Test' tip`)

	testMenu.clear()
	appendedDiv = testMenu.dnode.childNodes[0]
	test.ok(!appendedDiv && testMenu.d, `Should remove appended 'Test' div but empty menu tip persists`)

	testMenu.hide()
	test.ok(testMenu.dnode.style.display == 'none', `Should not display menu`)

	testMenu.destroy()
	test.end()
})

tape.skip('clear() with arg', test => {
	test.timeoutAfter(500)

	const testMenu = new Menu({ clearSelector: '.sjpp-menu-test-div' })
	testMenu.d.append('div').text('Main div - should persist').style('display', 'block')

	testMenu.d
		.append('div')
		.attr('class', 'sjpp-menu-test-div')
		.text('Clear div - should clear')
		.style('display', 'block')

	testMenu.show()
	const x = testMenu.d.select('.sjpp-menu-test-div')
	console.log(x)
	// testMenu.clear()

	test.end()
})

tape('show() with args', async test => {
	test.timeoutAfter(500)

	const testMenu = getTestMenu()
	testMenu.d.style('max-width', '20vw').style('max-height', '10vh').style('overflow', 'hidden')

	{
		//left (x) position
		const posNum = 50
		testMenu.show(posNum)
		test.deepEqual(
			{ left: testMenu.dnode.style.left, top: testMenu.dnode.style.top },
			{ left: `${posNum + testMenu.offsetX}px`, top: '' },
			`Should show menu left, under header, shifted by .offsetX = ${testMenu.offsetX}px`
		)
	}

	{
		//top (y) position
		const posNum = 50
		testMenu.show('', posNum)
		test.deepEqual(
			{ left: testMenu.dnode.style.left, top: testMenu.dnode.style.top },
			{ left: '20px', top: `${posNum + testMenu.offsetY}px` },
			`Should show menu at the top, above header, shifted by .offsetY = ${testMenu.offsety}px`
		)
	}

	// left & top (x & y) position
	{
		const posNum = 100
		testMenu.show(posNum, posNum)
		test.deepEqual(
			{ left: testMenu.dnode.style.left, top: testMenu.dnode.style.top },
			{ left: `${posNum + testMenu.offsetX}px`, top: `${posNum + testMenu.offsetY}px` },
			`Should show menu top left corner, over header, shifted by .offsetX = ${testMenu.offsetX}px & .offsetY = ${testMenu.offsetY}px`
		)
	}

	{
		const posNum = 100
		//No shift (i.e. additional 20px)
		testMenu.show(posNum, posNum, false)
		test.deepEqual(
			{ left: testMenu.dnode.style.left, top: testMenu.dnode.style.top },
			{ left: `${posNum}px`, top: `${posNum}px` },
			`Should show menu top left corner without .offsetX or .offsetY added to left or top, respectively.`
		)
	}

	//False down appears to have no effect on show()(?)
	// posNum = 200
	// testMenu.show(posNum, posNum, false, false)
	// console.log(testMenu.dnode.style)

	//With scroll
	{
		const posNum = 200
		testMenu.d.append('div').text(longText)
		testMenu.show(posNum, posNum, false)
		test.deepEqual(
			{ left: testMenu.dnode.style.left, top: testMenu.dnode.style.top },
			{ left: `${posNum + window.scrollX}px`, top: `${posNum + window.scrollY}px` },
			`Should show menu position with window.scrollX = ${window.scrollX} & window.scrollY = ${window.scrollY}`
		)
	}
	testMenu.destroy()
	test.end()
})

tape.skip('onHide() callback', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape('showunder()', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const btn = holder.append('button').text('Button')
	const testMenu = getTestMenu()

	const message = 'Should throw error for missing dom arg'
	try {
		testMenu.showunder()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	testMenu.showunder(btn.node())

	const btnP = btn.node().getBoundingClientRect()
	const menuP = testMenu.dnode.getBoundingClientRect()
	test.equal(btnP.x, menuP.x, `Should show menu with the same style.left value as test element.`)
	const correctYvalue = btnP.top + btnP.height + window.scrollY + 5
	test.equal(
		Math.round(correctYvalue),
		Math.round(menuP.y),
		`Should show menu with the shifted style.top value relative to test element.`
	)

	if (test._ok) {
		testMenu.destroy()
		holder.remove()
	}
	test.end()
})

tape('showunderoffset()', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const btn = holder.append('button').text('Button')
	const testMenu = getTestMenu()

	const message = 'Should throw error for missing dom arg'
	try {
		testMenu.showunderoffset()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	testMenu.showunderoffset(btn.node())

	const btnP = btn.node().getBoundingClientRect()
	const menuP = testMenu.dnode.getBoundingClientRect()

	test.equal(
		Math.round(btnP.x + testMenu.offsetX),
		Math.round(menuP.x),
		`Should show menu with the style.left value as test element, offset by ${testMenu.offsetX}px.`
	)
	const correctYvalue = btnP.top + btnP.height + window.scrollY + 5
	test.equal(
		Math.round(correctYvalue + testMenu.offsetY),
		Math.round(menuP.y),
		`Should show menu with style.top value relative to test element, offset by ${testMenu.offsetY}px.`
	)

	if (test._ok) {
		testMenu.destroy()
		holder.remove()
	}
	test.end()
})

tape.skip('fadeout()', async test => {
	test.timeoutAfter(500)

	const testMenu = getTestMenu()
	testMenu.d.attr('class', 'menu-fadeout-test')
	testMenu.show()
	testMenu.fadeout()
	const faded = await detectStyle({
		elem: d3s.select('body').node(),
		selector: '.menu-fadeout-test',
		style: {
			display: 'inline-block'
		}
	})
	console.log(faded)

	// testMenu.destroy()
	test.end()
})

tape.skip('toggle()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('getCustomApi()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})
