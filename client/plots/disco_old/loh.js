import { scaleLinear as d3Linear } from 'd3-scale'
import { extent } from 'd3-array'

export default class DtDiscoLoh {
	constructor(app) {
		this.app = app
		this.bySampleGene = {}
		this.byGene = {}
		this.byGeneCls = {}
		this.byClsSample = {}
		this.minMax = {}
		this.variants = {}
		this.scale = {}
	}

	main(data) {
		//this.hits(data, data.sample, data.gene, sampleAlias)
		if (!this.variants[data.sample]) {
			this.variants[data.sample] = []
		}
		this.variants[data.sample].push(data)
		this.setGain(data, data.sample)
		return 'LOH'
	}

	setGain(data, sampleAlias) {
		if (!(sampleAlias in this.minMax)) {
			this.minMax[sampleAlias] = []
		}
		this.minMax[sampleAlias].push(data.segmean)
	}

	setLayer(plot, sampleName) {
		this.skipLegend = true
		const s = this.app.settings
		if (!s.showLOH || !this.minMax[sampleName]) return
		if (!(s.loh.type in this)) {
			console.log("Unrecognized LOH plot type='" + s.loh.type + "'.")
			return
		}

		const angle = s.defaultAngle
		const innerRadius = plot.lastRadius + s.loh.gap * s.layerScaler
		const outerRadius = innerRadius + s.loh.width * s.layerScaler
		plot.lastRadius = outerRadius

		const chord = []
		chord.groups = []

		const plotter = this[s.loh.type](s, innerRadius, outerRadius, angle)
		const chromosomes = this.app.reference.chromosomes
		const totalSize = this.app.reference.totalSize
		const bySampleGene = this.bySampleGene[sampleName]
		const svcoord = this.app.reference.svcoord
		let errors = []

		this.variants[sampleName].forEach(data => {
			const chr = this.app.reference.getChr(data.chr)
			if (!chr) {
				console.log('chromosome not found', data)
				return
			}

			if (isNaN(data.start) || isNaN(data.stop) || data.start === null || data.stop === null) {
				//console.log(g0, chr, svcoord[g0.gene], svcoord[g])
				console.log('Indeterminate loh position', data)
			} else {
				const startAngle = (2 * Math.PI * (chr.start + data.start * chr.factor)) / totalSize
				const endAngle = data.stop
					? (2 * Math.PI * (chr.start + data.stop * chr.factor)) / totalSize
					: startAngle + angle * chr.factor
				const elem = plotter(data, startAngle, endAngle)
				if (elem) chord.groups.push(elem)
			}
		})

		const donuts = [
			{
				startAngle: 0,
				endAngle: 2 * Math.PI,
				innerRadius: innerRadius,
				outerRadius: outerRadius
			}
		]

		donuts.fill = '#fff'
		donuts.stroke = '#ccc'

		plot.layers.push({
			labels: false,
			arcs: true,
			grids: this.getGrids(s, innerRadius, outerRadius),
			donuts: donuts,
			radii: {
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				labelRadius: outerRadius + s.loh.label
			},
			fillOpacity: d => d.fillOpacity,
			strokeOpacity: d => d.fillOpacity,
			groupFill: this.lohFill,
			groupStroke: this.lohFill,
			chord: chord,
			segments: plotter.segments
		})

		if (errors.length) {
			this.app.sayerr(errors)
		}

		this.skipLegend = s.loh.type != 'chromatic'
	}

	chromatic(s, innerRadius, outerRadius) {
		const minMax = this.getMinMax(s)
		const opacityScale = d3Linear()
			.domain(minMax)
			.range([0.2, 1])

		return (data, startAngle, endAngle) => {
			return {
				data: data,
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				gene: '',
				gain: data.segmean,
				class: data.class,
				fill: s.loh.fill,
				fillOpacity: opacityScale(Math.abs(data.segmean))
			}
		}
	}

	scatter(s, innerRadius, outerRadius, angle) {
		const minOffset = Math.max(1, s.loh.scatterPtHt)
		const baseline = innerRadius
		const minMax = this.getMinMax(s)
		const scatterGain = d3Linear()
			.domain(minMax)
			.range([0 + s.loh.scatterPtHt, outerRadius - innerRadius])

		return (data, startAngle, endAngle) => {
			const outerR = baseline + scatterGain(data.segmean)
			const angleDiff = endAngle - startAngle

			return {
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: outerR - minOffset,
				outerRadius: outerR,
				fill: s.loh.fill,
				fillOpacity: 'fillOpacity' in data ? data.fillOpacity : 1,
				stroke: 'stroke' in data ? data.stroke : null,
				gene: '',
				//gain: data.segmean,
				class: data.class
			}
		}
	}

	segment(s, innerRadius, outerRadius, angle) {
		// const twoPI=2*Math.PI
		const halfPI = Math.PI / 2
		const baseline = innerRadius
		const minMax = this.getMinMax(s)
		const gain = d3Linear()
			.domain(minMax)
			.range([0, outerRadius - innerRadius])
		const segments = []
		let prevX = null,
			prevY = null

		function main(data, startAngle, endAngle) {
			const outerR = baseline + gain(data.segmean)
			const angle = startAngle - halfPI
			const x = Math.cos(angle) * outerR
			const y = Math.sin(angle) * outerR

			if (prevX !== null) {
				//} && (Math.abs(prevX-x)>5 || Math.abs(prevY-y)>5)) {
				segments.push({
					x1: prevX,
					y1: prevY,
					x2: x,
					y2: y,
					fill: s.loh.fill,
					stroke: data.stroke ? data.stroke : '#f00'
				})
			}
			prevX = x
			prevY = y
		}

		main.segments = segments
		return main
	}

