import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import {
	FlagStatus,
	FlagStatusMessages,
	checkSelectionType,
	SelectionPrefixes,
	WSImage
} from '@sjcrh/proteinpaint-types'

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
		const [selections, flagged_selections] = partition(
			sessionWSImage.sessionsTileSelections || [],
			ts => ts.flag === FlagStatus.Normal
		)
		const [preds, flagged_preds] = partition(sessionWSImage.predictions || [], ts => ts.flag === FlagStatus.Normal) as [
			Prediction[],
			Prediction[]
		]
		const [annotations, flagged_annotations] = partition(
			sessionWSImage.annotations || [],
			ts => ts.flag === FlagStatus.Normal
		) as [Annotation[], Annotation[]]
		for (const array of [selections, flagged_selections, preds, flagged_preds, annotations, flagged_annotations]) {
			array.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
		}
		// I could make a mega array of all flagged items and sort then,
		// but I feel unceratin annotations are the least important, maybe at least combine predictions and selections
		return [...selections, ...preds, ...flagged_selections, ...flagged_preds, ...flagged_annotations, ...annotations]
	}

	public static getTilesTableRows(sessionWSImage: SessionWSImage, selectedTileIndex: number): any[] {
		let row_index = 0
		const incrementIndex = () => {
			row_index++
		}
		const selectedColor = '#fcfc8b'

		const selectionRows: any[] = SessionWSImage.getTileSelections(sessionWSImage)
			.map(tileSelection => {
				const color = sessionWSImage.classes?.find(c => c.label === tileSelection.class)?.color
				const firstCell: any = { value: row_index }
				firstCell.origBackground = row_index === selectedTileIndex ? selectedColor : ''
				const isPrediction = checkSelectionType(tileSelection, SelectionPrefixes.Prediction)
				const isAnnotation = checkSelectionType(tileSelection, SelectionPrefixes.Annotation)
				const annotationLabel = isAnnotation ? tileSelection.class : ''
				const squareHTML =
					color === undefined
						? ''
						: `<span style="display:inline-block;width:12px;height:18px;background-color:${color};border:grey 1px solid;"></span>`
				incrementIndex()
				return [
					firstCell,
					{ value: tileSelection.zoomCoordinates },
					{ value: isPrediction ? (tileSelection as Prediction).uncertainty : 0 },
					{ value: isPrediction && FlagStatus.Normal === tileSelection.flag ? tileSelection.class : '' },
					{ html: squareHTML },
					{
						value: `${
							FlagStatus.Normal === tileSelection.flag ? annotationLabel : FlagStatusMessages[tileSelection.flag]
						}`
					}
				]
			})
			.filter((annotation, _) => annotation.length > 0)

		return selectionRows
	}

	public static isSessionTileSelection(tileSelection: TileSelection, sessionWSImage: SessionWSImage): boolean {
		return sessionWSImage.sessionsTileSelections?.map(ts => ts.id).includes(tileSelection.id) ?? false
	}
}
function partition(
	array: TileSelection[],
	callback: (element: TileSelection) => boolean
): [TileSelection[], TileSelection[]] {
	const trueList: TileSelection[] = []
	const falseList: TileSelection[] = []

	array.forEach(element => {
		if (callback(element)) {
			trueList.push(element)
		} else {
			falseList.push(element)
		}
	})

	return [trueList, falseList]
}
