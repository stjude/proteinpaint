import { select } from 'd3-selection'

/*
render at-risk counts at specific x-axis tick values

used by survival plot and cuminc plot

input parameter:
{
    g: selection
    s: {} self.settings
    chart: {} chart object
    hidden: [] hidden series
    term2values: TODO: is this ever defined?
    term2toColor: {} map term2 values to colors
}
*/

export function renderAtRiskG({ g, s, chart, hidden, term2values, term2toColor }) {
	const bySeries = {}
	for (const series of chart.visibleSerieses) {
		const counts = []
		let i = 0,
			d = series.data[0],
			prev = d, // prev = "previous" data point
			nCensored = 0

		// for each x-axis timepoint, find and use the data that applies
		for (const time of chart.xTickValues) {
			while (d && d.x < time) {
				nCensored += d.ncensor
				prev = d
				i++
				d = series.data[i]
			}
			// NOTE:
			// prev will become last timepoint before tick value
			// for example, if tick value is 10 and timepoint A is at time 8.5, timepoint B is at time 9.2, timepoint C is at 9.8, and timepoint D is at time 10.2, then prev will be set to the timepoint C
			// the at-risk count at tick value 10 will then be the nrisk at prev minus any events/censored exits that occurred at prev
			counts.push([time, prev.nrisk - prev.nevent - prev.ncensor, nCensored])
		}
		bySeries[series.seriesId] = counts
	}

	const y = s.svgh - s.svgPadding.top - s.svgPadding.bottom + 50 // make y-offset option???
	// fully rerender, later may reuse previously rendered elements
	// g.selectAll('*').remove()

	const seriesOrder = chart.serieses.map(s => s.seriesId)
	if (term2values) {
		seriesOrder.sort((aId, bId) => {
			const av = term2values[aId]
			const bv = term2values[bId]
			if (av && bv) {
				if ('order' in av && 'order' in bv) return av.order - bv.order
				if (av.order) return av.order
				if (bv.order) return bv.order
				return 0
			}
			if (av) return av.order || 0
			if (bv) return bv.order || 0
			return 0
		})
	}

	const data = !s.atRiskVisible
		? []
		: Object.keys(bySeries).sort((a, b) => seriesOrder.indexOf(a) - seriesOrder.indexOf(b))

	const sg = g
		.attr('transform', `translate(0,${y})`)
		.selectAll(':scope > g')
		.data(data, seriesId => seriesId)

	sg.exit().remove()

	sg.each(function(seriesId, i) {
		const y = (i + 1) * (2 * (s.axisTitleFontSize + 4))
		const g = select(this)
			.attr('transform', `translate(0,${y})`)
			.attr('fill', hidden.includes(seriesId) ? '#aaa' : term2toColor[seriesId].adjusted) // TODO: attached series color to the data of 'sg'

		renderAtRiskTick(g.select(':scope>g'), chart, s, seriesId, bySeries[seriesId])
	})

	sg.enter()
		.append('g')
		.each(function(seriesId, i) {
			const y = (i + 1) * (2 * (s.axisTitleFontSize + 4))
			const g = select(this)
				.attr('transform', `translate(0,${y})`)
				.attr('fill', hidden.includes(seriesId) ? '#aaa' : term2toColor[seriesId].adjusted)

			const sObj = chart.serieses.find(s => s.seriesId === seriesId)
			g.append('text')
				.attr('transform', `translate(${s.atRiskLabelOffset}, 0)`)
				.attr('text-anchor', 'end')
				.attr('font-size', `${s.axisTitleFontSize - 4}px`)
				.attr('cursor', 'pointer')
				.datum({ seriesId })
				.text(seriesId && seriesId != '*' ? sObj.seriesLabel || seriesId : 'At-risk')

			renderAtRiskTick(g.append('g'), chart, s, seriesId, bySeries[seriesId])
		})
}

function renderAtRiskTick(g, chart, s, seriesId, series) {
	const reversed = series.slice().reverse()
	const data = chart.xTickValues.map(tickVal => {
		if (tickVal === 0) return { seriesId, tickVal, atRisk: series[0][1], nCensored: series[0][2] }
		const d = reversed.find(d => d[0] <= tickVal)
		return { seriesId, tickVal, atRisk: d[1], nCensored: d[2] }
	})

	const text = g.selectAll('text').data(data)
	text.exit().remove()
	text.each(renderAtRiskTspans)
	text
		.enter()
		.append('text')
		.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', `${s.axisTitleFontSize - 4}px`)
		.attr('cursor', 'pointer')
		.each(renderAtRiskTspans)

	function renderAtRiskTspans(d) {
		const atRiskTickLabel = select(this)
			.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
			.attr('font-size', `${s.axisTitleFontSize - 4}px`)

		const tspans = atRiskTickLabel.selectAll('tspan').data([d.atRisk, d.nCensored])

		tspans.exit().remove()

		tspans
			.attr('x', 0)
			.attr('y', (d, i) => i * s.axisTitleFontSize)
			.text((d, i) => (i === 0 ? d : `(${d})`))

		tspans
			.enter()
			.append('tspan')
			.attr('x', 0)
			.attr('y', (d, i) => i * s.axisTitleFontSize)
			.text((d, i) => (i === 0 ? d : `(${d})`))
	}
}
