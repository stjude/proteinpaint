import { clearServerDataCache, dofetch3 } from '#common/dofetch'
import type { TileSelection } from '#types'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.ts'
import type { DeleteWSITileSelectionRequest } from '@sjcrh/proteinpaint-types/routes/deleteWSITileSelection.ts'
import type VectorLayer from 'ol/layer/Vector'
import type { Feature } from 'ol'
import type { Geometry } from 'ol/geom'
import type { WSIViewerInteractions } from './WSIViewerInteractions'
import type { SessionWSImage } from '../viewModel/SessionWSImage'
import type Settings from '#plots/wsiviewer/Settings.ts'
import { checkSelectionType, SelectionPrefixes } from '@sjcrh/proteinpaint-shared'
export type UndoRedoContext = {
	wsiApp: any
	wsiInteractions: WSIViewerInteractions
	sessionImage: SessionWSImage
	vectorLayer: VectorLayer<any, any>
	serverCtx: ServerContext
}

interface Command {
	undo(ctx: UndoRedoContext): Promise<void>
	redo(ctx: UndoRedoContext): Promise<void>
}

export type ServerContext = {
	genome: string
	dslabel: string
	projectId: number
	wsimage: string
}

function dispatchRerender(ctx: UndoRedoContext, sessionsTileSelection: TileSelection[]) {
	ctx.wsiApp.app.dispatch({
		type: 'plot_edit',
		id: ctx.wsiApp.id,
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

// Done
export class CreateTileCommand implements Command {
	constructor(
		private borderFeature: Feature<Geometry>,
		private tileSelection: TileSelection,
		private prevSessionsTileSelections: TileSelection[]
	) {}

	async undo(ctx: UndoRedoContext) {
		ctx.vectorLayer.getSource()!.removeFeature(this.borderFeature)
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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

	async redo(ctx: UndoRedoContext) {
		ctx.vectorLayer.getSource()!.addFeature(this.borderFeature)
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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
	prevTileSelection: TileSelection
	prevSessionsTileSelections: TileSelection[]
	classId: number
	eventCode: string
}
// save Tile undo: create tileselection again afer delete anno
// save tile redo: delete tile selection again, then save
// TODO gotta have exceptions for flagged and skippedtiles
/** Number key or Enter — classifies a tile. Syncs with server on undo/redo. */
export class SaveTileCommand implements Command {
	constructor(private data: SaveData, private settings: Settings) {}

	async undo(ctx: UndoRedoContext) {
		console.log(this.data.prevTileSelection, this.data.postTileSelection)
		await ctx.wsiInteractions.fullDelete(
			ctx.wsiApp,
			ctx.vectorLayer,
			ctx.sessionImage,
			this.data.postTileSelection.id,
			this.data.prevTileSelection.id
		)
		if (this.data.prevTileSelection) {
			//TODO make sure prediction comes back
			if (checkSelectionType(this.data.prevTileSelection, SelectionPrefixes.TileSelection)) {
				ctx.wsiInteractions.addTileSelection(
					ctx.wsiApp,
					this.data.prevTileSelection,
					ctx.vectorLayer,
					this.settings.selectedPatchBorderColor,
					this.data.prevSessionsTileSelections,
					this.settings.tileSize
				)
			}
		}
	}

	async redo(ctx: UndoRedoContext) {
		await ctx.wsiInteractions.fullSave(
			ctx.sessionImage,
			this.data.eventCode,
			this.settings,
			ctx.vectorLayer,
			this.data.prevTileSelection,
			ctx.serverCtx.projectId
		)
	}
}

type SessionSkipFlagData = {
	/** Features present before the flag action (captured by reference before removal). */
	preActionFeatures: Feature<Geometry>[]
	/** Features present after the flag action. */
	postActionFeatures: Feature<Geometry>[]
	prevSessionsTileSelections: TileSelection[]
	newSessionsTileSelections: TileSelection[]
}

/** F/S key on an unclassified session tile (no server call). Manages OL features directly. */
export class SessionSkipFlagCommand implements Command {
	constructor(private data: SessionSkipFlagData) {}

	async undo(ctx: UndoRedoContext) {
		const source = ctx.vectorLayer.getSource()!
		const { preActionFeatures, postActionFeatures } = this.data
		for (const f of postActionFeatures) {
			if (!preActionFeatures.includes(f)) source.removeFeature(f)
		}
		for (const f of preActionFeatures) {
			if (!postActionFeatures.includes(f)) source.addFeature(f)
		}
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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

	async redo(ctx: UndoRedoContext) {
		const source = ctx.vectorLayer.getSource()!
		const { preActionFeatures, postActionFeatures } = this.data
		for (const f of preActionFeatures) {
			if (!postActionFeatures.includes(f)) source.removeFeature(f)
		}
		for (const f of postActionFeatures) {
			if (!preActionFeatures.includes(f)) source.addFeature(f)
		}
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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
	sessionsTileSelections: TileSelection[]
}

/** F/S key on a server-stored annotation. Persists flag change via saveWSIAnnotation. */
export class AnnotationFlagCommand implements Command {
	constructor(private data: AnnotationFlagData) {}

	async undo(ctx: UndoRedoContext) {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: ctx.serverCtx.genome,
				dslabel: ctx.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelectionBefore },
				classId: this.data.classId,
				projectId: ctx.serverCtx.projectId,
				wsimage: ctx.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Undo annotation flag:', e)
		}
		dispatchRerender(ctx, this.data.sessionsTileSelections)
	}

	async redo(ctx: UndoRedoContext) {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: ctx.serverCtx.genome,
				dslabel: ctx.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelectionAfter },
				classId: this.data.classId,
				projectId: ctx.serverCtx.projectId,
				wsimage: ctx.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Redo annotation flag:', e)
		}
		dispatchRerender(ctx, this.data.sessionsTileSelections)
	}
}

type DeleteSessionData = {
	tileSelection: TileSelection
	prevSessionsTileSelections: TileSelection[]
	capturedFeatures: Feature<Geometry>[]
}

/** Backspace on an unclassified session tile. Manages OL features directly. */
export class DeleteSessionTileCommand implements Command {
	constructor(private data: DeleteSessionData) {}

	async undo(ctx: UndoRedoContext) {
		const source = ctx.vectorLayer.getSource()!
		for (const f of this.data.capturedFeatures) {
			source.addFeature(f)
		}
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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

	async redo(ctx: UndoRedoContext) {
		const source = ctx.vectorLayer.getSource()!
		for (const f of this.data.capturedFeatures) {
			source.removeFeature(f)
		}
		ctx.wsiApp.app.dispatch({
			type: 'plot_edit',
			id: ctx.wsiApp.id,
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
	prevSessionsTileSelections: TileSelection[]
}

/** Backspace on a server-stored annotation or prediction. Syncs with server on undo/redo. */
export class DeleteAnnotationCommand implements Command {
	constructor(private data: DeleteAnnotationData) {}

	async undo(ctx: UndoRedoContext) {
		try {
			const body: SaveWSIAnnotationRequest = {
				genome: ctx.serverCtx.genome,
				dslabel: ctx.serverCtx.dslabel,
				tileSelection: { ...this.data.tileSelection },
				classId: this.data.classId,
				projectId: ctx.serverCtx.projectId,
				wsimage: ctx.serverCtx.wsimage
			}
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Undo delete annotation:', e)
		}
		dispatchRerender(ctx, this.data.prevSessionsTileSelections)
	}

	async redo(ctx: UndoRedoContext) {
		try {
			const body: DeleteWSITileSelectionRequest = {
				genome: ctx.serverCtx.genome,
				dslabel: ctx.serverCtx.dslabel,
				projectId: ctx.serverCtx.projectId,
				classID: this.data.classId,
				tileSelection: this.data.tileSelection,
				wsimage: ctx.serverCtx.wsimage
			}
			await dofetch3('deleteWSITileSelection', { method: 'DELETE', body })
			clearServerDataCache()
		} catch (e: any) {
			console.error('Redo delete annotation:', e)
		}
		dispatchRerender(ctx, this.data.prevSessionsTileSelections)
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

	async undo(ctx: UndoRedoContext): Promise<void> {
		const cmd = this.undoStack.pop()
		if (!cmd) {
			console.warn('Nothing to undo')
			return
		}
		await cmd.undo(ctx)
		this.redoStack.push(cmd)
	}

	async redo(ctx: UndoRedoContext): Promise<void> {
		const cmd = this.redoStack.pop()
		if (!cmd) {
			console.warn('Nothing to redo')
			return
		}
		await cmd.redo(ctx)
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
