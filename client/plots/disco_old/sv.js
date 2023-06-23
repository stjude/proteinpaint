const fusionColocationColors = {
	intra: 'rgb(27, 158, 119)',
	inter: 'rgb(106, 61, 154)'
}

export default class DtDiscoSv {
	constructor(app) {
		this.app = app
		this.samples = []
		this.byGene = {}
		this.bySampleGene = {}
		this.fusions = {}
		this.byGeneCls = {}
		this.byClsSample = {}
		this.variants = {}
	}

	main(data) {
		if (data.dt == 2) {
			if (!data.geneA) {
				data.geneA = data.chrA + ':' + data.posA
			}
			if (!data.geneB) {
				data.geneB = data.chrB + ':' + data.posB
			}
		}

		this.hits(data.sample, data.geneA, data.geneB, data.class)
		if (!this.variants[data.sample]) {
			this.variants[data.sample] = []
		}
		this.variants[data.sample].push(data)
		return 'SV'
	}

	hits(sample, geneA, geneB, cls) {
		if (!this.samples.includes(sample)) {
			this.samples.push(sample)
		}

		if (!this.byGene[geneA]) {
			this.byGene[geneA] = []
			this.byGeneCls[geneA] = []
		}
		if (!this.byGene[geneA].includes(sample)) {
			this.byGene[geneA].push(sample)
		}

		if (!this.byGene[geneB]) {
			this.byGene[geneB] = []
			this.byGeneCls[geneB] = []
		}
		if (!this.byGene[geneB].includes(sample)) {
			this.byGene[geneB].push(sample)
		}

		/*
		if (!this.bySampleGene[sampleAlias]) {
			this.bySampleGene[sampleAlias]={}
		}
		if (!this.bySampleGene[sampleAlias][gene]) {
			this.bySampleGene[sampleAlias][gene]=[];
		}
		this.bySampleGene[sampleAlias][gene].push(sample)

		if (!this.byGeneCls[gene][cls]) {
			this.byGeneCls[gene][cls]=[]
		}
		if (!this.byGeneCls[gene][cls].includes(sample)) {
			this.byGeneCls[gene][cls].push(sample)
		}

		if (!this.byClsSample[cls]) {
			this.byClsSample[cls]=[]
		}
		if (!this.byClsSample[cls].includes(sample)) {
			this.byClsSample[cls].push(sample)
		}
		*/
	}

	setLayer(plot, sampleName) {
		const s = this.app.settings
		if (!s.showSVs) return
		//this.processCounts(sampleName);

		const geneArcs = {}
		const labelKeys = { geneA: 'source', geneB: 'target' }
		const chord = []
		chord.groups = []
		const errors = []

		const angle = s.defaultGeneAngle

		this.variants[sampleName].forEach(data => {
			const A = data.geneA ? data.geneA : data.chrA + ':' + data.posA + data.strandA
			const B = data.geneB ? data.geneB : data.chrB + ':' + data.posB + data.strandB
			if (data.samplecount) {
				if (data.samplecount < s.sv.minHits) return
			} else if (this.byGene[data.geneA].length < s.sv.minHits && this.byGene[data.geneB].length < s.sv.minHits) {
				return
			}

			const chrA = this.app.reference.getChr(data.chrA)
			const chrB = this.app.reference.getChr(data.chrB)
			if (!chrA || !chrB) {
				if (chrA === false || chrB === false) return
				//console.log('chromosome not found', data)
				return
			}

			const startAngleA = (2 * Math.PI * (chrA.start + data.posA * chrA.factor)) / this.app.reference.totalSize
			const startAngleB = (2 * Math.PI * (chrB.start + data.posB * chrB.factor)) / this.app.reference.totalSize
			const chromosomes = [chrA.chr]
			if (!chromosomes.includes(chrB.chr)) {
				chromosomes.push(chrB.chr)
			}

			const endpoints = {
				source: {
					gene: A,
					value: 1,
					radius: s.innerRadius,
					genes: 'test',
					chromosomes: chromosomes,
					hits: 1, //this.byGene[gs],
					startAngle: startAngleA,
					endAngle: startAngleA + angle * chrA.factor
				},
				target: {
					gene: B,
					value: 1,
					radius: s.innerRadius,
					genes: 'test',
					chromosomes: chromosomes,
					hits: 1, //this.byGene[gs],
					startAngle: startAngleB,
					endAngle: startAngleB + angle * chrB.factor
				}
			}

			chord.push({
				genes: 'test',
				count: 'test', //this.app.hits.patientsByGene[data.genes.join(',')].length,
				endpts: A + '<br/>' + B,
				source: endpoints.source,
				target: endpoints.target
			})

			// track calculated gene position and #hits,
			// useful for tracking what and where to label
			for (const key in labelKeys) {
				if (data[key]) {
					const gene = data[key]
					if (!(gene in geneArcs)) {
						geneArcs[gene] = []
					}
					geneArcs[gene].push(endpoints[labelKeys[key]])
				}
			}
		})

		const fillFxn = d => {
			const c = d.source.chromosomes
			return c.length < 2 || c[0] == c[1] ? fusionColocationColors.intra : fusionColocationColors.inter
		}

		plot.layers.push({
			labels: false,
			arcs: false,
			radii: {
				innerRadius: s.innerRadius
			},
			chord: chord,
			tipHtml: d => {
				return '<span>' + (d.endpts ? d.endpts : d.source.gene + ' ' + d.target.gene) + '</span>'
			},
			chordFill: fillFxn,
			chordStroke: fillFxn,
			fillOpacity: s.sv.fillOpacity,
			strokeOpacity: s.sv.strokeOpacity
		})

		if (errors.length) {
			this.app.sayerr(errors)
		}

		return geneArcs
	}

	/*
	processCounts(sampleName) {
		const s = this.app.settings
		const counts = []
		//for(const gene in this.patientsByGene) {
			//counts.push(this.patientsByGene[gene].length)
		//}
		
		this.patientsByGene = this.app.hits.patientsByGene; //console.log(this.patientsByGene)
		for(const gene in this.patientsByGene) {
			counts.push(this.patientsByGene[gene].length)
		}

		const minMax=d3extent(Object.values(counts)); //console.log(minMax)
		let colors
		if (s.sv.colors.includes('.')) {
			const c=s.sv.colors.split('.')
			colors=colorbrewer[c[0]][c[1]]
		}
		else {
			const c=s.sv.colors.split(',')
			colors=[rgb(c[0]), rgb(c[1])]
		}

		const uniqueCounts=[]

		this.numPatientCounts=counts.filter(d=>{
			if (uniqueCounts.includes(d)) return false
			uniqueCounts.push(d)
			return true
		}).sort((a,b)=>a<b?-1:1);

		this.numPatientColorScale=d3Quantile()
			.domain(minMax)
			.range(["#e66101", "#fdb863", "#999", "#b2abd2", "#5e3c99"])
			//.range(colors)
			//.range(colorbrewer.RdYlBu[5])
			//.range(colorbrewer.PuOr[5])
			//.range(colorbrewer.YlOrBr[11])
		this.numPatientColors=colors
		this.numPatientMinMax=minMax;
	}
	*/
}
