import type { TableCell } from '#dom'

export type ImageViewData = {
	activePatchColor?: string
	tilesTable?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	classesTable?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	shortcuts?: string[]
	uncertainty?: any
	metadata?: any
}
