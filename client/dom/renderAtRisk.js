import { select } from 'd3-selection'

/*
render at-risk counts at x-axis tick values

used by survival plot and cuminc plot

input parameter:
{
    g: selection
    s: {} self.settings
    chart: {} chart object
    term2values: TODO: is this ever defined?
    term2toColor: {} map term2 values to colors
}
*/

export function renderAtRiskG({ g, s, chart, term2values, term2toColor, onSerieClick }) {
	const bySeries = {}

	// do not compute at-risk counts of tick values that are
	// smaller than the first timepoint of the chart
	// e.g. if all curves start at 5 years, we do not want
	// to compute at-risk counts at tick value 0
	const xTickValues = chart.xTickValues.filter(xTick => xTick >= chart.xMin)

	// compute at-risk counts of filtered tick values
	for (const series of chart.visibleSerieses) {
		const counts = []
		let i = 0,
			d = series.data[0],
			prev = d, // prev = "previous" data point
			nCensored = 0

		// for each x-axis tick value, find and use the data that applies
		for (const time of xTickValues) {
			while (d && d.x < time) {
				nCensored += d.ncensor
				prev = d
				i++
				d = series.data[i]
			}

			// prev will become last timepoint before tick value
			// for example, if tick value is 10 and timepoint A is at time 8.5, timepoint B is at time 9.2, timepoint C is at 9.8, and timepoint D is at time 10.2, then prev will be set to the timepoint C
			// the at-risk count at tick value 10 will then be the nrisk at prev minus any events/censored exits that occurred at prev

			if (d && d.x === time) {
				// iterated timepoint is equal to tick value
				// can use nrisk of timepoint as the nrisk of tick value
				counts.push([time, d.nrisk, nCensored])
			} else {
				// iterated timepoint does not equal tick value
				// use the nrisk of prev minus any events/censored exits
				// at prev as the nrisk of tick value
				counts.push([time, prev.nrisk - prev.nevent - prev.ncensor, nCensored])
			}
		}
		bySeries[series.seriesId] = counts
	}

	const y = s.svgh - s.svgPadding.top - s.svgPadding.bottom + 60 // make y-offset option???
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

	let data
	g.selectAll('.sjpp-atrisk-title').remove()
	if (s.atRiskVisible) {
		// at-risk counts are visible
		// sort the data
		data = Object.keys(bySeries).sort((a, b) => seriesOrder.indexOf(a) - seriesOrder.indexOf(b))
		// render the title
		// add a y offset to title if there is no series id
		const addYoffset = chart.serieses.length == 1 && !chart.serieses[0].seriesId
		const titleg = g
			.append('text')
			.attr('class', 'sjpp-atrisk-title')
			.attr('transform', `translate(${s.atRiskLabelOffset}, ${addYoffset ? 2 * s.axisTitleFontSize : 0})`)
			.attr('text-anchor', 'end')
			.attr('font-size', `${s.axisTitleFontSize - 4}px`)
			.attr('cursor', chart.serieses.length == 1 ? 'pointer' : 'default')
			.text('Number at risk')
			.on('click', chart.serieses.length == 1 ? e => onSerieClick({ seriesId: '' }, e.clientX, e.clientY) : null)
		if (term2toColor['']) titleg.style('fill', s.defaultColor)
		titleg
			.append('tspan')
			.attr('x', 0)
			.attr('y', s.axisTitleFontSize - 4)
			.text('(# censored)')
	} else {
		// at-risk counts are not visible
		// empty the data
		data = []
	}

	// render at-risk counts
	const sg = g
		.attr('transform', `translate(0,${y})`)
		.selectAll(':scope > g')
		.data(data, seriesId => seriesId)

	sg.exit().remove()

	sg.each(function (seriesId, i) {
		const y = (i + 1) * (2 * s.axisTitleFontSize)
		const g = select(this)
			.attr('transform', `translate(0,${y})`)
			.attr('fill', term2toColor[''] ? s.defaultColor : term2toColor[seriesId].adjusted) // TODO: attached series color to the data of 'sg'
		renderAtRiskTick(g.select(':scope>g'), chart, xTickValues, s, seriesId, bySeries[seriesId])
	})

	sg.enter()
		.append('g')
		.each(function (seriesId, i) {
			const y = (i + 1) * (2 * s.axisTitleFontSize)
			const g = select(this)
				.attr('transform', `translate(0,${y})`)
				.attr('fill', term2toColor[''] ? s.defaultColor : term2toColor[seriesId].adjusted)
				.on('click', e => onSerieClick({ seriesId }, e.clientX, e.clientY))

			const sObj = chart.serieses.find(s => s.seriesId === seriesId)
			g.append('text')
				.attr('data-testid', 'sjpp-atrisk-seriesId')
				.attr('transform', `translate(${s.atRiskLabelOffset}, 0)`)
				.attr('text-anchor', 'end')
				.attr('font-size', `${s.axisTitleFontSize - 4}px`)
				.attr('cursor', 'pointer')
				.datum({ seriesId })
				.text(seriesId && seriesId != '*' ? sObj.seriesLabel || seriesId : '')

			renderAtRiskTick(g.append('g'), chart, xTickValues, s, seriesId, bySeries[seriesId])
		})
}

function renderAtRiskTick(g, chart, xTickValues, s, seriesId, series) {
	const reversed = series.slice().reverse()
	const data = xTickValues.map(tickVal => {
		if (tickVal === 0) return { seriesId, tickVal, atRisk: series[0][1], nCensored: series[0][2] }
		const d = reversed.find(d => d[0] <= tickVal)
		return { seriesId, tickVal, atRisk: d[1], nCensored: d[2] }
	})

	const text = g.selectAll('text').data(data)
	text.exit().remove()
	text
		.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', `${s.axisTitleFontSize - 4}px`)
		.attr('cursor', 'pointer')
		.each(renderAtRiskLabel)
	text
		.enter()
		.append('text')
		.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
		.attr('text-anchor', 'middle')
		.attr('font-size', `${s.axisTitleFontSize - 4}px`)
		.attr('cursor', 'pointer')
		.each(renderAtRiskLabel)

	function renderAtRiskLabel(d) {
		const tspans = select(this)
			.selectAll('tspan')
			.data([d.atRisk, `(${d.nCensored})`])

		tspans.exit().remove()

		tspans.attr('y', (d, i) => (i === 0 ? 0 : i * (s.axisTitleFontSize - 4))).text(d => d)

		tspans
			.enter()
			.append('tspan')
			.attr('x', 0)
			.attr('y', (d, i) => (i === 0 ? 0 : i * (s.axisTitleFontSize - 4)))
			.text(d => d)
	}
}
