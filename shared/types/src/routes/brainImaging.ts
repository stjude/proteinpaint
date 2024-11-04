import { CategoricalTW } from '../terms/categorical.ts'

export type GetBrainImagingRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** a user-defined brain template label in dataset file, such as Ref1, Ref2 */
	refKey: string
	/** the slice index of sagittal, coronal and axial planes*/
	l?: string
	f?: string
	t?: string
	/** the sample names selected by the users to plot on brain template */
	selectedSampleFileNames: string[]
	divideByTW?: CategoricalTW
	overlayTW?: CategoricalTW
}

export type GetBrainImagingSamplesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** a user-defined brain template label in dataset file, such as Ref1, Ref2 */
	refKey: string
	/** when true will only return all the samples that have NIdata */
}

export type GetBrainImagingSamplesResponse = {
	samples: BrainSample[]
}

export type BrainSample = { [key: string]: string }

export type GetBrainImagingResponse = {
	/** the brain imaging plot */
	brainImage: string
}

export type FilesByCategory = { [category: string]: { samples: string[]; color: string } }
