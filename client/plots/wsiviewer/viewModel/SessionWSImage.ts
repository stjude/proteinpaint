import type { Annotation, Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import {
	FlagStatus,
	FlagStatusMessages,
	checkSelectionType,
	SelectionPrefixes,
	WSImage
} from '@sjcrh/proteinpaint-types'
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
	public static getNextTileID(sessionWSImage: SessionWSImage, settings: Settings, currentIndex: number): string {
		const allSelections = SessionWSImage.getTileSelections(sessionWSImage, settings) || []
		if (allSelections.length < 2) return ''
		const nextID: string =
			currentIndex === allSelections.length - 1 ? allSelections[0].id : allSelections[currentIndex + 1].id
		console.trace('current index', currentIndex, nextID)

		return nextID
	}

	public static findTileIndexByID(tileID: string, sessionWSImage: SessionWSImage, settings: Settings): number {
		const allSelections = SessionWSImage.getTileSelections(sessionWSImage, settings) || []
		const foundIndex = allSelections.findIndex(ts => ts.id === tileID)
		if (foundIndex === -1) return 0
		return foundIndex
	}

	public static removeTileSelection(tileSelection: TileSelection, sessionWSImage: SessionWSImage): TileSelection[] {
		if (!sessionWSImage.sessionsTileSelections) return []
		sessionWSImage.sessionsTileSelections = sessionWSImage.sessionsTileSelections.filter(
			(ts: TileSelection) => tileSelection.id !== ts.id
		)
		return sessionWSImage.sessionsTileSelections
	}

	public static getTileSelections(sessionWSImage: SessionWSImage, settings: Settings): TileSelection[] {
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

		const flagged_and_annotated = [...flagged_selections, ...flagged_preds, ...flagged_annotations, ...annotations]
		const desired_arrays = [selections, preds, flagged_and_annotated]
		for (const array of desired_arrays) {
			array.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
		}
		const filtered_arrays = desired_arrays.flat().filter(ts => {
			if (ts.flag === FlagStatus.Skipped && !settings.renderSkipped) return false
			if (ts.flag !== FlagStatus.Flagged && settings.renderOnlyFlagged) return false
			if (ts.flag === FlagStatus.Deleted) return false
			return true
		})
		return filtered_arrays
	}

	public static getUnfilteredTileSelections(sessionWSImage: SessionWSImage): TileSelection[] {
		const selections = sessionWSImage.sessionsTileSelections || []
		const preds = sessionWSImage.predictions || []
		const annotations = sessionWSImage.annotations || []
		return [...selections, ...preds, ...annotations]
	}

	public static getTilesTableRows(
		sessionWSImage: SessionWSImage,
		selectedTileIndex: number,
		settings: Settings
	): any[] {
		let row_index = 0
		const incrementIndex = () => {
			row_index++
		}
		const selectedColor = '#fcfc8b'

		const selectionRows: any[] = SessionWSImage.getTileSelections(sessionWSImage, settings)
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
