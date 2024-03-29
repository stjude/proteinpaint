export default class DtDiscoSnv {
	constructor(app, alias) {
		this.app = app
		this.processorAlias = alias
		this.samples = []
		this.byGene = {}
		this.byGeneCls = {}
		this.byPos = {}
		this.byPosCls = {}
		this.byPosClsGene = {}
		this.byCls = {}
		this.variants = {}
	}

	main(data) {
		this.hits(data, data.sampleName, data.gene, data.class)
		if (!this.variants[data.sample]) {
			this.variants[data.sample] = []
		}
		this.variants[data.sample].push(data)

		if ('aachange' in data) {
			data.aachange = decodeURIComponent(data.aachange)
		}
		if ('mname' in data) {
			data.mname = decodeURIComponent(data.mname)
		}

		return data.class
	}

	hits(data, sample, gene, cls) {
		//console.log('snv hits')
		if (!this.samples.includes(sample)) {
			this.samples.push(sample)
		}
		this.app.trackInArray(this.byGene, [gene], sample)
		this.app.trackInArray(this.byCls, [cls], sample)
		this.app.trackInArray(this.byGeneCls, [gene, cls], sample)
		const [chr, bin] = this.app.reference.getChrBin(data)
		if (!chr) return
		data.poschr = chr
		data.posbin = bin
		data.poslabel = bin.chr + ':' + bin.start + '-' + bin.stop
		this.app.trackInArray(this.byPos, [data.poslabel], sample)
		this.app.trackInArray(this.byPosCls, [data.poslabel, cls], sample)
		this.app.trackInArray(this.byPosClsGene, [data.poslabel, cls, gene], sample)
	}

	setLayer(plot, sampleName) {
		const s = this.app.settings
		const ss = s[this.processorAlias == 'non-exonic' ? 'non_exonic' : 'snv']
		if (!s.showSNVs) return

		const geneArcs = {}
		const chord = []
		chord.groups = []

		const angle = s.defaultGeneAngle
		const innerRadius = plot.lastRadius + ss.gap * s.layerScaler
		const outerRadius = innerRadius + (ss.byClassWidth ? ss.byClassWidth : ss.width) * s.layerScaler
		plot.lastRadius = outerRadius

		this.maxTotalAcrossPos = 0
		for (const poslabel in this.byPosCls) {
			const p = this.byPosCls[poslabel]
			let total = 0
			Object.keys(p)
				.sort((a, b) => (a < b ? -1 : 1))
				.forEach(cls => {
					p[cls].prevCount = total
					p[cls].count = total + p[cls].length
					total += p[cls].length
					p[cls].byGene = this.byPosClsGene[poslabel][cls]
				})
			p.total = ss.unit == 'log' ? Math.log(total) : total
			if (total > this.maxTotalAcrossPos) {
				this.maxTotalAcrossPos = total
			}
		}
		if (ss.unit == 'log') {
			this.maxTotalAcrossPos = Math.log(this.maxTotalAcrossPos)
		}

		this.variants[sampleName].forEach((data, i) => {
			//if (data.gene!='TP53') return
			//if (s.clickedChromosome && s.clickedChromosome!=arcs[g].chromosome
			//&& !this.fusedToGeneInClickedChr.includes(g)) return;
			if (!data.posbin) {
				console.log('chromosome not found', data)
				return
			}

			const pc = this.byPosCls[data.poslabel][data.class]
			if (pc.hasBeenRendered) return
			pc.hasBeenRendered = true

			const chr = data.poschr
			const start = data.posbin.start
			const stop = data.posbin.stop
			const startAngle = (2 * Math.PI * (chr.start + start * chr.factor)) / this.app.reference.totalSize
			const endAngle = (2 * Math.PI * (chr.start + stop * chr.factor)) / this.app.reference.totalSize //startAngle+angle*chr.factor // Math.min(startAngle+angle,2*Math.PI*(chr.start + gene.end)/this.genomeSize)
			const padAngle = endAngle - startAngle > 2 * s.padAngle ? s.padAngle : 0

			const total = ss.unit == 'pct' ? this.byPosCls[data.poslabel].total : this.maxTotalAcrossPos
			const h = (outerRadius - innerRadius) / (total ? total : 1)
			const signature = !s.signatureKey || !s.signatureKey in data ? null : s.mutationSignature[data[s.signatureKey]]
			let currRadius = outerRadius

			const geneArc = {
				startAngle: startAngle, // + padAngle,
				endAngle: endAngle, // - padAngle,
				data: data,
				outerRadius: innerRadius + (ss.unit == 'log' ? Math.log(pc.count + 1) * h : pc.count * h),
				innerRadius: innerRadius + (ss.unit == 'log' ? Math.log(pc.prevCount + 1) * h : pc.prevCount * h),
				//outerRadius: currRadius,
				//innerRadius: currRadius - pc.length*h,
				value: 1,
				index: i,
				label: data.aachange,
				gene: data.gene,
				layerNum: 0,
				chromosome: data.chr,
				class: data.class,
				aachange: data.aachange,
				mname: data.mname,
				sample: data.sample,
				poscls: pc,
				poslabel: data.poslabel,
				fill: data.class in this.app.mlabel ? this.app.mlabel[data.class].color : '#aaa',
				fillOpacity: ss.byClassWidth ? 0.9 : 0.3,
				signature: signature
			}
			chord.groups.push(geneArc)

			// track calculated gene position and #hits,
			// useful for tracking what and where to label
			if (data.gene && this.processorAlias == 'exonic') {
				if (!(data.gene in geneArcs)) {
					geneArcs[data.gene] = []
				}
				geneArcs[data.gene].push(geneArc)
			}
		})

		const donuts = [
			{
				layerType: 'snv',
				startAngle: 0,
				endAngle: 2 * Math.PI,
				innerRadius: innerRadius,
				outerRadius: outerRadius
			}
		]

		donuts.fill = ss.byClassWidth ? 'rgba(100,100,100,0.1)' : '#fff'
		donuts.stroke = '#efefef'

		const fillFxn =
			this.processorAlias != 'non-exonic'
				? d => d.fill
				: !s.mutationSignature
				? d => d.fill
				: d => (d.signature ? d.signature.color : d.fill)

		plot.layers.push({
			type: 'snv',
			labels: false,
			arcs: true,
			radii: {
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				labelRadius: outerRadius + ss.labelGap * s.layerScaler
			},
			donuts: donuts,
			groupFill: fillFxn,
			fillOpacity: d => d.fillOpacity,
			groupStroke: fillFxn, // this.snvFill,
			fontSize: s.label.fontSize,
			chord: chord
		})

		return geneArcs
	}
}
