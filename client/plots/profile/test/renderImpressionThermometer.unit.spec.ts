import tape from 'tape'
import { select } from 'd3-selection'
import type { BaseType } from 'd3-selection'
import { renderImpressionThermometer } from '../renderImpressionThermometer.js'
import type { ImpressionThermometerArgs } from '../renderImpressionThermometer.js'

/*
Tests for the impression thermometer (one welded glass vessel, two liquid columns, split bulb).

  • both medians → one welded vessel outline, the zone bands, both fills, a full split reservoir
  • zone bands → one discrete band per zone, in the zone colors at the 0.3 opacity the sibling
    response-distribution chart uses, tiling the vessel with each label centered on its band
  • geometry → the vessel path carries no NaN and welds the bulb in rather than stroking it apart
  • liquid → fills are opaque, and no white surface decoration is drawn over them
  • hover → the fill eases to a lighter shade and back, with no outline
  • hit area → nothing painted over the columns intercepts pointer events
  • SC-only (poc: null) → the SC fill only, one legend row
  • null SC median → the POC fill only
  • both medians null → the empty vessel still renders
  • two instances in one holder → no defs id collision
*/

const ZONES = [
	{ label: 'Weak', min: 1, max: 5, color: '#f4cccc' },
	{ label: 'Intermediate', min: 6, max: 7, color: '#fce5cd' },
	{ label: 'Strong', min: 8, max: 10, color: '#d9ead3' }
]
const SC_COLOR = '#2381c3'
const POC_GREY = '#9e9e9e'

const attachTip = (sel: any, text: string, hover?: any) => {
	sel.datum({ tip: text, ...(hover || {}) })
}

function render(holder: any, over: Partial<ImpressionThermometerArgs> = {}) {
	renderImpressionThermometer({
		holder,
		id: 'test-thermo',
		sc: { median: 7, total: 12 },
		poc: { median: 5, total: 340 },
		ratingAxisLabel: 'Impression Rating',
		zones: ZONES,
		colors: { sc: SC_COLOR },
		attachTip,
		...over
	} as ImpressionThermometerArgs)
}

// Arc commands in a path `d`, as [rx, ry, rot, largeArc, sweep, x, y] number tuples.
function arcs(d: string): number[][] {
	return (d.match(/A [^A-Z]+/g) || []).map(a => a.slice(2).trim().split(/\s+/).map(Number))
}

tape('\n', function (test) {
	test.comment('-***- profile/renderImpressionThermometer -***-')
	test.end()
})

tape('both medians: welded vessel, zone bands, two liquid columns', function (test) {
	const holder = select('body').append('div')
	render(holder)

	test.equal(holder.selectAll('svg').size(), 1, 'one svg is created in the holder')
	test.equal(holder.selectAll('path.vessel-outline').size(), 1, 'the vessel is stroked as a single outline')
	test.equal(
		holder
			.selectAll('circle')
			.filter(function (this: BaseType) {
				return select(this).attr('stroke') == '#444'
			})
			.size(),
		0,
		'the bulb is welded into the vessel path, not stroked as a separate circle'
	)

	test.equal(holder.selectAll('rect.impression-zone').size(), ZONES.length, 'one background band per zone')

	test.equal(holder.selectAll('path.sc-fill').size(), 1, 'one SC liquid column')
	test.equal(holder.select('path.sc-fill').attr('fill'), SC_COLOR, 'the SC column uses the module color')
	test.equal(holder.selectAll('path.poc-fill').size(), 1, 'one POC liquid column')
	test.equal(holder.select('path.poc-fill').attr('fill'), POC_GREY, 'the POC column uses the POC grey')

	test.equal(holder.selectAll('g .tick').size(), 10, 'one tick per rating 1..10')

	/*
	Zone names and series swatches belong to the shared card legend, not to this chart. Drawing
	them here too put the same text on screen twice, side by side, at two sizes and two greys.
	*/
	test.equal(holder.selectAll('text.impression-zone-label').size(), 0, 'no zone labels in the thermometer')
	test.equal(holder.selectAll('g.impression-legend-item').size(), 0, 'no legend in the thermometer')

	holder.remove()
	test.end()
})

