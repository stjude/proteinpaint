import { scaleLinear as d3Linear } from 'd3-scale'
import { extent } from 'd3-array'

export default class DtDiscoCnv {
	CNV_LOSS_CAPPED = -5
	CNV_AMP_CAPPED = 5

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
		data.class = data.value < 0 ? 'CNV_loss' : 'CNV_amp'
		//this.hits(data, data.sample, data.gene, sampleAlias)
		if (!this.variants[data.sample]) {
			this.variants[data.sample] = []
		}
		this.variants[data.sample].push(data)
		this.hits(data.sample, data.gene, data.class)
		this.setGain(data, data.sample, data.class)
		return data.class
	}

	setGain(data, sampleAlias, cls) {
		if (!(sampleAlias in this.minMax)) {
			this.minMax[sampleAlias] = {
				CNV_loss: [0.2],
				CNV_amp: [0.2]
			}
		}

		const minMax = this.minMax[sampleAlias]
		minMax[cls].push(this.capValue(data.value))
	}

	hits(sample, gene, cls) {
		if (!this.byGene[gene]) {
			this.byGene[gene] = []
			this.byGeneCls[gene] = []
		}

		if (!this.byGene[gene].includes(sample)) {
			this.byGene[gene].push(sample)
		}

		if (!this.byGeneCls[gene]) {
			this.byGeneCls[gene] = {}
		}
		if (!this.byGeneCls[gene][cls]) {
			this.byGeneCls[gene][cls] = []
		}
		if (!this.byGeneCls[gene][cls].includes(sample)) {
			this.byGeneCls[gene][cls].push(sample)
		}

		if (!this.byClsSample[cls]) {
			this.byClsSample[cls] = []
		}
		if (!this.byClsSample[cls].includes(sample)) {
			this.byClsSample[cls].push(sample)
		}
	}

	setLayer(plot, sampleName) {
		this.skipLegend = true
		const s = this.app.settings
		if (!s.showCNVs || !this.minMax[sampleName]) return
		if (!(s.cnv.type in this)) {
			console.log("Unrecognized cnv plot type='" + s.cnv.type + "'.")
			return
		}

		const angle = s.defaultAngle
		const innerRadius = plot.lastRadius + s.cnv.gap * s.layerScaler
		const outerRadius = innerRadius + s.cnv.width * s.layerScaler
		plot.lastRadius = outerRadius

		const chord = []
		chord.groups = []

		const plotter = this[s.cnv.type](s, innerRadius, outerRadius, angle)
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
				console.log('Indeterminate cnv position', data)
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
				labelRadius: outerRadius + s.cnv.label
			},
			fillOpacity: d => d.fillOpacity,
			strokeOpacity: d => d.fillOpacity,
			groupFill: this.cnvFill,
			groupStroke: this.cnvFill,
			chord: chord,
			segments: plotter.segments
		})

		if (errors.length) {
			this.app.sayerr(errors)
		}

		this.skipLegend = s.cnv.type != 'chromatic' && s.cnv.type != 'bar'
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
				gain: data.value,
				class: data.class,
				fill: data.class == 'CNV_amp' ? s.cnv.colors[1] : s.cnv.colors[0],
				fillOpacity: opacityScale(Math.abs(data.value))
			}
		}
	}

	scatter(s, innerRadius, outerRadius, angle) {
		const minOffset = Math.max(1, s.cnv.scatterPtHt)
		const baseline = innerRadius
		const minMax = this.getMinMax(s)
		const scatterGain = d3Linear()
			.domain(minMax)
			.range([0 + s.cnv.scatterPtHt, outerRadius - innerRadius])

		return (data, startAngle, endAngle) => {
			const outerR = baseline + scatterGain(data.value)
			const angleDiff = endAngle - startAngle

			return {
				data: data,
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: outerR - minOffset,
				outerRadius: outerR,
				fill: data.class == 'CNV_amp' ? s.cnv.colors[1] : s.cnv.colors[0], //d.fill,
				fillOpacity: 'fillOpacity' in data ? data.fillOpacity : 1,
				stroke: 'stroke' in data ? data.stroke : null,
				gene: '',
				gain: data.value,
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
			const outerR = baseline + gain(data.value)
			const angle = startAngle - halfPI
			const x = Math.cos(angle) * outerR
			const y = Math.sin(angle) * outerR

			if (prevX !== null) {
				//} && (Math.abs(prevX-x)>5 || Math.abs(prevY-y)>5)) {
				segments.push({
					data: data,
					x1: prevX,
					y1: prevY,
					x2: x,
					y2: y,
					fill: data.class == 'CNV_amp' ? s.cnv.colors[1] : s.cnv.colors[0], //data.fill,
					stroke: data.stroke ? data.stroke : '#f00',
					gain: d.value
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
			const outerR = baseline + gain(data.value)
			let angle = startAngle - halfPI
			let x = Math.cos(angle) * outerR
			let y = Math.sin(angle) * outerR

			if (prevX !== null && data.chr == prevData.chr && data.start - prevData.stop < 10) {
				segments.push({
					data: data,
					x1: prevX,
					y1: prevY,
					x2: x,
					y2: y,
					fill: data.class == 'CNV_amp' ? s.cnv.colors[1] : s.cnv.colors[0], //data.fill,
					stroke: data.stroke ? data.stroke : '#f00',
					gain: d.value
				})
			}

			prevX = x
			prevY = y
			angle = endAngle - halfPI
			x = Math.cos(angle) * outerR
			y = Math.sin(angle) * outerR
			segments.push({
				data: data,
				x1: prevX,
				y1: prevY,
				x2: x,
				y2: y,
				fill: data.class == 'CNV_amp' ? s.cnv.colors[1] : s.cnv.colors[0], //data.fill,
				stroke: data.stroke ? data.stroke : '#f00',
				gain: d.value
			})

			prevX = x
			prevY = y
			prevData = data
		}
		main.segments = segments
		return main
	}

	bar(s, innerRadius, outerRadius, angle) {
		const minOffset = Math.max(1, s.cnv.scatterPtHt)
		const dr = (outerRadius - innerRadius) / 2
		const minMax = this.getMinMax(s)
		const baseline = this.mirrorScale ? innerRadius + dr : innerRadius
		const gain = d3Linear()
			.domain(minMax)
			.range(this.mirrorScale ? [-dr, dr] : [0, outerRadius - innerRadius])

		return (data, startAngle, endAngle) => {
			return {
				data: data,
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: baseline,
				outerRadius: baseline + gain(this.capValue(data.value)),
				fill: this.getColor(s, data.value),
				fillOpacity: 'fillOpacity' in data ? data.fillOpacity : 1,
				stroke: 'stroke' in data ? data.stroke : null,
				gene: '',
				gain: data.value,
				class: data.class
			}
		}
	}

	capValue(value) {
		if (value < this.CNV_LOSS_CAPPED) {
			return this.CNV_LOSS_CAPPED
		}
		if (value > this.CNV_AMP_CAPPED) {
			return this.CNV_AMP_CAPPED
		}

		return value
	}

	getColor(s, value) {
		if (value < this.CNV_LOSS_CAPPED) {
			return s.cnv.colors[2]
		} else if (value < 0) {
			return s.cnv.colors[0]
		} else if (value <= this.CNV_AMP_CAPPED) {
			return s.cnv.colors[1]
		} else if (value > this.CNV_AMP_CAPPED) {
			return s.cnv.colors[3]
		}
	}

	cnvFill(d) {
		return d.fill ? d.fill : '#ccc' //d=>d.class=='gain' ? '#f00' : '#00f'
	}

	getGrids(s, innerRadius, outerRadius) {
		if (s.cnv.type == 'chromatic' || !s.cnv.showGrid || !s.cnv.gridNumLevels) return null
		const dr = (outerRadius - innerRadius) / s.cnv.gridNumLevels
		//return [innerRadius+dr,innerRadius+2*dr,innerRadius+3*dr]
		const minMax = this.getMinMax(s)
		const dv = (minMax[1] - minMax[0]) / s.cnv.gridNumLevels
		const grids = []
		const fontSize = s.cnv.gridFontSize ? s.cnv.gridFontSize : 12
		let currRadius = innerRadius
		let currValue = minMax[0]
		while (grids.length < s.cnv.gridNumLevels) {
			grids.push({
				radius: currRadius,
				value: currValue === 0 ? 0 : currValue.toFixed(2),
				fontSize: fontSize,
				orient: s.cnv.gridLabelOrient,
				rotate: s.cnv.gridLabelRotate,
				startOffset: s.cnv.gridLabelStartOffset,
				fill: s.cnv.gridLabelFill,
				chord: {
					startAngle: (2 * Math.PI * (s.cnv.gridLabelRotate - s.cnv.gridLabelSpan / 2)) / 360,
					endAngle: (2 * Math.PI * (s.cnv.gridLabelRotate + s.cnv.gridLabelSpan / 2)) / 360,
					innerRadius: currRadius - 0.5 * s.cnv.gridFontSize,
					outerRadius: currRadius + 0.5 * s.cnv.gridFontSize
				}
			})
			currRadius += dr
			currValue += dv
		}
		return grids
	}

	getLegend(_div) {
		const s = this.app.settings
		const colors = s.cnv.colors
		const barwidth = '100px'
		const [min, max] = this.getMinMax(s)
		const div = _div.append('div').style('padding', '3px')
		if (s.cnv.type == 'chromatic') {
			div
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '3px')
				.style('vertical-align', 'top')
				.style('margin-top', '-3px')
				.html('loss ' + min)

			div
				.append('div')
				.style('display', 'inline-block')
				.style('width', barwidth)
				.style('height', '12px')
				.style('background', 'linear-gradient(to right,' + colors[0] + ',#fff)')

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
				.html(max + ' gain')
		} else if (s.cnv.type == 'bar') {
			const barwidth = '50px'

			const svg = div.append('svg')
			svg
				.attr('width', 2)
				.attr('height', 20)
				.style('overflow', 'visible')
				.style('z-index', 1)
				.style('shape-rendering', 'crispedges')

			svg
				.append('line')
				.attr('x1', 1)
				.attr('x2', 1)
				.attr('y1', 0)
				.attr('y2', 20)
				.style('stroke', '#000')
				.style('stroke-width', '1px')

			svg
				.append('line')
				.attr('x1', 1)
				.attr('x2', -4)
				.attr('y1', 1)
				.attr('y2', 1)
				.style('stroke', '#000')
				.style('stroke-width', '1px')

			svg
				.append('text')
				.attr('x', -5)
				.attr('y', 5)
				.style('font-size', '8px')
				.attr('text-anchor', 'end')
				.text(max)

			svg
				.append('line')
				.attr('x1', 1)
				.attr('x2', -4)
				.attr('y1', 20)
				.attr('y2', 20)
				.style('stroke', '#000')
				.style('stroke-width', '1px')

			svg
				.append('text')
				.attr('x', -5)
				.attr('y', 21)
				.style('font-size', '8px')
				.attr('text-anchor', 'end')
				.text(min)

			svg
				.append('line')
				.attr('x1', 1)
				.attr('x2', -4)
				.attr('y1', 10)
				.attr('y2', 10)
				.style('stroke', '#000')
				.style('stroke-width', '1px')

			svg
				.append('text')
				.attr('x', -5)
				.attr('y', 13)
				.style('font-size', '8px')
				.attr('text-anchor', 'end')
				.text('0')

			const bardiv = div
				.append('div')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')

			bardiv
				.append('div')
				.style('width', barwidth)
				.style('height', '8px')
				.style('vertical-align', 'top')
				.style('background-color', colors[1])
				.style('text-align', 'left')
				.style('font-size', '8px')
				.style('padding', '1px 5px')
				.html('Gain')

			/*
				div.append('div')	
				.style('display','inline-block')
				.style('vertical-align','top')
				.style('height','10px')
				.style('margin-top', '-2px')
				

			div.append('div')	
				.style('display','inline-block')
				.style('vertical-align','bottom')
				.style('height','10px')
				.style('margin-bottom', '0px')
			*/

			bardiv
				.append('div')
				.style('width', barwidth)
				.style('height', '8px')
				.style('vertical-align', 'bottom')
				.style('background-color', colors[0])
				.style('text-align', 'left')
				.style('font-size', '8px')
				.style('padding', '1px 5px')
				.html('Loss')
		}
	}

	getMinMax(s) {
		const values = []
		let hasAmp = 0
		let hasLoss = 0
		// across samples
		for (const sampleName in this.minMax) {
			if (sampleName != 'acrossSamples') {
				values.push(...this.minMax[sampleName].CNV_loss)
				values.push(...this.minMax[sampleName].CNV_amp)
				hasLoss = hasLoss || this.minMax[sampleName].CNV_loss.length
				hasAmp = hasAmp || this.minMax[sampleName].CNV_amp.length
			}
		}
		const minMax = extent(values)
		this.mirrorScale = s.cnv.mirrorScale && hasLoss && hasAmp
		if (this.mirrorScale) {
			const m = Math.max(Math.abs(minMax[0]), minMax[1])
			this.minMax.acrossSamples = [-m, m]
		} else {
			this.minMax.acrossSamples = minMax
		}
		return this.minMax.acrossSamples
	}
}
