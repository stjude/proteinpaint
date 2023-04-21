import Data from "#plots/disco_new/mapper/Data";
import {StateViewModelMapper} from "#plots/disco_new/mapper/StateViewModelMapper";
import LabelProcessor from "#plots/disco_new/mapper/LabelProcessor";
import Reference from "#plots/disco_new/mapper/Reference";

export default class LabelsMapper {

    private processors = {
        labels: new LabelProcessor(),
    }

    private settings: any;
    private sampleName: string;
    private chromosomes: Reference;

    constructor(settings: any, sampleName: string, chromosomes: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.chromosomes = chromosomes
    }

    map(data: Array<Data>) {
        data.forEach(data => {
            if (!StateViewModelMapper.dtNums.includes(data.dt)) return
            const alias = data.dt == 1 && this.settings.snv.byClassWidth ? StateViewModelMapper.snvClassLayer[data.class] : StateViewModelMapper.dtAlias[data.dt]
            if (!this.processors[alias]) {
                this.processors[alias] = new StateViewModelMapper.processorClasses[data.dt == 1 ? 'snv' : alias](this.settings, alias, this.chromosomes)
            }
            const cls = this.processors[alias].main(data)
            // if (!this.hits.classes.includes(cls)) {
            //     this.hits.classes.push(cls)
            // }
        })

        const plot = {
            title: '', //sampleName,
            sample: this.sampleName,
            lastRadius: this.settings.innerRadius,
            layers: []
        }

        StateViewModelMapper.dtNums.forEach(dt => {
            const alias = dt in StateViewModelMapper.dtAlias ? StateViewModelMapper.dtAlias[dt] : dt
            if (!this.processors[alias]) return
            const geneArcs = this.processors[alias].setLayer(plot, plot.sample)

            if(!geneArcs) return // no data

            this.processors.labels.setGeneArcs(geneArcs, alias)
            const s = this.settings
            if (!s.showLabels) return
            const chord = []
            //const minMax = d3extent(Object.values(this.app.hits.byGene))
            chord["groups"] = []
            const innerRadius = plot.lastRadius //+ s.gene.gap
            const outerRadius = innerRadius + s.label.width
            this.processors.labels.getTopGenes().forEach(arc => {
                    const data = arc[0]
                    const g = data.gene

                    //if (s.clickedChromosome && s.clickedChromosome!=arc.chromosome
                    //&& !this.fusedToGeneInClickedChr.includes(g)) return;

                    const label = data.label ? data.label : g
                    if (label) {
                        const d = {
                            startAngle: data.startAngle, // + padAngle,
                            endAngle: data.endAngle, // - padAngle,
                            innerRadius: innerRadius,
                            outerRadius: outerRadius,
                            labelRadius: outerRadius + s.label.labelGap * s.layerScaler,
                            value: 1,
                            // index: i,
                            label: g, //rowsByGene[g].filter(d=>d.class=='Fuser' || (d.classification && d.classification!='NONE')).length ? g : '',
                            gene: g,
                            layerNum: 0,
                            chromosome: data.chromosome,
                            class: data.class,
                            aachange: data.aachange,
                            d: data,
                            sample: data.sample,
                            hits: arc.length,
                            labelFill: '#aaa'
                        }

                        // this.setCountText(d)
                        chord["groups"].push(d)

                        if (s.label.colorBy == 'variant-class' && geneArcs[g] && geneArcs[g].variantTypes) {
                            const types = Object.keys(geneArcs[g].variantTypes).sort((a, b) => {
                                return geneArcs[g].variantTypes[b] - geneArcs[g].variantTypes[a]
                            })
                            const mainType = types[0]
                            // d.labelFill = mainType in this.app.mlabel ? this.app.mlabel[mainType].color : '#aaa'
                            d.labelFill = '#aaa'
                        }
                    }
                }
            )
            return chord["groups"]
        })
    }
}