tape('zone bands match the distribution chart contract and tile the vessel', function (test) {
	const holder = select('body').append('div')
	render(holder)

	const bands: { color: string; opacity: string; top: number; bottom: number }[] = []
	holder.selectAll('rect.impression-zone').each(function (this: BaseType) {
		const r = select(this)
		bands.push({
			color: r.attr('fill'),
			opacity: r.attr('opacity'),
			top: +r.attr('y'),
			bottom: +r.attr('y') + +r.attr('height')
		})
	})

	test.equal(bands.length, ZONES.length, 'one band per zone')
	test.deepEqual(
		bands.map(b => b.color).sort(),
		ZONES.map(z => z.color).sort(),
		'the bands use exactly the zone colors, with no substitutions'
	)
	test.ok(
		bands.every(b => b.opacity === '0.3'),
		'every band uses the 0.3 opacity the distribution chart paints its zone bands at'
	)
	test.ok(
		bands.every(b => b.bottom > b.top),
		'every band has positive height'
	)

	/*
	The bands must tile the vessel: sorted top to bottom each one starts exactly where the previous
	ended. A gap would show the page background through the glass; an overlap would double the 0.3
	opacity and darken one zone against the distribution chart's rendering of the same zone.
	*/
	const sorted = bands.slice().sort((b1, b2) => b1.top - b2.top)
	for (let i = 1; i < sorted.length; i++) {
		test.equal(sorted[i].top, sorted[i - 1].bottom, `band ${i} starts exactly where band ${i - 1} ends`)
	}

	/*
	The lowest band carries on past rating 0 into the bulb, so the reservoir reads as the low end.
	Compare against the liquid's own depth — the first L command, which runs down the centre
	divider to the bottom of the bulb.
	*/
	const firstL = /L ([\d.]+) ([\d.]+)/.exec(holder.select('path.sc-fill').attr('d'))
	test.equal(sorted[sorted.length - 1].bottom, Number(firstL?.[2]), 'the lowest band reaches the bottom of the bulb')

	holder.remove()
	test.end()
})

tape('vessel geometry: no NaN, bulb welded in, liquid runs into the reservoir', function (test) {
	const holder = select('body').append('div')
	render(holder)
	const d = holder.select('path.vessel-outline').attr('d')

	test.notOk(/NaN/.test(d), 'the vessel path contains no NaN')
	test.ok(/^M .* Z$/.test(d), 'the vessel path is closed')

	const vesselArcs = arcs(d)
	test.equal(vesselArcs.length, 4, 'top cap, two neck fillets and the bulb arc')
	const capR = vesselArcs[0][0]
	const bulbArc = vesselArcs[2]
	test.equal(bulbArc[3], 1, 'the bulb arc takes the long way around (large-arc flag set)')
	test.ok(bulbArc[0] > capR, 'the bulb radius exceeds the tube radius, so the reservoir reads weightier')

	/*
	Each series is ONE closed path: half the bulb circle with the bar rising straight out of it —
	no joining shape, no taper. Earlier attempts drew the bulb half as its own element (which left
	the reservoir unhoverable) and then butted a reservoir rectangle onto the bar (which stepped
	from bar width to bulb width in one jump). The structure asserted here is the fix for both.
	*/
	const liquidOf = (sel: string) => {
		const cmds = (
			holder
				.select(sel)
				.attr('d')
				.match(/[A-Z][^A-Z]*/g) || []
		).map(s => ({
			op: s[0],
			n: s
				.slice(1)
				.split(/[^\d.-]+/)
				.filter(Boolean)
				.map(Number)
		}))
		const as = cmds.filter(c => c.op === 'A')
		const ls = cmds.filter(c => c.op === 'L')
		return {
			ops: cmds.map(c => c.op).join(''),
			centre: cmds[0].n[0],
			barOuter: as[0].n[5],
			joinY: ls[0].n[1],
			bulbR: as[1].n[0],
			bottom: as[1].n[6]
		}
	}

	for (const sel of ['path.sc-fill', 'path.poc-fill']) {
		const d = holder.select(sel).attr('d')
		test.equal((d.match(/M /g) || []).length, 1, `${sel} is a single closed subpath`)
		test.notOk(/NaN/.test(d), `${sel} contains no NaN`)
		test.equal(liquidOf(sel).ops, 'MALALZ', `${sel} is dome, bar wall, bulb arc, centre — nothing else`)
	}

	const scL = liquidOf('path.sc-fill')
	const pocL = liquidOf('path.poc-fill')

	test.equal(scL.centre, pocL.centre, 'both liquids share the centre divider')
	test.equal(scL.bottom, pocL.bottom, 'both reach the bottom of the bulb')
	test.equal(scL.bulbR, bulbArc[0], 'the liquid arc uses the bulb radius, so the reservoir IS the bulb circle')
	test.equal(pocL.bulbR, bulbArc[0], 'both halves use the bulb radius')
	test.equal(scL.joinY, pocL.joinY, 'both bars meet the circle at the same height')
	test.equal(
		scL.centre - scL.barOuter,
		pocL.barOuter - pocL.centre,
		'the two bars are equal width and mirror about the centre'
	)

	/*
	The bar meets the circle exactly where the circle is as wide as the bar. That tangency is what
	removes the shoulder, so check it against the circle rather than trusting the constant.
	*/
	const bulbCy = scL.bottom - scL.bulbR
	const halfWidthAtJoin = Math.sqrt(scL.bulbR ** 2 - (bulbCy - scL.joinY) ** 2)
	test.ok(
		Math.abs(halfWidthAtJoin - (scL.centre - scL.barOuter)) < 0.01,
		'the bar wall meets the circle exactly, with no step'
	)

	/*
	Cylindrical shading stops at the neck. Carried into the bulb it traces each column's highlight
	across the reservoir, which reads as two cylinders rather than one sphere of liquid. The bulb
	tangent y is where the bulb begins, so nothing bar-shaped may extend past it.
	*/
	const neckY = bulbArc[6]
	holder.selectAll('path.liquid-gloss').each(function (this: BaseType) {
		const glossBottom = Number(select(this).attr('d').split(/\s+/)[2])
		test.ok(glossBottom <= neckY, 'the column gloss stops before the bulb')
	})

	// No white surface decoration on the liquid: the meniscus caps and the specular band are gone.
	test.equal(holder.selectAll('rect.glass-specular').size(), 0, 'no specular band down the tube')
	test.equal(holder.selectAll('ellipse.liquid-meniscus').size(), 0, 'no meniscus caps on the columns')
	test.equal(
		holder
			.selectAll('path')
			.filter(function (this: BaseType) {
				return select(this).attr('stroke') == '#fff'
			})
			.size(),
		0,
		'no white stroke is drawn anywhere inside the vessel'
	)

	holder.remove()
	test.end()
})

