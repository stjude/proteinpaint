import tape from 'tape'
import { select } from 'd3-selection'
import { renderResponseDistribution } from '../renderResponseDistribution.js'

/*
Tests for the response-distribution combo chart (SC line on the left axis, grey POC columns on
the right axis, three performance zones as background bands).

  • multi-site SC → an SC line (path.sc-line) plus a grey POC column per rating and 3 zone bands
  • single-site SC (total = 1) → a single SC point, no line
*/

const ZONES = [
	{ label: 'Weak', min: 1, max: 5, color: '#f4cccc' },
	{ label: 'Intermediate', min: 6, max: 7, color: '#fce5cd' },
	{ label: 'Strong', min: 8, max: 10, color: '#d9ead3' }
]
const TEXTS = {
	leftAxisLabel: 'Number of SC Responses',
	rightAxisLabel: 'Number of POC Staff Responses',
	xAxisLabel: 'Impression Rating'
}
const attachTip = (sel: any, text: string, hover?: any) => {
	sel.datum({ tip: text, ...(hover || {}) })
}

// counts[] is per rating 1..10; build the {rating,count,pct} bins the server returns.
function dist(counts: number[]) {
	const total = counts.reduce((s, c) => s + c, 0)
	return counts.map((count, i) => ({
		rating: i + 1,
		count,
		pct: total ? Math.round((count / total) * 1000) / 10 : 0
	}))
}

tape('\n', function (test) {
	test.comment('-***- profile/renderResponseDistribution -***-')
	test.end()
})

tape('multi-site: SC line + POC columns + zones render', function (test) {
	const holder = select('body').append('div')
	renderResponseDistribution({
		holder,
		id: 'test-multi',
		maxScore: 10,
		// reference mock-up SC + POC counts
		scDistribution: dist([1, 5, 4, 5, 6, 7, 11, 8, 1, 1]),
		pocDistribution: dist([14, 21, 58, 70, 99, 105, 121, 63, 24, 8]),
		texts: TEXTS,
		zones: ZONES,
		colors: { sc: '#2381c3' },
		attachTip
	})
	const svg = holder.select('svg')
	test.equal(svg.size(), 1, 'one svg is created in the holder')
	test.equal(holder.selectAll('rect.impression-zone').size(), 3, 'three performance-zone bands drawn')
	test.equal(holder.selectAll('rect.poc-column').size(), 10, 'one POC column per rating 1..10')
	test.equal(holder.selectAll('path.sc-line').size(), 1, 'a single SC line is drawn for multi-site data')
	test.ok(holder.selectAll('circle.sc-point').size() >= 1, 'SC line vertices are drawn as points')
	holder.remove()
	test.end()
})

tape('single-site SC (total = 1): a point, no line', function (test) {
	const holder = select('body').append('div')
	renderResponseDistribution({
		holder,
		id: 'test-single',
		maxScore: 10,
		scDistribution: dist([0, 0, 0, 0, 0, 0, 1, 0, 0, 0]), // one SC response at rating 7
		pocDistribution: dist([2, 3, 5, 8, 9, 7, 6, 4, 1, 0]),
		texts: TEXTS,
		zones: ZONES,
		colors: { sc: '#2381c3' },
		attachTip
	})
	test.equal(holder.selectAll('path.sc-line').size(), 0, 'no SC line for a single SC response')
	test.equal(holder.selectAll('circle.sc-point').size(), 1, 'exactly one SC point is drawn')
	test.equal(holder.selectAll('rect.poc-column').size(), 10, 'POC columns still render for all ratings')
	holder.remove()
	test.end()
})
