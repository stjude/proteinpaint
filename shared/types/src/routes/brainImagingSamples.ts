import type { Filter } from '../filter.ts'

export type BrainImagingSamplesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** a user-defined brain template label in dataset file, such as Ref1, Ref2 */
	refKey: string
	/** optional termdb filter; when provided, only imaging samples passing the filter are returned */
	filter?: Filter
	/** when true, return only sample names, skipping the sampleColumns annotation query */
	samplesOnly?: boolean
	/** injected by server middleware for access control */
	__protected__?: any
}

export type BrainImagingSamplesResponse = {
	samples: BrainSample[]
}

export type BrainSample = { [key: string]: string }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
