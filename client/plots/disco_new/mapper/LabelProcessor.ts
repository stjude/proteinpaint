import Processor from "#plots/disco_new/mapper/Processor";

export default class LabelProcessor implements Processor {

    geneArcs = {}

    main(data: any): string {
        return "";
    }

    setGeneArcs(geneArcs: any, alias: any): any {
        this.geneArcs = geneArcs
    }

    hits(data: any, sample: any, gene: any, cls: any): any {
    }

    setLayer(plot, sampleName): any {
    }

}