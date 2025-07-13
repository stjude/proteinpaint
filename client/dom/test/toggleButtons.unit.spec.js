import tape from 'tape'
import { Tabs } from '../../dom/toggleButtons'
import * as d3s from 'd3-selection'
import { detectGte } from '../../test/test.helpers.js'

/*
Tests:
	Render Tabs, default settings
	Missing holder
	Missing tabs array
	Invalid linePosition
	Invalid tabsPosition
	Render Tabs, vertical stack, right border
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

/**************
 test data
***************/

const tabsData = [
	{
		label: 'Test tab 1'
	},
	{
		label: 'Tab 2, long label'
	},
	{
		label: 'Test tab 3'
	}
]

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/toggleButtons -***-')
	test.end()
})

tape('Render Tabs, default settings', async test => {
	test.timeoutAfter(1000)
	const holder = getHolder()

	const initTabs = new Tabs({ holder, tabs: tabsData })
	initTabs.main()

	await testTabActivity()

	async function testTabActivity() {
		const activeBtn = await detectGte({ elem: holder.node(), selector: '.sjpp-active' })
		test.equal(activeBtn.length, 1, `Should only display one active button`)
		const tabBtns = holder.selectAll('.sj-toggle-button').nodes()
		test.equal(tabBtns.length, tabsData.length, `Should display all tabs in tabs array`)

		tabBtns[1].click()
		const oldActiveBtn = Object.values(tabBtns[0].classList).some(d => d == 'sjpp-active')
		const newActiveBtn = Object.values(tabBtns[1].classList).some(d => d == 'sjpp-active')
		test.equal(oldActiveBtn, !newActiveBtn, `Should change 2nd tab to active = true and 1st tab to active = false`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Missing holder', async test => {
	test.timeoutAfter(100)
	const message = `Should throw for missing .holder`

	try {
		async function testToggles() {
			const initTabs = new Tabs({ tabs: tabsData })
			initTabs.main()
		}
		await testToggles()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape('Missing tabs array', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for missing .tabs:[]`

	try {
		async function testToggles() {
			const initTabs = new Tabs({ holder })
			initTabs.main()
		}
		await testToggles()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Invalid linePosition', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for invalid .linePosition`

	try {
		async function testToggles() {
			const initTabs = new Tabs({ holder, tabs: tabsData, linePosition: 'aa' })
			initTabs.main()
		}
		await testToggles()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Invalid tabsPosition', async test => {
	test.timeoutAfter(100)
	const holder = getHolder()
	const message = `Should throw for invalid .tabsPosition`

	try {
		async function testToggles() {
			const initTabs = new Tabs({ holder, tabs: tabsData, tabsPosition: 'aa' })
			initTabs.main()
		}
		await testToggles()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Render Tabs, vertical stack, right border', async test => {
	test.timeoutAfter(1000)
	const holder = getHolder()

	const initTabs = new Tabs({ holder, tabs: tabsData, linePosition: 'right', tabsPosition: 'vertical' })
	initTabs.tabs.forEach(tab => {
		tab.callback = async event => {
			tab.contentHolder.text(`${tab.label} is active`)
		}
	})
	initTabs.main()

	await testTabsPosition()
	await testContentHolderPosition()

	async function testTabsPosition() {
		const tabsHolder = initTabs.dom.tabsHolder

		//Test vertical orientation
		const tabsButtonsDisplay = tabsHolder
			.selectAll('button')
			.nodes()
			.filter(b => b.style.display == 'flex')
		test.equal(tabsButtonsDisplay.length, initTabs.tabs.length, `Should display all tabs vertically in holder`)

		//Test border line placement
		const tabsLinePosition = tabsHolder
			.selectAll('div')
			.nodes()
			.filter(b => b.style.display == 'inline-flex')
		test.equal(tabsLinePosition.length, initTabs.tabs.length, `Should display all tabs lines to the right`)
	}

	async function testContentHolderPosition() {
		const contentHolder = initTabs.dom.contentHolder
		test.ok(
			contentHolder.node().style.display == 'inline-block',
			`Should show content for each tab to the right, inline of tabs`
		)
	}

	if (test._ok) holder.remove()
	test.end()
})
