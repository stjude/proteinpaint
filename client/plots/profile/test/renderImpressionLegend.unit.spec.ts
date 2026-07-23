import tape from 'tape'
import { select } from 'd3-selection'
import type { BaseType } from 'd3-selection'
import { renderImpressionLegend } from '../renderImpressionLegend.js'

/*
Tests for the shared impression card legend — the single place the series and the performance
zones are named, drawn under the thermometer and the response-distribution chart together.

  • both series → a line+dot for SC, a square for POC, one square per zone, in one row
  • zone swatches carry the same 0.3 opacity the charts paint their background bands at
  • SC-only module (one series) → the POC entry is absent but the zones remain
  • zones are listed low to high regardless of the order the caller passes them in
*/

const ZONES = [
	{ label: 'Weak', min: 1, max: 5, color: '#f4cccc' },
	{ label: 'Intermediate', min: 6, max: 7, color: '#fce5cd' },
	{ label: 'Strong', min: 8, max: 10, color: '#d9ead3' }
]
const SC_COLOR = '#2381c3'
const POC_GREY = '#9e9e9e'

const SERIES = [
	{ color: SC_COLOR, label: 'Site Coordinator', symbol: 'line' as const },
	{ color: POC_GREY, label: 'POC Staff', symbol: 'square' as const }
]

const textsOf = (holder: any, sel: string) => {
	const out: string[] = []
	holder.selectAll(sel).each(function (this: BaseType) {
		out.push(select(this).select('text').text())
	})
	return out
}

tape('\n', function (test) {
	test.comment('-***- profile/renderImpressionLegend -***-')
	test.end()
})

tape('both series: a line+dot for SC, a square for POC, a square per zone', function (test) {
	const holder = select('body').append('div')
	renderImpressionLegend({ holder, series: SERIES, zones: ZONES })

	test.equal(holder.selectAll('svg').size(), 1, 'one svg is created in the holder')
	test.equal(holder.selectAll('g.impression-legend-item').size(), 2, 'one entry per series')
	test.equal(holder.selectAll('g.impression-legend-zone').size(), ZONES.length, 'one entry per zone')

	test.deepEqual(
		textsOf(holder, 'g.impression-legend-item'),
		['Site Coordinator', 'POC Staff'],
		'series labels render in the order given'
	)
	test.deepEqual(
		textsOf(holder, 'g.impression-legend-zone'),
		ZONES.map(z => z.label),
		'every zone is named'
	)

	/*
	Swatches mirror the marks in the response-distribution chart: SC is a line series, POC is
	columns. A circle for both would misrepresent the line graph the legend sits under.
	*/
	const scItem = holder.select('g.impression-legend-item')
	test.equal(scItem.selectAll('line').size(), 1, 'the SC swatch is a line')
	test.equal(scItem.selectAll('circle').size(), 1, 'the SC line carries a vertex dot')
	test.equal(scItem.select('line').attr('stroke'), SC_COLOR, 'the SC line uses the module color')
	test.equal(scItem.select('circle').attr('fill'), SC_COLOR, 'the SC dot uses the module color')

	const pocItem = holder.selectAll('g.impression-legend-item').filter((_, i) => i === 1)
	test.equal(pocItem.selectAll('rect').size(), 1, 'the POC swatch is a square')
	test.equal(pocItem.selectAll('line').size(), 0, 'the POC swatch is not a line')
	test.equal(pocItem.select('rect').attr('fill'), POC_GREY, 'the POC square uses the POC grey')

	holder.remove()
	test.end()
})

tape('zone swatches match the bands as rendered', function (test) {
	const holder = select('body').append('div')
	renderImpressionLegend({ holder, series: SERIES, zones: ZONES })

	const fills: string[] = []
	const opacities: string[] = []
	holder.selectAll('g.impression-legend-zone rect').each(function (this: BaseType) {
		const r = select(this)
		fills.push(r.attr('fill'))
		opacities.push(r.attr('opacity'))
	})

	test.deepEqual(
		fills,
		ZONES.map(z => z.color),
		'zone swatches use the zone colors'
	)
	/*
	The charts paint their background bands at 0.3, so a fully saturated swatch would not be the
	color the viewer actually sees beside it.
	*/
	test.ok(
		opacities.every(o => o === '0.3'),
		'zone swatches carry the same 0.3 opacity the bands are painted at'
	)

	holder.remove()
	test.end()
})

tape('SC-only module: no POC entry, zones still named', function (test) {
	const holder = select('body').append('div')
	renderImpressionLegend({ holder, series: [SERIES[0]], zones: ZONES })

	test.equal(holder.selectAll('g.impression-legend-item').size(), 1, 'only the SC entry')
	test.deepEqual(textsOf(holder, 'g.impression-legend-item'), ['Site Coordinator'], 'the SC label renders')
	test.equal(holder.selectAll('g.impression-legend-zone').size(), ZONES.length, 'the zones are still named')

	holder.remove()
	test.end()
})

tape('zones are ordered low to high whatever order they arrive in', function (test) {
	const holder = select('body').append('div')
	const shuffled = [ZONES[2], ZONES[0], ZONES[1]]
	renderImpressionLegend({ holder, series: SERIES, zones: shuffled })

	test.deepEqual(
		textsOf(holder, 'g.impression-legend-zone'),
		['Weak', 'Intermediate', 'Strong'],
		'zones read low to high'
	)
	// The caller's array is shared with both chart renderers, so it must not be sorted in place.
	test.deepEqual(shuffled, [ZONES[2], ZONES[0], ZONES[1]], "the caller's zones array is left untouched")

	holder.remove()
	test.end()
})
