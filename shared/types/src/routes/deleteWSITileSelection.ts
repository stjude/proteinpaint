import type { TileSelection } from './aiProjectSelectedWSImages.ts'

export type DeleteWSITileSelectionRequest = {
	genome: string
	dslabel: string
	projectId: number
	tileSelection: TileSelection
	classID: number
	wsimage: string
}

export type DeleteWSITileSelectionResponse = {
	status: string
	error?: string
}
