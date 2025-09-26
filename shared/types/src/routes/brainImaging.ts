import type { QualTW } from '../terms/qualitative.ts'
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
	divideByTW?: QualTW
	/* the term to color the samples based on their category */
	overlayTW?: QualTW
	/* the term categories that were filtered out */
	legendFilter?: string[]
}

export type BrainImagingResponse = {
	/** the brain imaging plot */
	brainImage: string
	plane?: any
	legend?: {
		[key: string]: {
			color: string
			maxLength: number
			crossedOut: boolean
		}
	}
}

export type FilesByCategory = { [category: string]: { samples: string[]; color?: any } }

export const brainImagingPayload: RoutePayload = {
	request: {
		typeId: 'BrainImagingRequest'
	},
	response: {
		typeId: 'BrainImagingResponse'
	}
}
