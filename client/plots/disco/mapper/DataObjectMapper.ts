import Data from "./Data";

export default class DataObjectMapper {
    private sampleName: string;
    private cancerGenes: Array<string>;

    constructor(sampleName: string, cancerGenes: Array<string>) {
        this.sampleName = sampleName
        this.cancerGenes = cancerGenes
    }

    map(dObject: any): Data {
        return new Data(
            dObject.dt,
            dObject.mname,
            dObject.class,
            dObject.gene,
            dObject.chr,
            dObject.pos,
            dObject.ref,
            dObject.alt,
            dObject.position,
            this.sampleName,
            dObject.poschr,
            dObject.posbins,
            dObject.poslabel,
            this.sampleName,
            dObject.ssm_id,
            dObject.start,
            dObject.stop,
            dObject.value,
            dObject.segmean,
            this.cancerGenes.some(cancerGene => cancerGene == dObject.gene),
            dObject.chrA,
            dObject.chrB,
            dObject.geneA,
            dObject.geneB,
            dObject.posA,
            dObject.posB,
            dObject.strandA,
            dObject.strandB)
    }
}
