// Utility to build annotations CSV used by multiple places

export const CSV_HEADERS = ['filename', 'label', 'coordinates', 'datetime']

function escapeCell(v: any): string {
	if (v === null || v === undefined) return ''
	const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
	const needsQuotes = /[",\n\r]/.test(s)
	const escaped = s.replace(/"/g, '""')
	return needsQuotes ? `"${escaped}"` : escaped
}

function formatTimestamp(ts: any): string {
	if (!ts) return ''
	const d = new Date(ts)
	if (isNaN(d.getTime())) return ts
	const pad = (n: number) => n.toString().padStart(2, '0')
	const yyyy = d.getFullYear()
	const mm = pad(d.getMonth() + 1)
	const dd = pad(d.getDate())
	const hh = pad(d.getHours())
	const min = pad(d.getMinutes())
	const ss = pad(d.getSeconds())
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

/**
 * Build a CSV string from annotations.
 * - annotations: array of annotation objects
 * - fixedFilename: if provided, use this filename for every row; otherwise use a.filename || a.image || ''
 * Returns empty string if annotations is not an array or empty.
 */
export function buildAnnotationsCsv(annotations: any[], fixedFilename?: string): string {
	if (!Array.isArray(annotations) || annotations.length === 0) return ''

	const rows = annotations.map((a: any) => {
		const filename = fixedFilename ?? a?.filename ?? a?.image ?? ''
		const label = a?.class ?? ''
		const coordinatesVal = a?.zoomCoordinates ?? ''
		const datetime = formatTimestamp(a?.timestamp)
		const rowValues = [filename, label, coordinatesVal, datetime]
		return rowValues.map(v => escapeCell(v ?? '')).join(',')
	})

	return [CSV_HEADERS.join(','), ...rows].join('\n')
}
