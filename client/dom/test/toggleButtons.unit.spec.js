import tape from 'tape'
import { init_tabs, Tabs } from '#dom/toggleButtons'
import * as d3s from 'd3-selection'

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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test data
***************/

const tabs = [
	{
		label: 'Test tab 1',
		callback: () => {
			//empty for now
		}
	},
	{
		label: 'Test tab 2',
		callback: () => {
			//empty for now
		}
	},
	{
		label: 'Test tab 3',
		callback: () => {
			//empty for now
		}
	}
]

/**************
 test sections

init_tabs()
 - Render toggles
 - Missing holder
 - Missing tabs array

Tabs
 - Render Tabs
 - Missing holder
 - Missing tabs array

***************/

tape('\n', test => {
	test.pass('-***- dom/toggleButtons -***-')
	test.end()
})

tape('\n', test => {
	test.pass('-***- init_tabs -***-')
	test.end()
})

tape('Render toggles', async test => {
	test.timeoutAfter(1000)
	const holder = getHolder()

	init_tabs({ holder, tabs })

	await testTabActivity()

	async function testTabActivity() {
		await sleep(300)
		const activeBtn = holder.selectAll('.sjpp-active').nodes()
		test.equal(activeBtn.length, 1, `Should only display one active button`)
		const tabBtns = holder.selectAll('.sj-toggle-button').nodes()
		test.equal(tabBtns.length, tabs.length, `Should display all tabs in tabs array`)

		await sleep(300)
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
	const message = `Should throw for missing holder`

	try {
		async function testToggles() {
			return init_tabs({ tabs })
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
	const message = `Should throw for missing tabs`

	try {
		async function testToggles() {
			return init_tabs({ holder })
		}
		await testToggles()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('\n', test => {
	test.pass('-***- Tabs -***-')
	test.end()
})

tape('Render Tabs', async test => {
	test.timeoutAfter(1000)
	const holder = getHolder()

	const initTabs = new Tabs({ holder, tabs })
	initTabs.main()

	await testTabActivity()

	async function testTabActivity() {
		await sleep(300)
		const activeBtn = holder.selectAll('.sjpp-active').nodes()
		test.equal(activeBtn.length, 1, `Should only display one active button`)
		const tabBtns = holder.selectAll('.sj-toggle-button').nodes()
		test.equal(tabBtns.length, tabs.length, `Should display all tabs in tabs array`)

		await sleep(300)
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
	const message = `Should throw for missing holder`

	try {
		async function testToggles() {
			const initTabs = new Tabs({ tabs })
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
	const message = `Should throw for missing tabs array`

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
