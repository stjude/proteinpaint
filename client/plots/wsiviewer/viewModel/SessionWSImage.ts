import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import { AnnotationStatus, AnnotationStatusMessages, WSImage } from '@sjcrh/proteinpaint-types'
import { roundValue } from '#shared/roundValue.js'
import type Settings from '#plots/wsiviewer/Settings.ts'

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

	public static removeTileSelection(tileSelection: TileSelection, sessionWSImage: SessionWSImage): TileSelection[] {
		if (!sessionWSImage.sessionsTileSelections) return []
		sessionWSImage.sessionsTileSelections = sessionWSImage.sessionsTileSelections.filter(
			(ts: TileSelection) => JSON.stringify(ts.zoomCoordinates) !== JSON.stringify(tileSelection.zoomCoordinates)
		)
		return sessionWSImage.sessionsTileSelections
	}

	public static getTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const annotations: Annotation[] = sessionWSImage.annotations || []

		const sessionsTileSelections: TileSelection[] = sessionWSImage.sessionsTileSelections || []

		const predictions: Prediction[] = sessionWSImage.predictions || []

		return [...sessionsTileSelections, ...predictions, ...annotations]
	}

	public static getTilesTableRows(
		sessionWSImage: SessionWSImage,
		selectedTileIndex: number,
		settings: Settings
	): any[] {
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
				{ value: `${AnnotationStatusMessages[d.flag]}` }
			]
		})

		const predictionRows: any[] = (sessionWSImage.predictions || [])
			.map((prediction, i) => {
				if (prediction.flag === AnnotationStatus.Skipped && !settings.renderSkipped) return []
				if (prediction.flag !== AnnotationStatus.Flagged && settings.renderOnlyFlagged) return []
				const idx = sessionsRows.length + i // Continue index after sessions
				const color = sessionWSImage.classes?.find(c => c.label === prediction.class)?.color
				const firstCell: any = { value: idx }
				firstCell.origBackground = idx === selectedTileIndex ? selectedColor : ''
				console.log(prediction.flag, AnnotationStatusMessages[prediction.flag])
				return [
					firstCell,
					{ value: prediction.zoomCoordinates },
					{ value: roundValue(prediction.uncertainty, 4) },
					{ value: prediction.class },
					{
						html: `<span style="display:inline-block;width:12px;height:18px;background-color:${color};border:grey 1px solid;"></span>`
					},
					{ value: `${AnnotationStatusMessages[prediction.flag]}` }
				]
			})
			.filter((annotation, _) => annotation.length > 0)

		const annotationsRows: any[] = annotations
			.map((annotation, i) => {
				if (annotation.flag === AnnotationStatus.Skipped && !settings.renderSkipped) return []
				if (annotation.flag !== AnnotationStatus.Flagged && settings.renderOnlyFlagged) return []
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
					{ value: `${annotation.class} ${AnnotationStatusMessages[annotation.flag]}` }
				]
			})
			.filter((annotation, _) => annotation.length > 0)

		return [...sessionsRows, ...predictionRows, ...annotationsRows]
	}

	public static isPrediction(tileSelection: TileSelection): boolean {
		return 'uncertainty' in tileSelection
	}

	public static isSessionTileSelection(tileSelection: TileSelection): boolean {
		const isPrediction = 'uncertainty' in tileSelection
		const isAnnotation = 'timestamp' in tileSelection
		return !isAnnotation && !isPrediction
	}
}
