import { chord as d3chord, ribbon as d3ribbon } from 'd3-chord'
import { select, selectAll, event } from 'd3-selection'
import { line, arc as d3arc, pie, curveLinear } from 'd3-shape'
//import {curveLinear} from 'd3-interpolate'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { rgb } from 'd3-color'

/*

Renders a chord diagram or Circos plot using
the input data to main() and customized by 
control settings.

*/

export default function chord(ch, settings, fxns = {}) {
	const defs = ch.dom.svg.append('defs')
	const mainG = ch.dom.svg.append('g')
	const hole = mainG.append('g')
	const chord = d3chord()
	const arc = d3arc()
	const ribbon = d3ribbon()
	const fill = scaleOrdinal(schemeCategory20)
	const clicked = []

	let currX
	let currY
	let maxSide
	let currData
	let samples

	function main(data) {
		currData = data
		currX = 0
		currY = 0
		maxSide = 0
		let maxX = 0

		const b = ch.dom.svg.selectAll('.mainG').data(data)
		b.exit().remove()
		b.each(renderBySample)
		b.enter()
			.append('g')
			.attr('class', 'mainG')
			.each(renderBySample)

		const mainGs = selectAll('.mainG')
		// make grid cells the same size
		currX = 0
		currY = 0
		maxX = 0
		let numSVGs = 0
		mainGs.each(function(d, i) {
			if (currX + maxSide > settings.svgw) {
				currX = 0
				currY += maxSide
			}
			const w = currX + maxSide / 2
			const h = currY + maxSide / 2

			//select(this).transition().duration(1000)
			//.attr("transform", "translate("+w+','+h+")")
			currX += maxSide
			if (currX > maxX) maxX = currX

			select(this)
				.select('.disco-plot-title')
				.attr('y', currY - h + settings.titleFontSize)

			numSVGs++
		})

		ch.dom.svg //.transition().duration(200)
			.attr('width', maxX) //numSVGs<2 ? maxSide : maxX+maxSide)
			.attr('height', currY + maxSide)
			.style('overflow', 'visible')

		// Evenly space disco plots when comparing
		//if (settings.selectedSamples.length) {
		currX = 0
		currY = 0
		ch.dom.svg.selectAll('.mainG').each(function(d, i) {
			if (currX + maxSide > settings.svgw) {
				currX = 0
				currY += maxSide
			}
			select(this).attr('transform', 'translate(' + (currX + maxSide / 2) + ',' + (currY + maxSide / 2) + ')')
			currX += maxSide
		})
		//}

		return {
			donuts: ch.dom.svg.selectAll('.chord-donut'),
			segments: ch.dom.svg.selectAll('.chord-layer-segment')
		}
	}

	function renderBySample(data, i) {
		const mainG = select(this)
		mainG.selectAll('*').remove()

		if (settings.selectedSamples.length) {
			const text = mainG
				.append('text')
				.attr('class', 'disco-plot-title')
				.attr('text-anchor', 'middle')
				.attr('font-size', settings.titleFontSize)
				.style('cursor', 'default')
				.text(data.title)
		}

		const layers = mainG.selectAll('.chord-layer').data(data.layers, d => d.id)

		layers.exit().remove()
		layers.each(renderLayer)
		layers
			.enter()
			.append('g')
			.each(renderLayer)

		if (ch.isVirtual) return

		const bbox = mainG.node().getBBox()
		const w = bbox.width + settings.padding
		const h = bbox.height + settings.padding + settings.titleFontSize

		if (currX + w > settings.svgw) {
			currX = 0
			currY += h
		}

		if (isNaN(currX)) currX = 0
		if (isNaN(currY)) currY = 0
		mainG.attr('transform', 'translate(' + (currX + w / 2) + ',' + (currY + h / 2) + ')')

		currX += w

		if (w > maxSide) maxSide = w
		if (h > maxSide) maxSide = h
	}

	function renderLayer(layer, i) {
		const g = select(this).attr('class', 'chord-layer')
		const data = this.parentNode.__data__
		const chords = layer.chord ? layer.chord : chord(layer.matrix)

		data.dottexts = []
		renderDonuts(data, g, layer) // the background for the ring
		renderGrids(g, layer) // circular lines, equivalent to y-grid
		//renderLines(g, layer)
		renderSegments(g, layer) // svg.line elems
		renderArcs(g, layer, chords) // svg.path elems
		renderLabels(data, g, layer, chords)
		renderRibbons(data, g, layer, chords)
	}

	function renderDonuts(data, g, layer) {
		if (!layer.donuts) layer.donuts = []

		const gg = g.selectAll('.chord-layer-donuts-g').size()
			? g.selectAll('.chord-layer-donuts-g')
			: g.append('g').attr('class', 'chord-layer-donuts-g')

		const donuts = gg.selectAll('.chord-donut').data(layer.donuts)

		donuts.exit().remove()

		donuts
			.style('fill', layer.donuts.fill ? layer.donuts.fill : '#ececec')
			.style('stroke', layer.donuts.stroke ? layer.donuts.stroke : '#ccc')
			//.style("stroke-width", 1)
			.attr('d', arc)

		donuts
			.enter()
			.append('path')
			.attr('class', 'chord-donut')
			.style('fill', layer.donuts.fill ? layer.donuts.fill : '#ececec')
			.style('stroke', layer.donuts.stroke ? layer.donuts.stroke : '#ccc')
			.style('stroke-width', 1)
			.attr('d', arc)
	}

	function renderGrids(g, layer) {
		if (!layer.grids) layer.grids = []

		const gg = g.selectAll('.chord-layer-grids-g').size()
			? g.selectAll('.chord-layer-grids-g')
			: g.append('g').attr('class', 'chord-layer-grids-g')

		const circles = gg.selectAll('circle').data(layer.grids)

		circles.exit().remove()

		circles
			.attr('r', d => (typeof d == 'object' ? d.radius : d))
			.style('fill', 'none')
			.style('stroke', '#ccc')
			.style('shape-rendering', 'geometricPrecision')

		circles
			.enter()
			.append('circle')
			.attr('r', d => (typeof d == 'object' ? d.radius : d))
			.style('fill', 'none')
			.style('stroke', '#ccc')
			.style('shape-rendering', 'geometricPrecision')

		if (typeof layer.grids[0] == 'object') {
			defs.selectAll('.sja-disco-grid-path').remove()
			defs
				.selectAll('.sja-disco-grid-path')
				.data(layer.grids)
				.enter()
				.append('path')
				.attr('class', 'sja-disco-grid-path')
				.attr('id', (d, i) => 'sja-disco-grid-path-' + i)
				.attr('shape-rendering', 'geometricPrecision')
				.style('fill', d => d.fill)
				.attr('stroke', 'none')
				.attr('d', d => arc(d.chord))

			gg.selectAll('use').remove()
			gg.selectAll('use')
				.data(layer.grids)
				.enter()
				.append('use')
				.attr('xlink:href', (d, i) => '#sja-disco-grid-path-' + i)

			const labels = gg.selectAll('text').data(layer.grids)

			labels.exit().remove()
			labels
				.style('font-size', d => d.fontSize)
				.selectAll('textPath')
				.attr('startOffset', d => d.startOffset + '%')
				.text(d => d.value)

			labels
				.enter()
				.append('text')
				.attr('dy', d => 0.15 * d.fontSize)
				.style('text-anchor', 'middle')
				.attr('dominant-baseline', 'hanging')
				.style('font-size', d => d.fontSize)
				.append('textPath')
				.attr('xlink:href', (d, i) => '#sja-disco-grid-path-' + i)
				.attr('startOffset', d => d.startOffset + '%')
				.text(d => d.value)
		}
	}

	function renderLines(g, layer) {
		const lines = g
			.append('g')
			.selectAll('path')
			.data(layer.line)

		lines.exit().remove()

		lines
			.attr(
				'd',
				line()
					.x(d => d.x)
					.y(d => d.y)(layer.line)
				//.curve(curveLinear(layer.line))
			)
			.style('fill', layer.groupFill ? layer.groupFill : groupFill)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-width', '1px')

		lines
			.enter()
			.append('path')
			.attr(
				'd',
				line()
					.x(d => d.x)
					.y(d => d.y)(layer.line)
				//.curve(curveLinear(layer.line))
			)
			.style('fill', layer.groupFill ? layer.groupFill : groupFill)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-width', '1px')
	}

	function renderSegments(g, layer) {
		if (!layer.segments) layer.segments = []

		const gg = g.selectAll('.chord-layer-segment-g').size()
			? g.selectAll('.chord-layer-segment-g')
			: g.append('g').attr('class', 'chord-layer-segment-g')

		const segments = gg.selectAll('.chord-layer-segment').data(layer.segments)

		segments.exit().remove()

		segments
			.attr('x1', d => d.x1)
			.attr('y1', d => d.y1)
			.attr('x2', d => d.x2)
			.attr('y2', d => d.y2)
			//.style("fill", layer.groupFill ? layer.groupFill : groupFill)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-width', '1px')

		segments
			.enter()
			.append('line')
			.attr('class', 'chord-layer-segment')
			.attr('x1', d => d.x1)
			.attr('y1', d => d.y1)
			.attr('x2', d => d.x2)
			.attr('y2', d => d.y2)
			//.style("fill", layer.groupFill ? layer.groupFill : groupFill)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-width', '1px')
	}

	function renderArcs(g, layer, chords) {
		if (!layer.chords) {
			layer.chords = []
			layer.chords.groups = []
		}

		const gg = g.selectAll('.chord-layer-arcs-g').size()
			? g.selectAll('.chord-layer-arcs-g')
			: g.append('g').attr('class', 'chord-layer-arcs-g')

		const arcs = gg.selectAll('.chord-layer-arc').data(chords.groups)

		arcs.exit().remove()

		arcs
			.style('fill', layer.groupFill ? layer.groupFill : groupFill)
			.style('fill-opacity', layer.fillOpacity ? layer.fillOpacity : null)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-width', 1)
			//.style('shape-rendering', 'geometricPrecision')
			.attr('d', arc)

		arcs
			.enter()
			.append('path')
			.attr('class', 'chord-layer-arc')
			.style('fill', layer.groupFill ? layer.groupFill : groupFill)
			.style('fill-opacity', layer.fillOpacity ? layer.fillOpacity : null)
			.style('stroke', layer.groupStroke ? layer.groupStroke : groupStroke)
			.style('stroke-opacity', layer.strokeOpacity ? layer.strokeOpacity : 1)
			.style('stroke-width', 1)
			.style('shape-rendering', 'geometricPrecision')
			.attr('d', arc)
	}

	function renderLabels(data, g, layer, chords) {
		g.selectAll('.group').remove()

		const labels = []
		const dotgroup = g
			.selectAll('.group')
			.data(chords.groups) //.groups.map(d=>Object.assign(d,layer.radii)))
			.enter()
			.append('g')
			.attr('class', 'group')
			.each(function(d) {
				const g = select(this)

				if (layer.labels) {
					const label = g
						.append('text')
						.attr('class', 'chord-text')
						.each(function(d) {
							d.angle = (d.startAngle + d.endAngle) / 2
							d.ccAngle = d.angle - Math.PI / 2
						})
						.attr('dy', '.35em')
						.attr('transform', function(d) {
							return (
								'rotate(' +
								((d.angle * 180) / Math.PI - 90) +
								')' +
								'translate(' +
								d.labelRadius +
								')' +
								(d.angle > Math.PI ? 'rotate(180)' : '')
							)
						})
						.style('text-anchor', function(d) {
							return layer.labelAnchor ? layer.labelAnchor : d.angle > Math.PI ? 'end' : ''
						})
						.style('font-size', layer.fontSize)
						.style('fill', layer.labelFill ? layer.labelFill : '#000')
						.style('cursor', 'pointer')
						.text(layer.labels ? d => d.label : d => d.index)

					if (data.dottexts) data.dottexts.push(g)
				}

				if ('tickGap' in layer) {
					const tick = g
						.append('path')
						.attr('class', 'chord-tick')
						.each(function(d) {
							const r0 = d.outerRadius
							const r1 = d.labelRadius - layer.tickGap
							const labelFill = !layer.labelFill
								? '#000'
								: typeof layer.labelFill == 'string'
								? layer.labelFill
								: layer.labelFill(d)

							d.lineData = [
								[r0 * Math.cos(d.ccAngle), r0 * Math.sin(d.ccAngle)],
								[r1 * Math.cos(d.ccAngle), r1 * Math.sin(d.ccAngle)]
							]

							select(this)
								.datum(d.lineData)
								.attr(
									'd',
									line()
										.x(d => d[0])
										.y(d => d[1])(d.lineData)
									//.curve(curveLinear)
								)
								.style('stroke', labelFill)
						})
				}
			})

		if (layer.labelsUncollide) moveLabels(dotgroup, layer)
	}

	function renderRibbons(data, g, layer, chords = []) {
		const gg = g.selectAll('.chord-layer-ribbon-g').size()
			? g.selectAll('.chord-layer-ribbon-g')
			: g.append('g').attr('class', 'chord-layer-ribbon-g')

		const ribbons = gg.selectAll('.chord').data(chords)

		ribbons.exit().remove()

		ribbons
			.attr('d', d3ribbon().radius(layer.radii.innerRadius))
			.style('stroke', layer.chordStroke ? layer.chordStroke : chordStroke)
			.style('fill', layer.chordFill ? layer.chordFill : chordFill)
			.style('fill-opacity', layer.fillOpacity ? layer.fillOpacity : '0.67')
			.style('stroke-opacity', layer.strokeOpacity ? layer.strokeOpacity : '0.67')

		ribbons
			.enter()
			.append('path')
			.attr('class', 'chord')
			.attr('d', d3ribbon().radius(layer.radii.innerRadius))
			.style('stroke', layer.chordStroke ? layer.chordStroke : chordStroke)
			.style('fill', layer.chordFill ? layer.chordFill : chordFill)
			.style('shape-rendering', 'geometricPrecision')
			.style('fill-opacity', layer.fillOpacity ? layer.fillOpacity : '0.67')
			.style('stroke-opacity', layer.strokeOpacity ? layer.strokeOpacity : '0.67')

		data.dotchord = gg.selectAll('.chord')
	}

	function init() {
		ch.dom.svg
			.on('mouseover', fxns.mouseOver)
			.on('mouseout', fxns.mouseOut)
			.on('mousemove', fxns.mouseMove)
			.on('click', fxns.mouseClick)
	}

	function groupFill(d) {
		return fill(d.index)
	}

	function groupStroke(d) {
		return rgb(fill(d.index)).darker()
	}

	function chordStroke(d) {
		return rgb(fill(d.source.index)).darker()
	}

	function chordFill(d, i) {
		return fill(d.source.index)
	}

	function matchedChords(d) {
		return !clicked.length || clicked.includes(this)
	}

	function unhighlightNotClicked(d, i) {
		return !clicked.length || !clicked.includes(d.source.index) || !clicked.includes(d.target.index)
	}

	function moveLabels(dotgroup, layer, iter = 0) {
		const collisions = []
		const circumference = 2 * Math.PI * layer.radii.innerRadius
		const h = (3.5 * layer.fontSize) / circumference
		let prev = { endAngle: 0 }

		dotgroup
			.sort((a, b) => {
				return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
			})
			.each(function(t, i) {
				if (!t.label) return

				const g = select(this)
				if (i != 0) {
					const overlap = prev.endAngle - t.startAngle + h
					if (overlap > 0) {
						collisions.push(t)
						t.startAngle += overlap
						t.endAngle += overlap
						t.angle = (t.startAngle + t.endAngle) / 2

						g.select('.chord-text')
							.datum(t)
							.transition()
							.duration(1000)
							.attr('transform', function(d) {
								return (
									'rotate(' +
									((d.angle * 180) / Math.PI - 90) +
									')' +
									'translate(' +
									d.labelRadius +
									')' +
									(d.angle > Math.PI ? 'rotate(180)' : '')
								)
							})
							.style('text-anchor', function(d) {
								return layer.labelAnchor ? layer.labelAnchor : d.angle > Math.PI ? 'end' : ''
							})

						if (layer.tickGap) {
							//const gap=typeof layer.tickGap=='function' ? layer.tickGap(t)
							const r0 = t.outerRadius
							const r1 = t.labelRadius - layer.tickGap
							const dr = (r1 - r0) / 3
							const cos0 = Math.cos(t.ccAngle)
							const sin0 = Math.sin(t.ccAngle)
							const cos1 = Math.cos(t.ccAngle + overlap)
							const sin1 = Math.sin(t.ccAngle + overlap)

							t.lineData = [
								[r0 * cos0, r0 * sin0],
								[(r0 + dr) * cos0, (r0 + dr) * sin0],
								[(r0 + 2 * dr) * cos1, (r0 + 2 * dr) * sin1],
								[(r0 + 3 * dr) * cos1, (r0 + 3 * dr) * sin1]
							]

							g.selectAll('.chord-tick')
								//.datum(d.lineData)
								.transition()
								.duration(1000)
								.attr(
									'd',
									line()
										.x(d => d[0])
										.y(d => d[1])(t.lineData)
									//.curve(curveLinear)
								)
								.style('fill', 'none')
						}
					}
				}

				prev = t
			})

		/*if (collisions.length && iter<50) { console.log(collisions.length)
			iter += 1
			moveLabels(g, labels.filter(t=>collisions.includes(t)), layer, iter)
		}*/
	}

	function addSampleOptions(samples, maxSide) {
		const p = select(ch.dom.svg.node().parentNode)
		p.selectAll('.sjcharts-sample-select-div').remove()

		if (settings.numSamples !== 1) return

		samples.sort((a, b) => (a < b ? -1 : 1))

		const div = p
			.insert('div', 'svg')
			.attr('class', 'sjcharts-sample-select-div')
			.style('margin', '20px 0')
			.style('width', maxSide + 'px')
			.style('text-align', 'center')

		const sel = div.append('select').on('change', () => {
			ch.dispatch({ selectedSamples: [sel.property('value')] }, ch.key)
		})

		sel
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.attr('value', d => d)
			.property('selected', d => settings.selectedSamples[0] === d)
			.html(d => d)
	}

	init()

	return main
}
