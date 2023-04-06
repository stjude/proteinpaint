import tape from 'tape'
import * as d3s from 'd3-selection'
import { Menu } from '#dom/Menu'

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

/**************
 test sections
**************

new Menu()

*/

tape('\n', test => {
	test.pass('-***- dom/menu -***-')
	test.end()
})

tape('new Menu()', test => {
	test.timeoutAfter(100)

	const testMenu = new Menu()

	test.equal(typeof testMenu.d, 'object', 'Should have a menu.d object')
	test.equal(typeof testMenu.clear, 'function', 'Should have a menu.clear() function')
	test.equal(typeof testMenu.show, 'function', 'Should have a menu.show() function')
	test.equal(typeof testMenu.showunder, 'function', 'Should have a menu.showunder() function')
	test.equal(typeof testMenu.hide, 'function', 'Should have a menu.hide() function')
	test.equal(typeof testMenu.fadeout, 'function', 'Should have a menu.fadeout() function')
	test.equal(typeof testMenu.toggle, 'function', 'Should have a menu.toggle() function')
	test.equal(typeof testMenu.getCustomApi, 'function', 'Should have a menu.getCustomApi() function')

	test.end()
})

tape.only('clear()', test => {
	test.timeoutAfter(500)

	const holder = getHolder()

	const testMenu1 = new Menu({
		parent_menu: holder
	})
	testMenu1.d.append('div').text('Test')

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('show()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('showunder()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('showunderoffset()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('hide()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
	test.end()
})

tape.skip('fadeout()', test => {
	test.timeoutAfter(500)

	// const holder = getHolder()
	const testMenu = new Menu()

	// if (test._ok) holder.remove()
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
