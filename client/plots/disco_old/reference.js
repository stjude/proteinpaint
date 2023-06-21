export default class DiscoReference {
	constructor(app, svcoord = {}) {
		this.app = app
		this.getSizes(
			app.opts.genome.majorchr,
			app.settings.chromosomeType,
			app.settings.clickedChromosome,
			app.settings.hiddenChromosomes
		)
		this.genesByChr = {}
		this.geneToChr = {}
		this.coord = {}
		this.svcoord = svcoord
	}

	setCoord(data) {
		const gene = data.gene
		if (typeof data.chromosome == 'string') data.chromosome = data.chromosome.replace('chr', '')
		if (!isNaN(data.chromosome)) data.chromosome = +data.chromosome

		if (!this.genesByChr[data.chromosome]) {
			this.genesByChr[data.chromosome] = []
		}
		if (!this.genesByChr[data.chromosome].includes(gene)) {
			this.genesByChr[data.chromosome].push(gene)
		}
		if (!(gene in this.geneToChr)) {
			this.geneToChr[gene] = data.chromosome
		}

		if (!('chromosome' in data)) {
			if (gene in this.geneToChr) this.geneToChr[gene]
			else this.errors.push("Missing chromosome for gene='" + gene + "'.")
		}
	}

	getArcs(plot, byGene) {
		const s = this.app.settings
		const genes = Object.keys(byGene)
		//const angle = s.defaultGeneAngle //2*Math.PI/genes.length
		const arcs = {}
		const sorter = this.getSorter(byGene)
		plot.lastRadius = s.innerRadius
		genes.sort(sorter)
		genes.forEach(g => {
			byGene[g].forEach((gene, i) => {
				this.setArc(g, s, arcs, gene, i, s.defaultGeneAngle)
			})
		})

		return [genes, arcs]
	}

	getSorter(byGene) {
		return (a, b) => {
			const a0 = byGene[a][0]
			const b0 = byGene[b][0]
			return isNaN(a0.chromosome) && isNaN(a0.chromosome)
				? 0
				: isNaN(a0.chromosome)
				? 1
				: isNaN(b0.chromosome)
				? -1
				: a0.chromosome < b0.chromosome
				? -1
				: a0.chromosome > b0.chromosome
				? 1
				: a0.start < b0.start
				? -1
				: 0
		}
	}

	setArc(g, s, arcs, gene, i, angle) {
		if (!this.chromosomes[gene.chromosome]) return
		if (arcs[g]) return

		if (!('start' in gene)) gene.start = 0
		if (!('end' in gene)) gene.end = 1

		const chr = this.chromosomes[gene.chromosome]
		const startAngle = (2 * Math.PI * (chr.start + gene.start * chr.factor)) / this.totalSize
		const endAngle = startAngle + angle * chr.factor // Math.min(startAngle+angle,2*Math.PI*(chr.start + gene.end)/this.genomeSize)
		const padAngle = endAngle - startAngle > 2 * s.padAngle ? s.padAngle : 0

		arcs[g] = {
			startAngle: startAngle, // + padAngle,
			endAngle: endAngle, // - padAngle,
			innerRadius: s.innerRadius,
			outerRadius: s.innerRadius,
			value: 1,
			index: i,
			label: g, //rowsByGene[g].filter(d=>d.class=='Fuser' || (d.classification && d.classification!='NONE')).length ? g : '',
			gene: g,
			layerNum: 0,
			chromosome: gene.chromosome,
			class: gene.class,
			aachange: gene.aachange,
			d: gene.d,
			sample: gene.sample
		}
	}

	getSizes(chrSizes, genomeType = 'human', clickedChromosome = 0, hiddenChromosomes = []) {
		const chromosomes = {}
		let totalSize = 0

		if (clickedChromosome) {
			for (const chr in chrSizes) {
				if (hiddenChromosomes.includes(chr)) continue
				const size = chr == clickedChromosome ? 5000 : 100
				const factor = chr == clickedChromosome ? 5000 / chrSizes[chr] : 0
				chromosomes[chr] = { start: totalSize, size: size, factor: factor }
				totalSize += size
			}
		} else {
			for (const chr in chrSizes) {
				const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
				if (hiddenChromosomes.includes(key)) continue
				chromosomes[key] = { chr: key, start: totalSize, size: chrSizes[chr], factor: 1 }
				totalSize += chrSizes[chr]
			}
		}

		this.totalSize = totalSize
		this.chromosomes = chromosomes

		// number of base pairs per pixel
		const bpx = Math.floor(this.totalSize / (2 * Math.PI * this.app.settings.innerRadius))
		for (const chr in chromosomes) {
			const length = chromosomes[chr].size
			const posbins = [] // positional bins
			let bptotal = 0
			while (bptotal < length) {
				posbins.push({
					chr: chr,
					start: bptotal,
					stop: bptotal + bpx - 1
				})
				bptotal += bpx
			}
			chromosomes[chr].posbins = posbins
		}
	}

	getChr(_chr) {
		const chr = typeof _chr == 'string' ? _chr.replace('chr', '') : _chr
		return chr in this.chromosomes
			? this.chromosomes[chr]
			: this.app.settings.hiddenChromosomes.includes(chr)
			? false
			: null
	}

	getChrBin(data) {
		const _chr = typeof data.chr == 'string' ? data.chr.replace('chr', '') : data.chr
		const chr =
			_chr in this.chromosomes
				? this.chromosomes[_chr]
				: this.app.settings.hiddenChromosomes.includes(_chr)
				? false
				: null
		const start = data.position ? data.position : data.start ? data.start : 0
		const stop = data.stop ? data.stop : data.position + 1
		return [chr, chr.posbins.find(p => p.stop > start)]
	}

	setLayer(plot) {
		const s = this.app.settings
		if (!s.showChr) return

		const angle = s.defaultGeneAngle //2*Math.PI/genes.length
		const chord = []
		chord.groups = []
		const self = this

		const innerRadius = plot.lastRadius + s.chr.gap * s.layerScaler
		const outerRadius = innerRadius + s.chr.width * s.layerScaler
		plot.lastRadius = outerRadius

		//let startAngle=0
		Object.keys(self.chromosomes).forEach((c, i) => {
			const chr = self.chromosomes[c]
			const startAngle = (2 * Math.PI * chr.start) / self.totalSize
			const endAngle = (2 * Math.PI * (chr.start + chr.size)) / self.totalSize //startAngle+genesByChr[c].length*angle
			const padAngle = 0 //endAngle - startAngle > 2*s.padAngle ? s.padAngle : 0
			chord.groups.push({
				layerType: 'chromosome',
				startAngle: startAngle + padAngle,
				endAngle: endAngle - padAngle,
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				labelRadius: innerRadius + s.chr.labelGap,
				value: 1,
				index: i,
				layerNum: 1,
				label: c == 'MT' ? '' : c,
				chromosome: isNaN(c) ? c : +c
			})
			//startAngle = endAngle
		})

		plot.layers.push({
			labels: true,
			arcs: true,
			labelAnchor: 'middle',
			labelFill: '#fff',
			radii: {
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				labelRadius: outerRadius + s.chr.labelGap * s.layerScaler
			},
			groupFill: '#444',
			groupStroke: '#fff',
			fontSize: s.chr.fontSize,
			chord: chord
		})
	}
}
