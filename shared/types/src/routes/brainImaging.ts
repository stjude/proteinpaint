import { CategoricalTW } from '../terms/categorical.ts'
import type { RoutePayload } from './routeApi.ts'

export type BrainImagingRequest = {
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
	/* the term to divide the samples into groups */
	divideByTW?: CategoricalTW
	/* the term to color the samples based on their category */
	overlayTW?: CategoricalTW
}

export type BrainImagingSamplesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** a user-defined brain template label in dataset file, such as Ref1, Ref2 */
	refKey: string
}

export type BrainImagingSamplesResponse = {
	samples: BrainSample[]
}

export type BrainSample = { [key: string]: string }

export type BrainImagingResponse = {
	/** the brain imaging plot */
	brainImage: string
	plane?: any
}

export type FilesByCategory = { [category: string]: { samples: string[]; color: string } }

export const brainImagingPayload: RoutePayload = {
	request: {
		typeId: 'BrainImagingRequest'
	},
	response: {
		typeId: 'BrainImagingResponse'
	}
}
