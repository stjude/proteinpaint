import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import { WSImage } from '@sjcrh/proteinpaint-types'
import { roundValue } from '#shared/roundValue.js'

export class SessionWSImage extends WSImage {
	sessionsTileSelections?: TileSelection[]

	constructor(filename: string) {
		super(filename)
	}

	public static removeTileSelection(currentIndex: number, sessionWSImage: SessionWSImage): TileSelection[] {
		if (!sessionWSImage.sessionsTileSelections) return []

		const sessionsTileSelection = sessionWSImage.sessionsTileSelections[currentIndex]

		if (!sessionsTileSelection) return []
		if (currentIndex < 0 || currentIndex >= sessionWSImage.sessionsTileSelections.length) return []

		return sessionWSImage.sessionsTileSelections.splice(currentIndex, 1)
	}

	public static getTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const annotations: Annotation[] = sessionWSImage.annotations || []
		const annotationKeys = new Set(annotations.map(a => `${a.zoomCoordinates[0]},${a.zoomCoordinates[1]}`))

		const sessionsTileSelections: TileSelection[] = (sessionWSImage.sessionsTileSelections || []).filter(
			s => !annotationKeys.has(`${s.zoomCoordinates[0]},${s.zoomCoordinates[1]}`)
		)

		const predictions: Prediction[] = (sessionWSImage.predictions || []).filter(
			p => !annotationKeys.has(`${p.zoomCoordinates[0]},${p.zoomCoordinates[1]}`)
		)

		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static getTilesTableRows(sessionWSImage: SessionWSImage, selectedTileIndex: number): any[] {
		const annotations = sessionWSImage.annotations || []
		const annotationKeys = new Set(annotations.map(a => `${a.zoomCoordinates[0]},${a.zoomCoordinates[1]}`))

		const sessionsFiltered = (sessionWSImage.sessionsTileSelections || []).filter(
			s => !annotationKeys.has(`${s.zoomCoordinates[0]},${s.zoomCoordinates[1]}`)
		)

		const selectedColor = '#fcfc8b'

		const sessionsRows: any[] = sessionsFiltered.map((d, i) => {
			const idx = i
			const firstCell: any = { value: idx }
			// Mark original/background hint for renderers. Keep column shape unchanged.
			firstCell.origBackground = idx === selectedTileIndex ? selectedColor : ''
			return [
				firstCell, // Index
				{ value: d.zoomCoordinates },
				{ value: 0 },
				{ value: '' },
				{ html: '' },
				{ value: '' }
			]
		})

		const predictionsFiltered = (sessionWSImage.predictions || []).filter(
			p => !annotationKeys.has(`${p.zoomCoordinates[0]},${p.zoomCoordinates[1]}`)
		)

		const predictionRows: any[] = predictionsFiltered.map((prediction, i) => {
			const idx = sessionsRows.length + i // Continue index after sessions
			const color = sessionWSImage.classes?.find(c => c.label === prediction.class)?.color
			const firstCell: any = { value: idx }
			firstCell.origBackground = idx === selectedTileIndex ? selectedColor : ''
			return [
				firstCell,
				{ value: prediction.zoomCoordinates },
				{ value: roundValue(prediction.uncertainty, 4) },
				{ value: prediction.class },
				{
					html: `<span style="display:inline-block;width:12px;height:18px;background-color:${color};border:grey 1px solid;"></span>`
				},
				{ value: '' }
			]
		})

		const annotationsRows: any[] = annotations.map((annotation, i) => {
			const idx = sessionsRows.length + predictionRows.length + i // Continue index
			const color = sessionWSImage.classes?.find(c => c.label === annotation.class)?.color
			const firstCell: any = { value: idx }
			firstCell.origBackground = idx === selectedTileIndex ? selectedColor : ''
			return [
				firstCell,
				{ value: annotation.zoomCoordinates },
				{ value: 0 },
				{ value: '' },
				{
					html: `<span style="display:inline-block;width:12px;height:18px;background-color:${color};border:grey 1px solid;"></span>`
				},
				{ value: annotation.class }
			]
		})

		return [...sessionsRows, ...predictionRows, ...annotationsRows]
	}

	public static isSessionTileSelection(currentIndex: number, sessionWSImage: SessionWSImage): boolean {
		const sessionsCount = sessionWSImage.sessionsTileSelections?.length ?? 0
		if (sessionsCount == 0) return false
		return currentIndex >= 0 && currentIndex < sessionsCount
	}
}
