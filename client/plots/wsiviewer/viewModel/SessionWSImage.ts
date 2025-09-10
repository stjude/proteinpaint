import type { TileSelection } from '@sjcrh/proteinpaint-types'
import { WSImage } from '@sjcrh/proteinpaint-types'

export class SessionWSImage extends WSImage {
	sessionsTileSelections?: TileSelection[]

	public static getTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const predictions = sessionWSImage.predictions || []
		const annotations = sessionWSImage.annotations || []
		const sessionsTileSelections = sessionWSImage.sessionsTileSelections || []
		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static isAnnotation(currentIndex: number, sessionWSImage: SessionWSImage): boolean {
		const sessionsCount = sessionWSImage.sessionsTileSelections?.length ?? 0
		const predictionsCount = sessionWSImage.predictions?.length ?? 0
		const annotationsCount = sessionWSImage.annotations?.length ?? 0

		const annotationsStartIndex = sessionsCount + predictionsCount
		const annotationsEndIndex = annotationsStartIndex + annotationsCount

		return currentIndex >= annotationsStartIndex && currentIndex < annotationsEndIndex
	}
}
