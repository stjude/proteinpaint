import type { TableCell } from '#dom'

export type ImageViewData = {
	activePatchColor?: string
	annotations?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	classes?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	shortcuts?: string[]
	uncertainty?: any
	metadata?: any
}
