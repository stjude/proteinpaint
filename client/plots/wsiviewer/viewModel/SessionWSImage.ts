import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import { TileSelectionPrefix, WSImage } from '@sjcrh/proteinpaint-types'
import { roundValue } from '#shared/roundValue.js'

export class SessionWSImage extends WSImage {
	sessionsTileSelections?: TileSelection[]

	constructor(ws: WSImage, sessionsTileSelections?: TileSelection[]) {
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
		this.sessionsTileSelections = sessionsTileSelections
	}

	public static removeTileSelection(id: string, sessionWSImage: SessionWSImage): TileSelection[] {
		return sessionWSImage.sessionsTileSelections?.filter(selection => selection.id !== id) || []
	}

	public static getTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const annotations: Annotation[] = sessionWSImage.annotations || []

		const sessionsTileSelections: TileSelection[] = sessionWSImage.sessionsTileSelections || []

		const predictions: Prediction[] = sessionWSImage.predictions || []

		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static getTilesTableRows(sessionWSImage: SessionWSImage, selectedTileId: string): any[] {
		const annotations = sessionWSImage.annotations || []

		const sessionsTileSelections = sessionWSImage.sessionsTileSelections || []
		const selectedColor = '#fcfc8b'

		const sessionsRows: any[] = sessionsTileSelections.map((d, i) => {
			const idx = i
			const firstCell: any = { value: idx }
			// Mark original/background hint for renderers. Keep column shape unchanged.
			firstCell.origBackground = d.id === selectedTileId ? selectedColor : ''
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
			firstCell.origBackground = prediction.id === selectedTileId ? selectedColor : ''
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
			console.log(sessionWSImage.classes, annotation.class)
			const color = sessionWSImage.classes?.find(c => c.label === annotation.class)?.color
			const firstCell: any = { value: idx }
			firstCell.origBackground = annotation.id === selectedTileId ? selectedColor : ''
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

	public static isPrediction(id: string): boolean {
		return id.startsWith(TileSelectionPrefix.PREDICTION)
	}

	public static isSessionTileSelection(id: string): boolean {
		return id.startsWith(TileSelectionPrefix.SELECTION)
	}
}