tape('liquid fills are opaque: no fill-opacity on the columns or reservoir', function (test) {
	const holder = select('body').append('div')
	render(holder)

	for (const sel of ['path.sc-fill', 'path.poc-fill']) {
		const el = holder.select(sel)
		test.equal(el.attr('opacity'), null, `${sel} carries no opacity attribute`)
		test.equal(el.attr('fill-opacity'), null, `${sel} carries no fill-opacity attribute`)
	}

	holder.remove()
	test.end()
})

tape('tooltips are bound as datum for the shared mousemove delegation', function (test) {
	const holder = select('body').append('div')
	render(holder)

	const scDatum: any = holder.select('path.sc-fill').datum()
	test.ok(/Site Coordinator median: 7/.test(scDatum.tip), 'the SC column carries its median in the tip text')

	const pocDatum: any = holder.select('path.poc-fill').datum()
	test.ok(/POC median: 5/.test(pocDatum.tip), 'the POC column carries its median in the tip text')

	/*
	The hover cue eases the fill to a lighter shade and back — no outline. The easing comes from a
	CSS transition declared on the element, so the shared delegation animates just by setting the
	attribute; without that transition the change would snap.
	*/
	for (const [name, sel, d, base] of [
		['SC', 'path.sc-fill', scDatum, SC_COLOR],
		['POC', 'path.poc-fill', pocDatum, POC_GREY]
	] as [string, string, any, string][]) {
		test.equal(d.on.stroke, undefined, `the ${name} hover cue adds no outline`)
		test.equal(d.off.fill, base, `the ${name} hover cue restores the series color`)
		test.notEqual(d.on.fill, base, `the ${name} hover cue changes the fill`)
		test.ok(
			/fill\s+\d+ms/.test(holder.select(sel).style('transition') || ''),
			`the ${name} column declares a fill transition, so the cue animates`
		)
	}

	holder.remove()
	test.end()
})

