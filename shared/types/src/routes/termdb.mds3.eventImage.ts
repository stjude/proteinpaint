import type { ErrorResponse } from './errorResponse.ts'

export type TermdbMds3EventImageRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** image file prefix of a svfusion event, see svfusion.eventImages{} of the ds */
	eventImage: string
}

export type EventImage = {
	/** from the file name, after the image file prefix of the event */
	label: string
	/** png data url */
	src: string
}

type ValidResponse = {
	/** all images of the event, each with png data; empty when the event has no image */
	images: EventImage[]
}

export type TermdbMds3EventImageResponse = ErrorResponse | ValidResponse
