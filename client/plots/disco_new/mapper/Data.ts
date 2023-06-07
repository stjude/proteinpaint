// TODO fix data class

export default class Data {
    constructor(readonly dt: number,
                readonly mname: string,
                readonly mClass: string,
                readonly gene: string,
                readonly chr: string,
                readonly pos: number,
                readonly ref: string,
                readonly alt: string,
                // TODO do we need position and pos?
                readonly position: number,
                readonly sample: string,
                readonly poschr: any,
                readonly posbins: any,
                readonly poslabel: any,
                // TODO do we need sampleName and sample?
                readonly sampleName: string,
                readonly ssm_id: string,
                readonly start: number,
                readonly stop: number,
                readonly value: number,
                readonly segmean: number,
                readonly isCancerGene = false,
                readonly chrA: string,
                readonly chrB: string,
                readonly geneA: string,
                readonly geneB: string,
                readonly posA: number,
                readonly posB: number,
                readonly strandA: string,
                readonly strandB: string,
    ) {
    }
}