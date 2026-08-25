import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
	- DEinput with two prebuilt groups
	- DEinput with autoSubmit
	- DEinput renders a group name as text
	- DEinput with a group named alert
	- DEinput rejects an invalid config.groups[]
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { header_mode: 'hidden' },
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

// hand-coded filters, only term.id is given: getPlotConfig() rehydrates each tvs term
function getGroupFilter(key, label) {
	return {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex' },
					values: [{ key, label }]
				}
			}
		]
	}
}

const groups = [
	{ name: 'Male', filter: getGroupFilter('1', 'Male'), color: '#e75480' },
	{ name: 'Female', filter: getGroupFilter('2', 'Female') }
]

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/DEinput -***-')
	test.end()
})

tape('DEinput with two prebuilt groups', test => {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'DEinput',
					groups: structuredClone(groups)
				}
			]
		},
		DEinput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(deinput) {
		const self = deinput.Inner

		test.deepEqual(
			self.groups.map(g => g.name),
			['Male', 'Female'],
			'should seed the group table from config.groups[]'
		)
		test.equal(self.groups[0].color, '#e75480', 'should use the supplied group color')
		test.notEqual(self.groups[1].color, undefined, 'should assign a color to a group that does not supply one')
		test.equal(
			self.groups[0].filter.lst[0].tvs.term.name,
			'Sex',
			'should rehydrate a group filter term that only has an id'
		)

		test.equal(self.dom.submit.style('display'), 'inline-block', 'should show the submit button')
		test.equal(self.dom.submit.text(), 'Submit (Male vs Female)', 'should label the submit button with both groups')
		test.equal(
			self.dom.addGroup.select('.sja_new_filter_btn').style('pointer-events'),
			'none',
			'should disable the add group button when 2 groups are shown'
		)

		const rows = self.dom.table.node().querySelectorAll('tr')
		test.equal(rows.length, groups.length + 1, 'should render a table row for each group, plus the header row')

		// a rerun of main() must not re-add the seeded groups
		self.groups.splice(1, 1)
		await self.main()
		test.deepEqual(
			self.groups.map(g => g.name),
			['Male'],
			'should not re-seed the groups when main() runs again'
		)

		// the lone remaining group is compared against all other samples
		const submitGroups = self.getSubmitGroups()
		test.deepEqual(
			submitGroups.map(g => g.name),
			['Male', 'Not in Male'],
			'should synthesize a complement group when only 1 group is left'
		)
		test.notDeepEqual(
			submitGroups[1].filter,
			self.groups[0].filter,
			'should negate the filter of the lone group for its complement'
		)

		if (test['_ok']) self.app.destroy()
		test.end()
	}
})

tape('DEinput with autoSubmit', test => {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'DEinput',
					groups: structuredClone(groups),
					autoSubmit: true
				}
			]
		},
		DEinput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(deinput) {
		const self = deinput.Inner

		test.equal(self.autoSubmitted, true, 'should submit the seeded groups without a click')
		test.deepEqual(
			self.getSubmitGroups().map(g => g.name),
			['Male', 'Female'],
			'should submit both seeded groups'
		)
		const rows = [...self.dom.preAnalysis.node().querySelectorAll('table.sja_simpletable tr')]
		test.equal(rows.length, groups.length, 'should render a pre-analysis row for each submitted group')
		test.ok(
			rows[0].textContent.includes('Male') && rows[1].textContent.includes('Female'),
			'should render both group names in the pre-analysis table'
		)

		// only the first main() may submit: every state change reruns main(), and each submission is a
		// request to termdb/DE
		let resubmitted = false
		self.clickSubmit = async () => (resubmitted = true)
		await self.main()
		test.equal(resubmitted, false, 'should not submit again when main() runs again')

		if (test['_ok']) self.app.destroy()
		test.end()
	}
})

