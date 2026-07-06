import type { FileORURL } from '../fileOrUrl.ts'

export type TermdbJunctionOneSampleTkRequest = FileORURL & {
	genome: string
	rglst: any
	indexURL?: string
	isrnapeg?: 1
	bincount?: number
}

export type TermdbJunctionOneSampleTkItem = {
	chr: string
	start: number
	stop: number
	type: string
	rawdata: number[]
}

export type TermdbJunctionOneSampleTkResponse = {
	lst?: TermdbJunctionOneSampleTkItem[]
	error?: string
}
