import { clearServerDataCache, dofetch3 } from '#common/dofetch'
import type { TileSelection } from '#types'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.ts'
import type { DeleteWSITileSelectionRequest } from '@sjcrh/proteinpaint-types/routes/deleteWSITileSelection.ts'
import type VectorSource from 'ol/source/Vector'
import type VectorLayer from 'ol/layer/Vector'
import type { Feature } from 'ol'
import type { Geometry } from 'ol/geom'
import type { WSIViewerInteractions } from './WSIViewerInteractions'
import type { SessionWSImage } from '../viewModel/SessionWSImage'
import type Settings from '#plots/wsiviewer/Settings.ts'
import { checkSelectionType, SelectionPrefixes } from '@sjcrh/proteinpaint-shared'
interface Command {
	undo(): Promise<void>
	redo(): Promise<void>
}

export type ServerContext = {
	genome: string
	dslabel: string
	projectId: number
	wsimage: string
}

function dispatchRerender(wsiApp: any, sessionsTileSelection: TileSelection[]) {
	wsiApp.app.dispatch({
		type: 'plot_edit',
		id: wsiApp.id,
		config: {
			settings: {
				renderWSIViewer: true,
				renderAnnotationTable: true,
				changeTrigger: Date.now(),
				activeAnnotation: 0,
				isSavingAnnotation: false,
				sessionsTileSelection
			}
		}
	})
}

/** Map click — new unclassified session tile. Manages OL features directly to avoid zoom-out. */
export class CreateTileCommand implements Command {
	constructor(
		private wsiApp: any,
		private borderFeature: Feature<Geometry>,
		private source: VectorSource<Feature<Geometry>>,
		private tileSelection: TileSelection,
		private prevSessionsTileSelections: TileSelection[]
	) {}

	async undo() {
		this.source.removeFeature(this.borderFeature)
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: this.prevSessionsTileSelections
				}
			}
		})
	}

	async redo() {
		this.source.addFeature(this.borderFeature)
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: [this.tileSelection, ...this.prevSessionsTileSelections]
				}
			}
		})
	}
}
// TODO No Skip implementation
type SaveData = {
	/** Tile with Annotation ID after classification. */
	postTileSelection: TileSelection
	/** Original session tile before id/flag mutation (null if tile was a prediction). */
	prevTileSelection: TileSelection | null
	prevSessionsTileSelections: TileSelection[]
	classId: number
	serverCtx: ServerContext
	vectorLayer: VectorLayer<any, any>
	sessionImage: SessionWSImage
	eventCode: string
}
// save Tile undo: create tileselection again afer delete anno
// save tile redo: delete tile selection again, then save
// TODO gotta have exceptions for flagged and skippedtiles
/** Number key or Enter — classifies a tile. Syncs with server on undo/redo. */
export class SaveTileCommand implements Command {
	constructor(
		private wsiApp: any,
		private data: SaveData,
		private wsiInteractions: WSIViewerInteractions,
		private settings: Settings
	) {}

	async undo() {
		await this.wsiInteractions.fullDelete(
			this.wsiApp,
			this.data.vectorLayer,
			this.data.sessionImage,
			this.data.postTileSelection.id,
			this.data.prevSessionsTileSelections,
			this.settings
		)
		if (this.data.prevTileSelection) {
			// TODO make sure prediction comes back
			if (checkSelectionType(this.data.prevTileSelection, SelectionPrefixes.TileSelection)) {
				this.wsiInteractions.addTileSelection(
					this.wsiApp,
					this.data.prevTileSelection,
					this.data.vectorLayer.getSource(),
					this.settings.selectedPatchBorderColor,
					this.data.prevSessionsTileSelections,
					this.settings.tileSize
				)
			}
		}
	}

	async redo() {
		await this.wsiInteractions.fullSave(
			this.data.sessionImage,
			this.data.eventCode,
			this.settings,
			this.data.postTileSelection.id,
			this.data.vectorLayer,
			this.data.prevSessionsTileSelections,
			this.data.serverCtx.projectId
		)
	}
}

type SessionSkipFlagData = {
	source: VectorSource<Feature<Geometry>>
	/** Features present before the flag action (captured by reference before removal). */
	preActionFeatures: Feature<Geometry>[]
	/** Features present after the flag action. */
	postActionFeatures: Feature<Geometry>[]
	prevSessionsTileSelections: TileSelection[]
	newSessionsTileSelections: TileSelection[]
}

/** F/S key on an unclassified session tile (no server call). Manages OL features directly. */
export class SessionSkipFlagCommand implements Command {
	constructor(private wsiApp: any, private data: SessionSkipFlagData) {}

