import type { TileSelection } from '../index.ts'

export type SaveWSIAnnotationRequest = {
	genome: string
	dslabel: string
	tileSelection: TileSelection
	classId: number
	projectId: number
	wsimage: string
}

export type SaveWSIAnnotationResponse = {
	status: 'ok' | 'error'
	error?: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
