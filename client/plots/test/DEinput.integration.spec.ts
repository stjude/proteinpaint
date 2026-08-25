import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
	- DEinput with two prebuilt groups
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

	test.end()
})
