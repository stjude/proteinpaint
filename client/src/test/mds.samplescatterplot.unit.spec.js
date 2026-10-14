import tape from 'tape'
import { select } from 'd3-selection'
import { legend_attr_levels, update_dotcolor_legend } from '../mds.samplescatterplot.js'

/****************
Tests for mds.samplescatterplot.js legend_attr_levels()

Regression test for code-scanning #72.
*****************/

tape('\n', function (test) {
	test.comment('-***- mds.samplescatterplot.js -***-')
	test.end()
})

tape('legend_attr_levels renders sample attribute values as text, not HTML', function (test) {
	test.timeoutAfter(100)

	const table = select('body').append('table')
	const payload = '<img src=x onerror=alert(1)>'
	const obj = {
		legendtable: table,
		attr_levels: [{ key: 'attr' }],
		sample_attributes: { attr: {} },
		dots: [{ s: { attr: payload } }, { s: { attr: payload } }]
	}

	legend_attr_levels(obj)

	const label = table.select('.sja_l1lb')
	test.equal(label.node().querySelector('img'), null, 'legend value must not be parsed into an element')
	test.ok(label.text().includes(payload), 'the raw value should still appear as visible text')
	test.ok(label.text().includes('n=2'), 'the dot count should be rendered')

	table.remove()
	test.end()
})

tape('update_dotcolor_legend keeps legend groups matched after filtering', function (test) {
	test.timeoutAfter(100)

	const table = select('body').append('table')
	const obj = {
		legendtable: table,
		attr_levels: [{ key: 'attr1' }, { key: 'attr2' }],
		sample_attributes: {
			attr1: {},
			attr2: { values: { x: { label: 'x', color: 'red' }, y: { label: 'y', color: 'blue' } } }
		},
		dots: [
			{ sample: 's1', s: { attr1: 'GroupA', attr2: 'x' } },
			{ sample: 's2', s: { attr1: 'GroupB', attr2: 'y' } }
		]
	}

	legend_attr_levels(obj)

	// only s1 (GroupA) passes the filter, so only the GroupA legend group should stay visible
	obj.filteredSamples = new Set(['s1'])
	update_dotcolor_legend(obj)

	const groupDivs = table.node().querySelectorAll('.sja_lb_div')
	const visible = Array.from(groupDivs).filter(d => d.style.display != 'none')
	test.equal(visible.length, 1, 'only the matching legend group should stay visible')
	test.ok(visible[0].querySelector('.sja_l1lb').textContent.includes('GroupA'), 'the visible group should be GroupA')

	table.remove()
	test.end()
})
