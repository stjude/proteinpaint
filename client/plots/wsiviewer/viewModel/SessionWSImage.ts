import type { TileSelection } from '@sjcrh/proteinpaint-types'
import { WSImage } from '@sjcrh/proteinpaint-types'

export class SessionWSImage extends WSImage {
	sessionsTileSelections?: TileSelection[]

	public static removeTileSelection(currentIndex: number, sessionWSImage: SessionWSImage): TileSelection[] {
		if (!sessionWSImage.sessionsTileSelections) return []

		const sessionsTileSelection = sessionWSImage.sessionsTileSelections[currentIndex]

		if (!sessionsTileSelection) return []
		if (currentIndex < 0 || currentIndex >= sessionWSImage.sessionsTileSelections.length) return []

		return sessionWSImage.sessionsTileSelections.splice(currentIndex, 1)
	}

	public static getTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const predictions = sessionWSImage.predictions || []
		const annotations = sessionWSImage.annotations || []
		const sessionsTileSelections = sessionWSImage.sessionsTileSelections || []
		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static isSessionTileSelection(currentIndex: number, sessionWSImage: SessionWSImage): boolean {
		const sessionsCount = sessionWSImage.sessionsTileSelections?.length ?? 0
		if (sessionsCount == 0) return false
		return currentIndex >= 0 && currentIndex < sessionsCount
	}
}