	step(s, innerRadius, outerRadius, angle) {
		const twoPI = 2 * Math.PI
		const halfPI = Math.PI / 2
		const baseline = innerRadius
		const minMax = this.getMinMax(s)
		const gain = d3Linear()
			.domain(minMax)
			.range([0, outerRadius - innerRadius])
		const segments = []
		let prevData = null,
			prevX = null,
			prevY = null

		function main(data, startAngle, endAngle) {
			const outerR = baseline + gain(data.segmean)
			let angle = startAngle - halfPI
			let x = Math.cos(angle) * outerR
			let y = Math.sin(angle) * outerR

			if (prevX !== null && data.chr == prevData.chr && data.start - prevData.stop < 10) {
				segments.push({
					x1: prevX,
					y1: prevY,
					x2: x,
					y2: y,
					fill: s.loh.fill,
					stroke: data.stroke ? data.stroke : '#f00'
				})
			}

			prevX = x
			prevY = y
			angle = endAngle - halfPI
			x = Math.cos(angle) * outerR
			y = Math.sin(angle) * outerR
			segments.push({
				x1: prevX,
				y1: prevY,
				x2: x,
				y2: y,
				fill: s.loh.fill,
				stroke: data.stroke ? data.stroke : '#f00'
			})

			prevX = x
			prevY = y
			prevData = data
		}
		main.segments = segments
		return main
	}

	bar(s, innerRadius, outerRadius, angle) {
		const minOffset = Math.max(1, s.loh.scatterPtHt)
		const dr = (outerRadius - innerRadius) / 2
		const baseline = innerRadius
		const minMax = this.getMinMax(s)
		const gain = d3Linear()
			.domain(minMax)
			.range([0, outerRadius - innerRadius])

		return (data, startAngle, endAngle) => {
			return {
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: baseline,
				outerRadius: baseline + gain(data.segmean),
				fill: s.loh.fill,
				fillOpacity: 'fillOpacity' in data ? data.fillOpacity : 1,
				stroke: 'stroke' in data ? data.stroke : null,
				gene: '',
				//gain: data.segmean,
				class: data.class
			}
		}
	}

	lohFill(d) {
		return d.fill ? d.fill : '#ccc' //d=>d.class=='gain' ? '#f00' : '#00f'
	}

	getGrids(s, innerRadius, outerRadius) {
		if (s.loh.type == 'chromatic' || !s.loh.showGrid || !s.loh.gridNumLevels) return null
		const dr = (outerRadius - innerRadius) / s.loh.gridNumLevels
		//return [innerRadius+dr,innerRadius+2*dr,innerRadius+3*dr]
		const minMax = this.getMinMax(s)
		const dv = (minMax[1] - minMax[0]) / s.loh.gridNumLevels
		const grids = []
		const fontSize = s.loh.gridFontSize ? s.loh.gridFontSize : 12
		let currRadius = innerRadius
		let currValue = minMax[0]
		while (grids.length < s.loh.gridNumLevels) {
			grids.push({
				radius: currRadius,
				value: currValue === 0 ? 0 : currValue.toFixed(2),
				fontSize: fontSize,
				orient: s.loh.gridLabelOrient,
				rotate: s.loh.gridLabelRotate,
				startOffset: s.loh.gridLabelStartOffset,
				fill: s.loh.gridLabelFill,
				chord: {
					startAngle: (2 * Math.PI * (s.loh.gridLabelRotate - s.loh.gridLabelSpan / 2)) / 360,
					endAngle: (2 * Math.PI * (s.loh.gridLabelRotate + s.loh.gridLabelSpan / 2)) / 360,
					innerRadius: currRadius - 0.5 * s.loh.gridFontSize,
					outerRadius: currRadius + 0.5 * s.loh.gridFontSize
				}
			})
			currRadius += dr
			currValue += dv
		}
		return grids
	}

	getLegend(div) {
		const colors = ['#000', '#000']
		const barwidth = '100px'
		const [min, max] = this.getMinMax()
		div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '3px')
			.style('vertical-align', 'top')
			.style('margin-top', '-3px')
			.html(min.toFixed(2))

		div
			.append('div')
			.style('display', 'inline-block')
			.style('width', barwidth)
			.style('height', '12px')
			.style('background', 'linear-gradient(to right,' + '#fff,' + colors[1] + ')')

		div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '3px')
			.style('vertical-align', 'top')
			.style('margin-top', '-3px')
			.html(max.toFixed(2))
	}

	getMinMax() {
		const values = []
		// across samples
		for (const sampleName in this.minMax) {
			values.push(...this.minMax[sampleName])
		}
		this.minMax.acrossSamples = extent(values)
		return this.minMax.acrossSamples
	}

	setOpacityScale() {
		if (this.opacityScale) return
		const minMax = this.getMinMax()
		this.opacityScale = d3Linear()
			.domain(minMax)
			.range([0.2, 1])
	}
}
