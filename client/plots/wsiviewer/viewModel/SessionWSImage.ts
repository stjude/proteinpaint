import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import { WSImage } from '@sjcrh/proteinpaint-types'
import { roundValue } from '#shared/roundValue.js'

export class SessionWSImage extends WSImage {
	sessionsTileSelections?: TileSelection[]

	constructor(ws: WSImage, sessionsTileSelections?: TileSelection[]) {
		// Initialize base with filename
		super(ws.filename)

		// copy common properties from provided WSImage
		this.id = ws.id
		this.metadata = ws.metadata
		this.predictionLayers = ws.predictionLayers
		this.annotations = ws.annotations || []
		this.classes = ws.classes
		this.uncertainty = ws.uncertainty
		this.activePatchColor = ws.activePatchColor
		this.tileSize = ws.tileSize

		this.predictions = ws.predictions

		// optionally initialize sessions tile selections (may be set later from settings)
		this.sessionsTileSelections = sessionsTileSelections
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

		const sessionsTileSelections: TileSelection[] = sessionWSImage.sessionsTileSelections || []

		const predictions: Prediction[] = sessionWSImage.predictions || []

		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static getTilesTableRows(sessionWSImage: SessionWSImage, selectedTileIndex: number): any[] {
		const annotations = sessionWSImage.annotations || []

		const sessionsTileSelections = sessionWSImage.sessionsTileSelections || []
		const selectedColor = '#fcfc8b'

		const sessionsRows: any[] = sessionsTileSelections.map((d, i) => {
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

		const predictionRows: any[] = (sessionWSImage.predictions || []).map((prediction, i) => {
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

	public static isPrediction(currentIndex: number, sessionWSImage: SessionWSImage): boolean {
		const sessionsCount = sessionWSImage.sessionsTileSelections?.length ?? 0

		const predictionsCount = (sessionWSImage.predictions || []).length

		return currentIndex >= sessionsCount && currentIndex < sessionsCount + predictionsCount
	}

	public static isSessionTileSelection(currentIndex: number, sessionWSImage: SessionWSImage): boolean {
		const sessionsCount = sessionWSImage.sessionsTileSelections?.length ?? 0
		if (sessionsCount == 0) return false
		return currentIndex >= 0 && currentIndex < sessionsCount
	}
}