tape('DEinput renders a group name as text', test => {
	test.timeoutAfter(10000)

	// a group name is supplied by an embedder or typed by a user, and must not be rendered as markup
	const name = `<img src=x onerror="window.__deinputXss = true">`

	runpp({
		state: {
			plots: [
				{
					chartType: 'DEinput',
					groups: [
						{ name, filter: getGroupFilter('1', 'Male') },
						{ name: 'Female', filter: getGroupFilter('2', 'Female') }
					],
					autoSubmit: true
				}
			]
		},
		DEinput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(deinput) {
		const self = deinput.Inner
		const panel = self.dom.preAnalysis.node()

		test.equal(panel.querySelector('img'), null, 'should not render a group name as markup')
		test.ok(panel.textContent.includes(name), 'should render a group name as text')
		test.equal(window['__deinputXss'], undefined, 'should not execute a script in a group name')

		if (test['_ok']) self.app.destroy()
		test.end()
	}
})

tape('DEinput with a group named alert', test => {
	test.timeoutAfter(10000)

	/* the pre-analysis response keys its sample counts by group name, and used to carry its own alert
	message in the same object: the count of a group named 'alert' was then read as an error, which hid
	the button that runs the analysis */
	runpp({
		state: {
			plots: [
				{
					chartType: 'DEinput',
					groups: [
						{ name: 'alert', filter: getGroupFilter('1', 'Male') },
						{ name: 'Female', filter: getGroupFilter('2', 'Female') }
					],
					autoSubmit: true
				}
			]
		},
		DEinput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(deinput) {
		const self = deinput.Inner
		const panel = self.dom.preAnalysis.node()

		const rows = [...panel.querySelectorAll('table.sja_simpletable tr')]
		test.equal(rows.length, 2, 'should render a pre-analysis row for each group')
		const count = Number(rows[0].querySelectorAll('td')[1].textContent.split(' ')[0])
		test.ok(count > 0, 'should report the sample count of a group named alert')
		test.equal(
			panel.querySelectorAll('button').length,
			1,
			'should offer to run the analysis, not mistake the count of a group named alert for an error'
		)

		if (test['_ok']) self.app.destroy()
		test.end()
	}
})

tape('DEinput rejects an invalid config.groups[]', async test => {
	test.timeoutAfter(5000)

	const _ = await import('../DEinput.ts')

	try {
		await _.getPlotConfig({ groups: [{ name: 'Male' }] })
		test.fail('should throw on a group without a filter')
	} catch (e: any) {
		test.equal(e, 'config.groups[] entry is missing .filter{}', 'should throw on a group without a filter')
	}

	try {
		await _.getPlotConfig({ groups: [...groups, { name: 'Other', filter: getGroupFilter('1', 'Male') }] })
		test.fail('should throw on more than 2 groups')
	} catch (e: any) {
		test.equal(e, 'config.groups[] cannot exceed 2 groups', 'should throw on more than 2 groups')
	}

	try {
		await _.getPlotConfig({
			groups: [
				{ name: 'Male', filter: getGroupFilter('1', 'Male') },
				{ name: 'Male', filter: getGroupFilter('2', 'Female') }
			]
		})
		test.fail('should throw on duplicate group names')
	} catch (e: any) {
		test.equal(e, `duplicate config.groups[].name='Male'`, 'should throw on duplicate group names')
	}

	{
		// a color is rendered as a css value, so only a parsable color may be stored
		const color = `red" onmouseover="window.__deinputXss = true`
		try {
			await _.getPlotConfig({ groups: [{ name: 'Male', filter: getGroupFilter('1', 'Male'), color }] })
			test.fail('should throw on an unparsable group color')
		} catch (e: any) {
			test.equal(e, `invalid config.groups[].color='${color}'`, 'should throw on an unparsable group color')
		}
	}

	{
		const c = await _.getPlotConfig({ groups: [{ name: 'Male', filter: getGroupFilter('1', 'Male'), color: 'red' }] })
		test.equal(c.groups[0].color, '#ff0000', 'should store a group color as hex')
	}

	{
		// the default name of the unnamed group must not collide with the name of the group after it
		const c = await _.getPlotConfig({
			groups: [{ filter: getGroupFilter('1', 'Male') }, { name: 'New group', filter: getGroupFilter('2', 'Female') }]
		})
		test.deepEqual(
			c.groups.map(g => g.name),
			['New group 1', 'New group'],
			'should not reuse a supplied name when naming an unnamed group'
		)
	}

	test.end()
})
