import { select } from 'd3-selection'

const fusionColocationColors = {
	intra: 'rgb(27, 158, 119)',
	inter: 'rgb(106, 61, 154)'
}

export default class PgDiscoLegend {
	constructor(app) {
		this.app = app
		this.holder = typeof app.legendSelector == 'string' ? select(app.legendSelector) : app.legendSelector
	}

	render() {
		if (!this.app.legendSelector) return

		const s = this.app.settings
		const groups = {
			'Gene Labels': {
				items: [
					{
						text: 'Mostly SNV-Indel Variants',
						fill: s.snv.labelFill
					},
					{
						text: 'Mostly Copy Number Variants',
						fill: s.cnv.labelFill
					},
					{
						text: 'Mostly Structural Variants',
						fill: s.sv.labelFill
					}
				]
			} /*,
  			'Chromosome Layer': {
  				items: [{
  					text: 'Chromosome Number',
  					fill: '#444'
  				}]
  			}*/,
			'SNV-Indels': {
				label: 'SNV-Indel',
				items: []
			},
			'Copy Number': {
				dtname: 'cnv',
				label: 'Copy Number (log2 ratio)',
				legendFxn: div => this.app.processors.cnv.getLegend(div)
			},
			LOH: {
				dtname: 'loh',
				label: 'LOH seg. mean',
				legendFxn: div => {
					if (this.app.processors.loh) this.app.processors.loh.getLegend(div)
				}
			},
			Fusions: this.setFusionLegendByColocation(),
			SV: this.setSvLegendByColocation()
		}

		this.app.hits.classes.forEach(cls => {
			if (!cls) return
			else if (cls == 'Fuserna') {
				// skip
			} else if (cls.startsWith('CNV_')) {
				// skip
			} else if (cls == 'LOH') {
				// skip
			} else if (cls == 'SV') {
				// skip, will instead use setFusionLegendBy* functions below
			} else {
				groups['SNV-Indels'].items.push({
					text: this.app.mlabel[cls] ? this.app.mlabel[cls].label : cls,
					fill: this.app.mlabel[cls] ? this.app.mlabel[cls].color : '#ccc',
					desc: this.app.mlabel[cls] ? this.app.mlabel[cls].desc : ''
				})
			}
		})

		const legend = []
		;['SNV-Indels', 'Copy Number', 'LOH', 'SV'].forEach(t => {
			const g = groups[t]
			if (!g) return
			if (g.dtname) {
				if (!this.app.processors[g.dtname]) return
				if (this.app.processors[g.dtname].skipLegend) return
			}

			if (g.legendFxn) {
				legend.push({
					text: g.label ? g.label : t,
					legendFxn: g.legendFxn
				})
			} else if (g.items.length) {
				legend.push({
					text: g.label ? g.label : t,
					items: g.items
				})
			}
		})

		this.holder.selectAll('div').remove()

		this.holder
			.selectAll('div')
			.data(legend)
			.enter()
			.append('div')
			.style('font-size', '10px')
			.each(function(d) {
				const div = select(this)
				div
					.append('div')
					//.style('display','inline-block')
					.style('font-weight', 700)
					.html(d.text)

				if (d.legendFxn) {
					d.legendFxn(div)
				} else {
					div
						.append('div')
						//.style('display','inline-block')
						.selectAll('div')
						.data(d.items)
						.enter()
						.append('div')
						.style('display', 'inline-block')
						.attr('title', c => c.desc)
						.each(function(c) {
							const div = select(this)
							div
								.append('div')
								.style('background-color', c.fill)
								.style('display', 'inline-block')
								.style('width', '8px')
								.style('height', '8px')
								.style('margin-right', '2px')

							div
								.append('span')
								.style('margin-right', '10px')
								.html(c.text)
						})
				}
			})
	}

	setColorBar(label, minmax) {
		const fusionFills = {}
		this.app.processors.sv.numPatientCounts.forEach(d => {
			const fill = this.app.processors.sv.numPatientColorScale(d)
			if (fusionFills[fill]) fusionFills[fill].push(d)
			else fusionFills[fill] = [d]
		})

		return {
			//colors: this.numPatientColors,
			label: label,
			items: Object.keys(fusionFills).map(fill => {
				return {
					text:
						fusionFills[fill].length == 1 ? fusionFills[fill][0] : fusionFills[fill][0] + '-' + fusionFills[fill].pop(),
					fill: fill,
					desc: 'Color by patient count'
				}
			})
		}
	}

	setFusionLegendByColocation() {
		return {
			//colors: this.numPatientColors,
			label: 'Fusions (color by co-location)',
			items: [
				{
					text: 'Intrachromosomal',
					fill: fusionColocationColors.intra,
					desc: 'Fused genes are from the same chromosome'
				},
				{
					text: 'Interchromosomal',
					fill: fusionColocationColors.inter,
					desc: 'Fused genes are from the same chromosome'
				}
			]
		}
	}

	setSvLegendByColocation() {
		return {
			//colors: this.numPatientColors,
			label: 'Structural Variants (color by co-location)',
			items: [
				{
					text: 'Intrachromosomal',
					fill: fusionColocationColors.intra,
					desc: 'Fused genes are from the same chromosome'
				},
				{
					text: 'Interchromosomal',
					fill: fusionColocationColors.inter,
					desc: 'Fused genes are from the same chromosome'
				}
			]
		}
	}
}