tape('the whole of each median column is hoverable', function (test) {
	const holder = select('body').append('div')
	render(holder)

	/*
	The columns are the only hover targets: every layer drawn over them is decorative and must opt
	out of hit-testing, or it would swallow mousemove somewhere along the column and leave dead
	patches where no tooltip appears. The fills themselves must NOT opt out.
	*/
	for (const sel of ['path.sc-fill', 'path.poc-fill']) {
		test.notEqual(holder.select(sel).attr('pointer-events'), 'none', `${sel} accepts pointer events`)
	}

	const fillNodes = ['path.sc-fill', 'path.poc-fill'].map(s => holder.select(s).node())
	const svgNode = holder.select('svg').node() as SVGSVGElement
	const all = Array.from(svgNode.querySelectorAll('path, rect, circle, ellipse'))
	const lastFillIdx = Math.max(...fillNodes.map(n => all.indexOf(n as Element)))

	// Anything painted after the last column, anywhere over the vessel, must be click-through.
	const blockers = all.slice(lastFillIdx + 1).filter(el => {
		if (el.closest('[pointer-events="none"]')) return false
		return !(el.getAttribute('pointer-events') === 'none')
	})
	test.deepEqual(
		blockers.map(el => el.getAttribute('class') || el.tagName),
		[],
		'no element painted over the columns intercepts pointer events'
	)

	// The column path spans its full height, so the hit area runs from the median into the bulb.
	for (const sel of ['path.sc-fill', 'path.poc-fill']) {
		const d = holder.select(sel).attr('d')
		const nums = d
			.split(/[\s,A-Za-z]+/)
			.filter(Boolean)
			.map(Number)
		const ys = nums.filter((_, i) => i % 2 === 1)
		test.ok(Math.max(...ys) - Math.min(...ys) > 100, `${sel} covers a tall, continuous hit area`)
	}

	holder.remove()
	test.end()
})

tape('SC-only module (poc: null): one liquid, vessel unchanged', function (test) {
	const holder = select('body').append('div')
	render(holder, { poc: null })

	test.equal(holder.selectAll('path.sc-fill').size(), 1, 'the SC liquid still renders')
	test.equal(holder.selectAll('path.poc-fill').size(), 0, 'no POC liquid, so no POC half of the reservoir either')
	test.equal(holder.selectAll('path.vessel-outline').size(), 1, 'the vessel is unchanged')

	holder.remove()
	test.end()
})

tape('null SC median: the POC column renders alone', function (test) {
	const holder = select('body').append('div')
	render(holder, { sc: { median: null, total: 0 } })

	test.equal(holder.selectAll('path.sc-fill').size(), 0, 'no SC liquid, so no SC half of the reservoir either')
	test.equal(holder.selectAll('path.poc-fill').size(), 1, 'the POC liquid still renders')

	holder.remove()
	test.end()
})

tape('both medians null: the empty vessel still renders', function (test) {
	const holder = select('body').append('div')
	render(holder, { sc: { median: null, total: 0 }, poc: { median: null, total: 0 } })

	test.equal(holder.selectAll('path.vessel-outline').size(), 1, 'the vessel is drawn')
	test.equal(holder.selectAll('rect.impression-zone').size(), ZONES.length, 'the zone bands are drawn')
	test.equal(holder.selectAll('path.sc-fill').size(), 0, 'no SC column')
	test.equal(holder.selectAll('path.poc-fill').size(), 0, 'no POC column')

	holder.remove()
	test.end()
})

tape('two thermometers in one holder: defs ids do not collide', function (test) {
	const holder = select('body').append('div')
	render(holder.append('div'), { id: 'grp-0' })
	render(holder.append('div'), { id: 'grp-1' })

	test.equal(
		holder.selectAll('linearGradient#grp-0-liquid-sheen').size(),
		1,
		'the first group owns its own sheen gradient'
	)
	test.equal(
		holder.selectAll('linearGradient#grp-1-liquid-sheen').size(),
		1,
		'the second group owns its own sheen gradient'
	)
	test.equal(holder.selectAll('clipPath#grp-0-vessel-clip').size(), 1, 'the first group owns its own vessel clip')
	test.equal(holder.selectAll('clipPath#grp-1-vessel-clip').size(), 1, 'the second group owns its own vessel clip')

	holder.remove()
	test.end()
})
