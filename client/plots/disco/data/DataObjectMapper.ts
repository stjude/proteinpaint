import Data from './Data.ts'

export default class DataObjectMapper {
	private sampleName: string
	private cancerGenes: Array<string>

	constructor(sampleName: string, cancerGenes: Array<string>) {
		this.sampleName = sampleName
		this.cancerGenes = cancerGenes
	}

	map(dObject: any): Data {
		return {
			dt: dObject.dt,
			mname: dObject.mname,
			mClass: dObject.class,
			gene: dObject.gene,
			chr: dObject.chr,
			pos: dObject.pos,
			ref: dObject.ref,
			alt: dObject.alt,
			position: dObject.position,
			sample: this.sampleName,
			poschr: dObject.poschr,
			posbins: dObject.posbins,
			poslabel: dObject.poslabel,
			sampleName: this.sampleName,
			ssm_id: dObject.ssm_id,
			start: dObject.start,
			stop: dObject.stop,
			value: dObject.value,
			segmean: dObject.segmean,
			isPrioritized: this.cancerGenes.some(cancerGene => cancerGene == dObject.gene),
			chrA: dObject.chrA,
			chrB: dObject.chrB,
			geneA: dObject.geneA,
			geneB: dObject.geneB,
			posA: dObject.posA,
			posB: dObject.posB,
			strandA: dObject.strandA,
			strandB: dObject.strandB
		}
	}
}