	async undo() {
		const { source, preActionFeatures, postActionFeatures } = this.data
		for (const f of postActionFeatures) {
			if (!preActionFeatures.includes(f)) source.removeFeature(f)
		}
		for (const f of preActionFeatures) {
			if (!postActionFeatures.includes(f)) source.addFeature(f)
		}
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: this.data.prevSessionsTileSelections
				}
			}
		})
	}

	async redo() {
		const { source, preActionFeatures, postActionFeatures } = this.data
		for (const f of preActionFeatures) {
			if (!postActionFeatures.includes(f)) source.removeFeature(f)
		}
		for (const f of postActionFeatures) {
			if (!preActionFeatures.includes(f)) source.addFeature(f)
		}
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: this.data.newSessionsTileSelections
				}
			}
		})
	}
}

type AnnotationFlagData = {
	tileSelectionBefore: TileSelection
	tileSelectionAfter: TileSelection
	classId: number
	serverCtx: ServerContext
	sessionsTileSelections: TileSelection[]
}

/** F/S key on a server-stored annotation. Persists flag change via saveWSIAnnotation. */
export class AnnotationFlagCommand implements Command {
	constructor(private wsiApp: any, private data: AnnotationFlagData) {}

	async undo() {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: this.data.serverCtx.genome,
				dslabel: this.data.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelectionBefore },
				classId: this.data.classId,
				projectId: this.data.serverCtx.projectId,
				wsimage: this.data.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Undo annotation flag:', e)
		}
		dispatchRerender(this.wsiApp, this.data.sessionsTileSelections)
	}

	async redo() {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: this.data.serverCtx.genome,
				dslabel: this.data.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelectionAfter },
				classId: this.data.classId,
				projectId: this.data.serverCtx.projectId,
				wsimage: this.data.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Redo annotation flag:', e)
		}
		dispatchRerender(this.wsiApp, this.data.sessionsTileSelections)
	}
}

type DeleteSessionData = {
	tileSelection: TileSelection
	prevSessionsTileSelections: TileSelection[]
	source: VectorSource<Feature<Geometry>>
	capturedFeatures: Feature<Geometry>[]
}

/** Backspace on an unclassified session tile. Manages OL features directly. */
export class DeleteSessionTileCommand implements Command {
	constructor(private wsiApp: any, private data: DeleteSessionData) {}

	async undo() {
		for (const f of this.data.capturedFeatures) {
			this.data.source.addFeature(f)
		}
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: [this.data.tileSelection, ...this.data.prevSessionsTileSelections]
				}
			}
		})
	}

	async redo() {
		for (const f of this.data.capturedFeatures) {
			this.data.source.removeFeature(f)
		}
		this.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: this.wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					sessionsTileSelection: this.data.prevSessionsTileSelections
				}
			}
		})
	}
}

type DeleteAnnotationData = {
	tileSelection: TileSelection
	classId: number
	serverCtx: ServerContext
	prevSessionsTileSelections: TileSelection[]
}

/** Backspace on a server-stored annotation or prediction. Syncs with server on undo/redo. */
export class DeleteAnnotationCommand implements Command {
	constructor(private wsiApp: any, private data: DeleteAnnotationData) {}

	async undo() {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: this.data.serverCtx.genome,
				dslabel: this.data.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelection },
				classId: this.data.classId,
				projectId: this.data.serverCtx.projectId,
				wsimage: this.data.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Undo delete annotation:', e)
		}
		dispatchRerender(this.wsiApp, this.data.prevSessionsTileSelections)
	}

	async redo() {
		try {
			const body: DeleteWSITileSelectionRequest = {
				genome: this.data.serverCtx.genome,
				dslabel: this.data.serverCtx.dslabel,
				projectId: this.data.serverCtx.projectId,
				classID: this.data.classId,
				tileSelection: this.data.tileSelection,
				wsimage: this.data.serverCtx.wsimage
			}
			await dofetch3('deleteWSITileSelection', { method: 'DELETE', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Redo delete annotation:', e)
		}
		dispatchRerender(this.wsiApp, this.data.prevSessionsTileSelections)
	}
}

export class UndoRedoHistory {
	private undoStack: Command[] = []
	private redoStack: Command[] = []
	private static readonly MAX_SIZE = 20

	push(cmd: Command): void {
		this.undoStack.push(cmd)
		if (this.undoStack.length > UndoRedoHistory.MAX_SIZE) {
			this.undoStack.shift()
		}
		this.redoStack = []
	}

	async undo(): Promise<void> {
		const cmd = this.undoStack.pop()
		if (!cmd) return
		await cmd.undo()
		this.redoStack.push(cmd)
	}

	async redo(): Promise<void> {
		const cmd = this.redoStack.pop()
		if (!cmd) return
		await cmd.redo()
		this.undoStack.push(cmd)
	}

	clear(): void {
		this.undoStack = []
		this.redoStack = []
	}

	get canUndo(): boolean {
		return this.undoStack.length > 0
	}
	get canRedo(): boolean {
		return this.redoStack.length > 0
	}
}
