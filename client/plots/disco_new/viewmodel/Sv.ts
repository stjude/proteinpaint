import Processor from "#plots/disco_new/mapper/Processor";

export default class Sv implements Processor {

    samples = []
    byGene = {}
    bySampleGene = {}
    fusions = {}
    byGeneCls = {}
    byClsSample = {}
    variants = {}

    private app: any;
    private alias: string;

    constructor(app: any, alias: string) {
        this.app = app
        this.alias = alias
    }

    setGeneArcs(geneArcs: any, alias: any): any {
    }

    hits(sample, geneA, geneB, cls): any {
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
    }

    main(data: any): string {
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

    setLayer(plot, sampleName): any {
        // const s = this.app.settings
        // if (!s.showSVs) return
        // //this.processCounts(sampleName);
        //
        // const geneArcs = {}
        // const labelKeys = { geneA: 'source', geneB: 'target' }
        // const chord = []
        // chord["groups"] = []
        // const errors = []
        //
        // const angle = s.defaultGeneAngle
        //
        // this.variants[sampleName].forEach(data => {
        //     const A = data.geneA ? data.geneA : data.chrA + ':' + data.posA + data.strandA
        //     const B = data.geneB ? data.geneB : data.chrB + ':' + data.posB + data.strandB
        //     if (data.samplecount) {
        //         if (data.samplecount < s.sv.minHits) return
        //     } else if (this.byGene[data.geneA].length < s.sv.minHits && this.byGene[data.geneB].length < s.sv.minHits) {
        //         return
        //     }
        //
        //     const chrA = this.app.reference.getChr(data.chrA)
        //     const chrB = this.app.reference.getChr(data.chrB)
        //     if (!chrA || !chrB) {
        //         if (chrA === false || chrB === false) return
        //         //console.log('chromosome not found', data)
        //         return
        //     }
        //
        //     const startAngleA = (2 * Math.PI * (chrA.start + data.posA * chrA.factor)) / this.app.reference.totalSize
        //     const startAngleB = (2 * Math.PI * (chrB.start + data.posB * chrB.factor)) / this.app.reference.totalSize
        //     const chromosomes = [chrA.chr]
        //     if (!chromosomes.includes(chrB.chr)) {
        //         chromosomes.push(chrB.chr)
        //     }
        //
        //     const endpoints = {
        //         source: {
        //             gene: A,
        //             value: 1,
        //             radius: s.innerRadius,
        //             genes: 'test',
        //             chromosomes: chromosomes,
        //             hits: 1, //this.byGene[gs],
        //             startAngle: startAngleA,
        //             endAngle: startAngleA + angle * chrA.factor
        //         },
        //         target: {
        //             gene: B,
        //             value: 1,
        //             radius: s.innerRadius,
        //             genes: 'test',
        //             chromosomes: chromosomes,
        //             hits: 1, //this.byGene[gs],
        //             startAngle: startAngleB,
        //             endAngle: startAngleB + angle * chrB.factor
        //         }
        //     }
        //
        //     chord.push({
        //         genes: 'test',
        //         count: 'test', //this.app.hits.patientsByGene[data.genes.join(',')].length,
        //         endpts: A + '<br/>' + B,
        //         source: endpoints.source,
        //         target: endpoints.target
        //     })
        //
        //     // track calculated gene position and #hits,
        //     // useful for tracking what and where to label
        //     for (const key in labelKeys) {
        //         if (data[key]) {
        //             const gene = data[key]
        //             if (!(gene in geneArcs)) {
        //                 geneArcs[gene] = []
        //             }
        //             geneArcs[gene].push(endpoints[labelKeys[key]])
        //         }
        //     }
        // })
        //
        return null
    }
}