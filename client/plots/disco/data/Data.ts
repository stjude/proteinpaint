export default interface Data {
	isPrioritized
	readonly dt: number
	readonly mname: string
	readonly mClass: string
	readonly gene: string
	readonly chr: string
	readonly ref: string
	readonly alt: string
	readonly position: number
	readonly poschr: any
	readonly posbins: any
	readonly poslabel: any
	readonly sampleName: string
	readonly ssm_id: string
	readonly start: number
	readonly stop: number
	readonly value: number
	readonly segmean: number
	readonly chrA: string
	readonly chrB: string
	readonly geneA: string
	readonly geneB: string
	readonly posA: number
	readonly posB: number
	readonly strandA: string
	readonly strandB: string
}
