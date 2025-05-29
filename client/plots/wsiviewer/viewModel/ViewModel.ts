import type { TableRow, TableColumn } from '#dom'
import type { WSImage } from '#types'

export interface ViewModel {
	/** The image data for the WSI */
	imageData: WSImage
	viewData: ViewData
}

export type ViewData = {
	/** Data for annotations table */
	annotations?: {
		rows: TableRow[]
		columns: TableColumn[]
	}
	/** Data for classes table */
	classes?: {
		rows: TableRow[]
		columns: TableColumn[]
	}
	/** Shortcut array for keydown interation */
	shortcuts?: string[]
}
