import { select } from 'd3-selection'
import { scaleLinear, scaleLog } from 'd3-scale'
import { axisLeft, axisTop } from 'd3-axis'
import { format } from 'd3-format'

/*
arguments: 
  - holder: d3-selected DOM element

returns: 
  a bar chart renderer (main) function with the following argument 
  {
    // *** COMPUTED AGGREGATES ***
    maxAcrossCharts: number,   
    charts: [{
      chartId: string | number,
      total: number,
      maxSeriesTotal: number,
      serieses: [{
        seriesId: string | number,
        total: number,
        data: [{
          dataId: string | number,
          total: "+1"
        }]
      },

      // *** RENDERER SETTINGS ***
      // will extend instance settings
      // partial example below, see
      // bar.settings for a full example,
      // reuses config keys from tp.schema
      settings: {
        cols: [$seriesId],
        colgrps: [col2name.$seriesId.grp], 
        rows: [$dataId],
        rowgrps: [row2name.$seriesId.grp], // for clustering bars
        col2name: {
          $seriesId: {
            name: $seriesId,
            grp: string | number
          }
        },
        row2name: {
          $dataId: {
            name: $dataId,
            grp: string | number
          }
        }
      },

      // *** EVENT CALLBACK FUNCTIONS ***
      // for optional user interactivity
      // see bars.app.js for example event handlers
      // event handlers are passed the data as bound
      // to the element by d3.data([...], bindkey)
      handlers: {
        svg: {
          mouseover(),
          mouseout()
        },
        series: {
          mouseover(),
          mouseout(),
          rectFill()
        },
        barLabel: {
          text: d => d,
          mouseover(d) {},
          mouseout()
        },
        legend: {
          text(),
          mouseover(),
          mouseout(),
          click(),
        },
        yAxis: {
          text()
        },
        xAxis: {
          text()
        }
      }
    }]
  }
*/

const formatter = format('d')

export default function barsRenderer(barsapp, holder) {
	holder.selectAll('*').remove() // clear holder
	const hm = {},
		computed = {}
	const emptyObj = {} //used to represent any empty cell
	let chart
	let chartTitle
	let svg, mainG, series, collabels, rowlabels
	let axisG, yAxis, yTitle, yLine, xAxis, xTitle, xLine
	let currCell, currRects, currRowTexts, currColTexts
	let defaults //will have key values in init
	let currserieses = []
	let prevBox

	function main(_chart) {
		let prevOrientation = hm.orientation
		chart = _chart
		Object.assign(hm, chart.settings)
		hm.handlers = chart.handlers
		hm.cols = hm.cols.filter(colId => hm.colLabels.find(d => d.id == colId))
		hm.rows = hm.rows?.filter(d => !hm.exclude.rows.includes(d)) || []
		const nosvg = !svg
		if (nosvg) init(_chart)
		const unadjustedColw = hm.colw
		currserieses = chart.visibleSerieses
		currserieses.map(setIds)
		chart.serieses.map(setIds)
		setDimensions()
		_chart.name = hm.handlers.chart.title(chart)
		chartTitle
			.style('width', hm.svgw + 100 + 'px')
			//.style('font-weight', 600)
			.style('font-size', '1.1em')
			.style('margin-bottom', '24px')
			.html(_chart.name)

		// only set this initially to prevent
		// jerky svg resize on update
		if (nosvg) {
			svg.attr('height', 0).attr('width', 0).style('opacity', 0)
			mainG.attr('transform', 'translate(' + hm.rowlabelw + ',0)')
		}

		const s = series.attr('transform', seriesGrpTransform).selectAll('.bars-cell-grp').data(currserieses, seriesBindKey)
		s.exit().each(seriesExit)
		s.each(seriesUpdate)
		s.enter().append('g').each(seriesEnter)

		const c = collabels
			.attr('transform', colLabelsTransform)
			.style('opacity', prevOrientation != hm.orientation ? 0.0001 : 1)
			.style('display', hm.orientation != 'vertical' ? 'none' : '')
			.selectAll('g')
			.data(hm.colLabels, d => d.id)
		c.exit().remove()
		c.each(updateColLabel)
		c.enter().append('g').each(addColLabel)

		const r = rowlabels
			.attr('transform', rowLabelsTransform)
			.style('opacity', prevOrientation != hm.orientation ? 0.0001 : 1)
			.style('display', hm.orientation != 'horizontal' ? 'none' : '')
			.selectAll('g')
			.data(hm.colLabels, d => d.id)
		r.exit().remove()
		r.each(updateRowLabel)
		r.enter().append('g').each(addRowLabel)

		currRects = series.selectAll('rect')
		currColTexts = collabels.selectAll('text')
		hm.delay = 0.35 * hm.duration
		renderAxes(hm, prevOrientation, chart.visibleTotal)
		hm.colw = unadjustedColw

		if (prevOrientation != hm.orientation) {
			const labels = hm.orientation == 'vertical' ? collabels : rowlabels
			labels.transition().duration(1500).style('opacity', 1)
		}
		if (nosvg) {
			svg.transition().duration(100).attr('height', 1).attr('width', 1).style('opacity', 1)
		}

		setTimeout(
			() => {
				const extraPad = 20 // hardcode
				const currBox = mainG.node().getBBox()
				const bbox = !prevBox || currBox.width ? currBox : prevBox
				prevBox = bbox
				svg
					.transition()
					.duration(currBox.width ? 100 : 0)
					.attr('width', bbox.width + extraPad)
					.attr('height', bbox.height + extraPad)

				if (hm.orientation == 'vertical') {
					const cbox = collabels.node().getBBox()
					const ytbox = yTitle.node().getBBox()
					const xoffset = Math.max(-cbox.x, -ytbox.x, -bbox.x)
					mainG
						.transition()
						.duration(currBox.width ? 100 : 0)
						.attr('transform', 'translate(' + xoffset + ',' + -extraPad + ')')
				} else {
					const rbox = rowlabels.node().getBBox()
					const ytbox = yTitle.node().getBBox()
					const xtbox = xTitle.node().getBBox()
					mainG
						.transition()
						.duration(currBox.width ? 100 : 0)
						.attr('transform', 'translate(' + Math.max(-rbox.x, -ytbox.x) + ',' + -xtbox.y + ')')
				}
			},
			nosvg ? 110 : 510
		)
	}

	function init(_chart) {
		defaults = {
			geneonrow: hm.geneonrow,
			nicenames: {},

			colw: hm.geneonrow
				? Math.min(15, Math.max(1, Math.floor((document.body.clientWidth * 0.7) / hm.cols.length)))
				: 20,
			rowh: hm.geneonrow
				? 20
				: Math.min(18, Math.max(10, Math.floor((document.body.clientHeight * 0.7) / hm.rows.length))),

			rowspace: hm.geneonrow ? 2 : hm.rows.length > 100 ? 0 : 1,
			colspace: !hm.geneonrow ? 2 : hm.cols.length > 100 ? 0 : 1,

			rowtick: 8,
			coltick: 5,
			rowlabtickspace: 4,
			collabtickspace: 4,
			collabelh: 150,
			rowlabelw: 250,
			rowheadleft: true,
			colheadtop: false,

			samplecount4gene: true,
			samplecount4legend: false,

			showgrid: true,
			gridstroke: '#fff',
			showEmptyCells: false,

			cellbg: '#eeeeee',

			fontsizeratio: 0.9,
			rowlabelfontsizemax: 16,
			collabelfontsizemax: 12,
			crudefill: hm.colw <= 2,
			duration: 1000,
			delay: 0
		}

		for (let key in defaults) {
			if (!(key in hm) || key == 'cols' || key == 'rows') hm[key] = defaults[key]
		}

		if (!svg) {
			chartTitle = holder.append('div').attr('class', 'pp-chart-title').style('text-align', 'center')

			svg = holder
				.append('svg')
				.attr('class', 'pp-bars-svg')
				.style('overflow', 'visible')
				.on('mouseover.tphm2', hm.handlers.svg.mouseover)
				.on('mouseout.tphm2', hm.handlers.svg.mouseout)
				.on('click.tphm2', hm.handlers.svg.click)
			_chart.svg = svg
		}

		mainG = svg.append('g').attr('class', 'sjpcb-bars-mainG').attr('data-testid', 'sjpcb-bars-mainG')
		hm.h.svg = svg
		hm.h.mainG = mainG

		collabels = mainG
			.append('g')
			.attr('class', 'bars-collabels')
			.style('cursor', hm.handlers.barLabel.click ? 'pointer' : '')
			.on('mouseover.tphm2', colLabelMouseover)
			.on('mouseout.tphm2', colLabelMouseout)
			.on('click.tphm2', hm.handlers.barLabel.click)

		rowlabels = mainG
			.append('g')
			.attr('class', 'bars-rowlabels')
			.attr('data-testid', 'sjpcb-bars-rowlabels')
			.style('cursor', hm.handlers.barLabel.click ? 'pointer' : '')
			.on('mouseover.tphm2', colLabelMouseover)
			.on('mouseout.tphm2', colLabelMouseout)
			.on('click.tphm2', hm.handlers.barLabel.click)

		series = mainG
			.append('g')
			.attr('class', 'bars-series')
			.attr('data-testid', 'sjpcb-bars-series')
			.on('mouseover.tphm2', seriesMouseOver)
			.on('mouseout.tphm2', seriesMouseOut)
			.on('click', seriesClick)
			.style('cursor', 'pointer')

		axisG = mainG.append('g').attr('class', 'sjpcb-bar-chart-axis-g')
		yAxis = axisG.append('g').attr('class', 'sjpcb-bar-chart-y-axis')
		yLine = axisG.append('line').attr('class', 'sjpcb-bar-chart-y-line').style('stroke', '#000')
		yTitle = axisG.append('g').attr('class', 'sjpcb-bar-chart-y-title').style('cursor', 'default')
		xAxis = axisG.append('g').attr('class', 'sjpcb-bar-chart-x-axis')
		xLine = axisG.append('line').attr('class', 'sjpcb-bar-chart-x-line').style('stroke', '#000')
		xTitle = axisG.append('g').attr('class', 'sjpcb-bar-chart-x-title').style('cursor', 'default')
	}

	function setDimensions() {
		const maxChartsPerRow = hm.numCharts < 4 ? hm.numCharts : hm.numCharts % 3 == 0 ? 3 : 2
		const spacing =
			hm.cols.length * hm.colspace + (hm.colgrps.length - 1) * hm.colgspace + hm.rowlabelw + hm.rowgrplabelw

		if (hm.orientation == 'horizontal') {
			hm.svgw = Math.min(400, (0.92 * window.innerWidth) / maxChartsPerRow)
			hm.rowh = Math.max(14, Math.min(22, (0.7 * window.innerHeight) / hm.cols.length))
			hm.svgh =
				hm.cols.length * (hm.rowh + hm.colspace) -
				hm.colspace +
				(hm.colgrps.length - 1) * hm.colgspace +
				hm.rowlabelw +
				hm.rowgrplabelw
		} else {
			const maxSvgw = (window.innerWidth * 0.92) / maxChartsPerRow
			hm.colw = Math.min(Math.max(16, Math.round((maxSvgw - spacing) / hm.cols.length)), 30)
			hm.svgw =
				hm.cols.length * (hm.colw + hm.colspace) -
				hm.colspace +
				(hm.colgrps.length - 1) * hm.colgspace +
				hm.rowlabelw +
				hm.rowgrplabelw
			const numChartRows = Math.ceil(hm.numCharts / maxChartsPerRow)
			hm.svgh = Math.max(350, Math.min(400, window.innerHeight * 0.5)) / (numChartRows > 3 ? 2 : 1)
		}
		chart.svgh = hm.svgh

		hm.h.yScale = {}
		hm.h.xScale = {}
		hm.h.yPrevBySeries = {}
		hm.h.xPrevBySeries = {}
		const ratio = hm.scale == 'byChart' ? 1 : chart.maxVisibleSeriesTotal / chart.maxVisibleAcrossCharts
		for (const series of currserieses) {
			if (series.visibleData[0]) {
				// min should be 0 even if unit == 'log', since the bars are rendered in linear scale
				// according to the log of sample count. Previously, perhaps when log scale was used before,
				// min of 1 would have been required to avoid errors
				const min = 0 // hm.unit == 'log' ? 1 : 0
				const max =
					hm.unit == 'pct'
						? series.visibleTotal
						: hm.unit == 'log'
						? chart.maxSeriesLogTotal
						: chart.maxVisibleSeriesTotal

				hm.h.yScale[series.seriesId] = scaleLinear()
					.domain([min, max / ratio])
					.range([0, hm.svgh - hm.collabelh])

				hm.h.xScale[series.seriesId] = scaleLinear()
					.domain([min, max / ratio])
					.range([0, hm.svgw - hm.rowlabelw])

				hm.h.yPrevBySeries[series.seriesId] = 0
				hm.h.xPrevBySeries[series.seriesId] = 0
				// y or x positions are calculated based on
				// previous bar height or width total, respectively
				for (const data of series.visibleData) {
					data.height = getRectHeight(data)
					data.y = getRectY(data)
					// calculate x before width
					data.x = getRectX(data)
					data.width = getRectWidth(data)
				}
			}
		}

		computed.colfontsize = Math.min(hm.colw * hm.fontsizeratio, hm.collabelfontsizemax)
		computed.rowfontsize = Math.min(hm.rowh * hm.fontsizeratio, hm.rowlabelfontsizemax)
		computed.rowtextyalign = Math.min(hm.rowh, (hm.rowh + computed.rowfontsize) / 2) + hm.rowspace
	}

	function setIds(series) {
		if (!('seriesId' in series)) {
			series.data.map(data => {
				if (data) series.seriesId = data[hm.serieskey]
			})
		}
		series.data.map(d => {
			d.rowId = d[hm.rowkey]
			d.colId = d[hm.colkey]
		})
	}

	function seriesBindKey(series) {
		return series.seriesId
	}

	function cellKey(d) {
		return d.rowId + ' ' + d.colId //+' '+d.cellmateNum
	}

	function seriesExit() {
		select(this).remove()
	}

	function seriesUpdate(series) {
		const g = select(this).selectAll('.bars-cell').data(series.data.filter(filterData), cellKey)

		g.exit().each(function () {
			select(this).remove() //style("display", "none");
		})

		g.style('display', d => {
			return hm.cols.includes(d.colId) ? 'block' : 'none'
		})

		g.select('rect')
			.datum(d => d)
			.transition()
			.duration(hm.duration)
			.attr('x', d => d.x)
			.attr('y', d => d.y)
			.attr('width', d => d.width)
			.attr('height', d => d.height)
			.attr('fill', hm.handlers.series.rectFill)
			.attr('stroke', hm.handlers.series.strokeFill)

		g.enter().append('g').each(addCell)

		g.selectAll('text').remove()
		addAsterisks(g)
	}

	function seriesEnter(series) {
		if (!series || !series.data.length) return
		select(this)
			.attr('class', 'bars-cell-grp')
			.selectAll('g')
			.data(series.data.filter(filterData), cellKey)
			.enter()
			.append('g')
			.each(addCell)
	}

	function filterData(d) {
		return hm.rows.includes(d.dataId)
	}

	function addCell(d) {
		const g = select(this).attr('class', 'bars-cell').datum(d)

		g.style('display', d => {
			return hm.cols.includes(d.colId) ? 'block' : 'none'
		})
		g.append('rect')
			.attr('x', d => d.x)
			.attr('y', d => d.y)
			.attr('width', d => d.width)
			.attr('height', d => d.height)
			.attr('fill', hm.handlers.series.rectFill)
			.attr('stroke', hm.handlers.series.strokeFill)
			.attr('shape-rendering', 'crispEdges')
			.style('opacity', 0)
			.transition()
			.delay(hm.delay)
			.duration(hm.duration)
			.style('opacity', 1)
		addPercent(g, d)
		addAsterisks(g)
	}

	function addPercent(g, d) {
		if (!barsapp.config.term2 && barsapp.config.settings.barchart.showPercent) {
			const x = hm.orientation == 'horizontal' ? d.x + d.width + 8 : d.x + 4
			const y = hm.orientation == 'horizontal' ? d.y + d.height * 0.7 : d.y - 4
			const percent = (d.seriesTotal / d.chartTotal) * 100
			g.append('g')
				.attr('transform', `translate(${x}, ${y})`)
				.append('text')
				.style('font-size', '0.8em')
				.text(`${percent.toFixed(0)}%`)
		}
	}

	// add an asterisk to bars with a p-value below cutoff.
	function addAsterisks(g) {
		if (!barsapp.config.settings.barchart.asterisksVisible) {
			// if Asterisks visible checkbox is not checked.
			return
		}
		g.append('text')
			.text(d => {
				const test = d.groupPvalues && d.groupPvalues.term2tests.find(x => x.term2id == d.dataId)
				if (!test || test.skipped) return ''
				if (barsapp.config.settings.barchart.multiTestingCorr) {
					// is conducting multiple testing correction
					return test.adjusted_p_value < 0.05 ? '*' : ''
				} else return test.pvalue < 0.05 ? '*' : ''
			})
			.attr('x', d => d.x + d.width / 2)
			.attr('y', d => d.y + d.height / 2)
			.attr('dy', '0.6em')
			.style('text-anchor', 'middle')
			.style('opacity', 0)
			.transition()
			.delay(hm.delay)
			.duration(hm.duration)
			.style('opacity', 1)
	}

	function seriesGrpTransform() {
		const x = hm.colspace
		let y = hm.colheadtop ? hm.collabelh : hm.colgrplabelh
		if (hm.legendontop) y += hm.legendh
		return 'translate(' + x + ',' + y + ')'
	}

	function getRectHeight(d) {
		const total = hm.unit == 'log' ? d.logTotal : d.total
		const height = hm.orientation == 'vertical' ? hm.h.yScale[d.seriesId](total) : hm.rowh
		const rowspace = 0 //Math.round(height) > 1 ? hm.rowspace : 0;
		hm.h.yPrevBySeries[d.seriesId] += height + rowspace
		return Math.max(1, height - rowspace)
	}

	function getRectY(d) {
		const grpoffset = hm.colgrps.indexOf(d[hm.colgrpkey]) * hm.colgspace
		const h = hm.unit == 'log' ? Math.max(0, hm.h.yPrevBySeries[d.seriesId]) : hm.h.yPrevBySeries[d.seriesId]
		return hm.orientation == 'vertical'
			? hm.svgh - hm.collabelh - h
			: hm.cols.indexOf(d.colId) * (hm.rowh + hm.rowspace) + grpoffset
	}

	function getRectWidth(d) {
		const total = hm.unit == 'log' ? d.logTotal : d.total
		const width = hm.orientation == 'vertical' ? hm.colw : hm.h.xScale[d.seriesId](total)
		const colspace = 0 //Math.round(width) > 1 ? hm.colspace : 0;
		hm.h.xPrevBySeries[d.seriesId] += Math.max(1, width + colspace)
		return Math.max(1, width - colspace)
	}

	function getRectX(d) {
		const grpoffset = hm.colgrps.indexOf(d[hm.colgrpkey]) * hm.colgspace
		return hm.orientation == 'vertical'
			? hm.cols.indexOf(d.colId) * (hm.colw + hm.colspace) + grpoffset
			: hm.h.xPrevBySeries[d.seriesId]
	}

	function colLabelsTransform() {
		let x = 5 + hm.colspace
		let y = hm.colheadtop ? /*hm.collabelh -*/ hm.borderwidth + 1 : hm.svgh - hm.collabelh + 25
		if (hm.legendontop) y += hm.legendh
		return 'translate(' + x + ',' + y + ')'
	}

	function colLabelTransform(d) {
		const grp = hm.col2name[d] ? hm.col2name[d].grp : ''
		const x =
			hm.colgrps.indexOf(grp) * hm.colgspace +
			hm.cols.indexOf('id' in d ? d.id : d) * (hm.colw + hm.colspace) +
			hm.colw / 2
		const y = hm.colheadtop ? -1 * (hm.coltick + hm.collabtickspace) : hm.coltick + hm.collabtickspace
		return 'translate(' + x + ',' + y + ')'
	}

	function addColLabel(d) {
		if (!this || d === undefined) return
		const g = select(this).attr('transform', colLabelTransform).style('opacity', 0)

		g.append('text')
			.attr('transform', 'rotate(-40)')
			.attr('y', 2) //hm.colw / 3)
			.attr('text-anchor', 'end')
			.attr('font-size', computed.colfontsize + 'px')
			.html(hm.handlers.barLabel.text)

		g.transition().delay(hm.delay).duration(hm.duration).style('opacity', 1)
	}

	function updateColLabel(d) {
		const g = select(this).datum(d)

		g.attr('transform', colLabelTransform)

		g.selectAll('text')
			.datum(d)
			//.transition().duration(hm.duration)
			//.attr('transform', 'rotate(-90)')
			.attr('y', 2) //hm.colw / 3)
			.attr('text-anchor', 'end')
			.attr('font-size', computed.colfontsize + 'px')
			.html(hm.handlers.barLabel.text)
	}

	function rowLabelsTransform() {
		const y = hm.colheadtop ? hm.collabelh : hm.colgrplabelh //5 + hm.rowspace
		const x = hm.rowheadleft ? /*hm.collabelh -*/ hm.borderwidth + 1 : hm.svgw - hm.rowlabelw + 20
		return 'translate(' + x + ',' + y + ')'
	}

	function rowLabelTransform(d) {
		const grp = hm.row2name[d] ? hm.row2name[d].grp : ''
		const y =
			hm.colgrps.indexOf(grp) * hm.rowgspace +
			hm.cols.indexOf('id' in d ? d.id : d) * (hm.rowh + hm.rowspace) +
			computed.rowtextyalign
		const x = hm.rowheadleft ? -1 * (hm.rowtick + hm.rowlabtickspace) : hm.rowtick + hm.rowlabtickspace
		return 'translate(' + x + ',' + y + ')'
	}

	function addRowLabel(d) {
		if (!this || d === undefined) return
		const g = select(this).attr('transform', rowLabelTransform).style('opacity', 0)

		g.append('text')
			.attr('x', 2) //hm.colw / 3)
			.attr('text-anchor', 'end')
			.attr('font-size', computed.rowfontsize + 'px')
			.html(hm.handlers.barLabel.text)

		g.transition().delay(hm.delay).duration(hm.duration).style('opacity', 1)
	}

	function updateRowLabel(d) {
		const g = select(this).datum(d)

		g.attr('transform', rowLabelTransform) //.transition().duration(hm.duration)

		g.selectAll('text')
			.datum(d)
			//.transition().duration(hm.duration)
			//.attr('transform', 'rotate(-90)')
			.attr('x', 2) //hm.colw / 3)
			.attr('text-anchor', 'end')
			.attr('font-size', computed.rowfontsize + 'px')
			.html(hm.handlers.barLabel.text)
	}

	function rowTextWeight(d) {
		return d == currCell.rowId ? 700 : ''
	}

	function rowTextSize(d) {
		return d == currCell.rowId ? Math.max(12, computed.rowfontsize) : computed.rowfontsize
	}

	function rowTextColor(d) {
		return d == currCell.rowId ? '#00f' : ''
	}

	function colTextWeight(d) {
		return d == currCell.colId ? 700 : ''
	}

	function colTextSize(d) {
		return d == currCell.colId ? 12 : computed.colfontsize
	}

	function colTextColor(d) {
		return d == currCell.colId ? '#00f' : ''
	}

	function renderAxes(hm, prevOrientation, visibleTotal) {
		axisG
			.style('opacity', prevOrientation != hm.orientation ? 0 : 1)
			.transition()
			.duration(1500)
			.style('opacity', 1)
		if (hm.orientation == 'vertical') {
			renderAxesOnVertical(hm, visibleTotal)
		} else {
			renderAxesOnHorizontal(hm, visibleTotal)
		}
	}

	function renderAxesOnVertical(s, visibleTotal) {
		xAxis.style('display', 'none')
		yLine.style('display', 'none')
		const colLabelBox = collabels.node().getBBox()
		/*
		const lineY = s.svgh - s.collabelh + 24
    xLine
    .style('display','block')
    .attr("x1", 1)
    .attr("x2", s.svgw - s.svgPadding.left - hm.rowlabelw + s.cols.length*s.colspace)
    .attr("y1", lineY)
    .attr("y2", lineY)
    */

		xTitle.selectAll('*').remove()
		const xLabel = hm.handlers.xAxis.text(visibleTotal)
		xTitle
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.style('font-weight', 600)
			.text(xLabel)

		//const textBBox = xTitle.node().getBBox()
		setTimeout(() => {
			xTitle.attr(
				'transform',
				'translate(' +
					(s.svgw - s.svgPadding.left - s.svgPadding.right - s.rowlabelw) / 2 +
					',' +
					(colLabelBox.height + hm.svgh - hm.collabelh + 20 + s.axisTitleFontSize) +
					')'
			)
		}, 0)

		const range = [s.colgrplabelh, s.svgh - s.collabelh + s.colgrplabelh - s.borderwidth + 1]
		yAxis.style('display', 'block').call(getAxisScale(axisLeft, range, true))

		yTitle.selectAll('*').remove()
		const h = s.svgh - s.collabelh
		yTitle
			.style('font-weight', 600)
			.attr('transform', 'translate(' + (-s.svgPadding.left - s.axisTitleFontSize) + ',' + h / 2 + ')rotate(-90)')
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(hm.handlers.yAxis.text(visibleTotal))
	}

	function renderAxesOnHorizontal(s, visibleTotal) {
		yAxis.style('display', 'none')
		xLine.style('display', 'none')
		yTitle.selectAll('*').remove()

		const yLabel = hm.handlers.yAxis.text(visibleTotal)
		yTitle
			.append('text')
			.style('text-anchor', 'end')
			.style('font-size', s.axisTitleFontSize + 'px')
			.style('font-weight', 600)
			.text(yLabel)

		//const rowLabelBox = rowlabels.node().getBBox()
		setTimeout(() => {
			yTitle.style('text-anchor', 'end').attr(
				'transform',
				'translate(' +
					0 + //-rowLabelBox.width/2 +
					',0)'
			)
		}, 0)

		const range = [0, s.svgw - s.rowlabelw] // + s.rowgrplabelw - s.borderwidth]
		let y = s.colheadtop ? s.collabelh - 2 : s.colgrplabelh - 2
		if (s.legendontop) y += s.legendh

		xAxis
			.style('display', 'block')
			.attr('transform', 'translate(2.5,' + y + ')')
			.call(getAxisScale(axisTop, range))
		/*
    yLine
    .style('display','block')
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", y)
    .attr("y2", y + s.cols.length*s.rowh + 2)
    */

		xTitle.selectAll('*').remove()
		const w = s.svgw - s.rowlabelw
		xTitle
			.attr('transform', 'translate(' + w / 2 + ',0)')
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.style('font-weight', 600)
			.text(hm.handlers.xAxis.text(visibleTotal))
	}

	function getAxisScale(axisGenerator, range, reverseDomain = false) {
		const ratio =
			hm.scale == 'byChart' || hm.clickedAge ? 1 : chart.maxVisibleSeriesTotal / chart.maxVisibleAcrossCharts
		// NOTE: domain min value default assumes that the barchart is used for sample counts/integer values
		// TODO: may need to support float values in barchart?
		const min = hm.unit == 'log' ? 1 : 0
		const max = hm.unit == 'pct' ? 100 : chart.maxVisibleSeriesTotal //maxVisibleAcrossCharts
		const domain = [min, max / ratio]
		if (reverseDomain) domain.reverse()

		const scale = hm.unit == 'log' ? scaleLog() : scaleLinear()
		scale.domain(domain).range(range)
		const tickFormatter = hm.unit == 'log' ? v => formatter(Math.pow(10, v)) : formatter
		if (hm.unit == 'log') {
			const values = [1]
			for (let i = 1; i < Math.log10(max); i++) {
				values.push(Math.pow(10, i))
			}
			return axisGenerator(scale).tickValues(values).tickFormat(formatter)
		} else {
			return axisGenerator(scale).ticks(5).tickFormat(formatter)
		}
	}

	function seriesMouseOver(event) {
		const t = event.target.tagName == 'tspan' ? event.target.parentNode : event.target
		const d = t.__data__

		if (d && (t.tagName == 'rect' || t.nodeName == 'text')) {
			//console.log(_data_)
			//if (!hm.h.isEmptyCell(d)) {
			currCell = d
			//if (!hm.showgrid) currRects.style('stroke', rectStroke)
			//else {
			//const x = d.x
			//const y = getRectY(d.cellmates ? d.cellmates[0] : d)

			currColTexts.attr('font-weight', colTextWeight).attr('font-size', colTextSize).style('fill', colTextColor)

			//resizeCaller.hide()
			//}
		} else {
			currCell = emptyObj
			//resizeCaller.show()
			currRowTexts.attr('font-weight', rowTextWeight).attr('font-size', rowTextSize).style('fill', rowTextColor)
			currColTexts.attr('font-weight', colTextWeight).attr('font-size', colTextSize).style('fill', colTextColor)
		}

		hm.handlers.series.mouseover(event, d)
	}

	function seriesMouseOut(event) {
		event.stopPropagation()
		//currRowTexts.attr('font-weight','').attr('font-size',computed.rowfontsize).style('fill','')
		currColTexts.attr('font-weight', '').attr('font-size', computed.colfontsize).style('fill', '')
		//resizeCaller.show()
		currCell = emptyObj
		if (hm.handlers.series.mouseout) hm.handlers.series.mouseout(event)
	}

	function colLabelMouseover(event) {
		const d = event.target.__data__
		if (!d) return
		const r = hm.col2name['id' in d ? d.id : d]
		const cell = { colId: r.name }
		cell[hm.colkey] = r.name
		cell[hm.colgrpkey] = r.grp
		//seriesMouseOver(cell)

		if (hm.handlers.barLabel.mouseover) hm.handlers.barLabel.mouseover(event)
	}

	function colLabelMouseout(event) {
		currCell = emptyObj
		//resizeCaller.show()
		if (hm.handlers.barLabel.mouseout) hm.handlers.barLabel.mouseout(event)
	}

	function seriesClick(event) {
		const d = event.target.__data__
		barsapp.handlers.series.click(event, d)
	}

	main.hm = hm

	main.styles = () => {
		const styles = {}
		for (const key in defaults) {
			styles[key] = hm[key]
		}
		return styles
	}

	return main
}
