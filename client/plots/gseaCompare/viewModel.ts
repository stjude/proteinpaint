/* The grid of a pathway comparison: gene sets in rows, comparisons in columns, from the genesetEnrichment result of
each column. Pure functions of their inputs, so that sorting, filtering and the downloaded table are tested without a
browser (test/viewModel.unit.spec.ts). */

/** one column: a case group against the reference, on one data type */
export type Column = {
	key: string
	caseName: string
	controlName: string
	termType: string
	/** the data type as a short column subheading */
	dataLabel: string
	color?: string
}

/** one gene set of one genesetEnrichment result; nes arrives as the string 'Infinity' or '-Infinity' when blitzgsea
 * saturates */
export type SetResult = { nes: number | string; fdr: number; geneset_size?: number; leading_edge?: string }

export type ColumnResult =
	| { status: 'pending' }
	| { status: 'error'; error: string }
	| { status: 'done'; sets: Record<string, SetResult> }

export type Cell = {
	nes: number | null
	fdr: number | null
	/** −log10 of fdr, capped for the dot size */
	negLog: number
	significant: boolean
	size?: number
	leadingEdge: string[]
}

export type Row = { key: string; label: string; cells: Cell[] }

export type GridSettings = {
	fdrCutoff: number
	/** 'significant': rows significant in at least one column; 'all': every gene set */
	rowFilter: 'significant' | 'all'
	maxRows: number
	/** column index to sort by its NES, or null for the default order */
	sortCol: number | null
	sortDir: 'ascending' | 'descending'
}

export type Grid = { rows: Row[]; maxAbsNes: number; maxNegLog: number; totalRows: number }

/** a cap on −log10 q for the dot size: blitzgsea floors its q values, and one tiny q would shrink every other dot */
export const NEG_LOG_CAP = 6
/** a cap on |NES| for the color: 'Infinity' from a saturated fit would wash out every finite value */
const NES_CAP = 10

export function buildGrid(columns: Column[], results: ColumnResult[], s: GridSettings): Grid {
	const names = new Set<string>()
	for (const r of results) if (r.status == 'done') for (const k of Object.keys(r.sets)) names.add(k)
	let rows: Row[] = [...names].map(key => ({
		key,
		label: formatSetName(key),
		cells: columns.map((_, i) => toCell(results[i], key, s.fdrCutoff))
	}))
	if (s.rowFilter == 'significant') rows = rows.filter(r => r.cells.some(c => c.significant))
	const totalRows = rows.length
	rows.sort(s.sortCol == null ? defaultOrder : byColumn(s.sortCol, s.sortDir))
	rows = rows.slice(0, s.maxRows)
	let maxAbsNes = 0,
		maxNegLog = 0
	for (const r of rows)
		for (const c of r.cells) {
			if (c.nes != null) maxAbsNes = Math.max(maxAbsNes, Math.abs(c.nes))
			maxNegLog = Math.max(maxNegLog, c.negLog)
		}
	return { rows, maxAbsNes: maxAbsNes || 1, maxNegLog: maxNegLog || 1, totalRows }
}

function toCell(r: ColumnResult | undefined, key: string, fdrCutoff: number): Cell {
	const v = r?.status == 'done' ? r.sets[key] : undefined
	if (!v) return { nes: null, fdr: null, negLog: 0, significant: false, leadingEdge: [] }
	const nes = toNumber(v.nes)
	const fdr = Number.isFinite(v.fdr) ? v.fdr : null
	return {
		nes,
		fdr,
		negLog: fdr == null ? 0 : Math.min(NEG_LOG_CAP, -Math.log10(Math.max(fdr, 10 ** -NEG_LOG_CAP))),
		// an unscored set (nes 0, p 1) is never significant, whatever its q
		significant: fdr != null && fdr < fdrCutoff && nes != null && nes != 0,
		size: v.geneset_size,
		leadingEdge: (v.leading_edge || '').split(',').filter(Boolean)
	}
}

/** NES as a number, ±Infinity capped so that the color scale keeps its range */
export function toNumber(v: number | string | null | undefined): number | null {
	if (v === null || v === undefined || v === '') return null
	const n = typeof v == 'number' ? v : Number(v)
	if (Number.isNaN(n)) return null
	return Math.max(-NES_CAP, Math.min(NES_CAP, n))
}

/** sets significant in more columns first, then by the strongest |NES| among the significant cells, then by name:
 * what the comparisons share comes to the top */
function defaultOrder(a: Row, b: Row) {
	const n = (r: Row) => r.cells.filter(c => c.significant).length
	const top = (r: Row) => Math.max(0, ...r.cells.filter(c => c.significant).map(c => Math.abs(c.nes!)))
	return n(b) - n(a) || top(b) - top(a) || a.label.localeCompare(b.label)
}

/** by one column's NES; cells without a value go last in either direction */
function byColumn(col: number, dir: 'ascending' | 'descending') {
	const f = dir == 'ascending' ? 1 : -1
	return (a: Row, b: Row) => {
		const x = a.cells[col]?.nes,
			y = b.cells[col]?.nes
		if (x == null && y == null) return a.label.localeCompare(b.label)
		if (x == null) return 1
		if (y == null) return -1
		return f * (x - y) || a.label.localeCompare(b.label)
	}
}

/* Collection prefixes that MSigDB puts on every set name of a collection; the tooltip keeps the full name */
const PREFIXES = /^(HALLMARK|KEGG(_MEDICUS)?|REACTOME|WP|BIOCARTA|PID|GOBP|GOCC|GOMF|HP)_/

/* MSigDB names are upper case, so acronyms cannot be told from words by case: the ones the common collections use,
spelled as papers write them */
const ACRONYMS: Record<string, string> = {
	TNFA: 'TNFα',
	NFKB: 'NF-κB',
	KRAS: 'KRAS',
	MYC: 'MYC',
	DNA: 'DNA',
	RNA: 'RNA',
	UV: 'UV',
	MTOR: 'mTOR',
	MTORC1: 'mTORC1',
	PI3K: 'PI3K',
	AKT: 'AKT',
	JAK: 'JAK',
	TGF: 'TGF',
	WNT: 'WNT',
	ER: 'ER',
	ECM: 'ECM',
	NK: 'NK',
	DN: 'down'
}

/** HALLMARK_TNFA_SIGNALING_VIA_NFKB -> 'TNFα signaling via NF-κB': known acronyms and words carrying a digit (gene and
 * pathway symbols such as IL2, STAT5, E2F) keep their spelling, everything else is sentence case */
export function formatSetName(name: string): string {
	const words = name.replace(PREFIXES, '').split('_').filter(Boolean)
	const out = words.map((w, i) => {
		if (ACRONYMS[w]) return ACRONYMS[w]
		if (/\d/.test(w)) return w
		const lower = w.toLowerCase()
		return i == 0 ? lower[0].toUpperCase() + lower.slice(1) : lower
	})
	return out.join(' ') || name
}

/** the grid as a table for downloadTable(): one row per gene set, NES and q per column */
export function gridTable(grid: Grid, columns: Column[]) {
	const cols = [
		{ label: 'Gene set' },
		...columns.flatMap(c => [
			{ label: `${c.caseName} vs ${c.controlName}, ${c.dataLabel}: NES` },
			{ label: `${c.caseName} vs ${c.controlName}, ${c.dataLabel}: q` }
		])
	]
	const rows = grid.rows.map(r => [
		{ value: r.key },
		...r.cells.flatMap(c => [{ value: c.nes ?? '' }, { value: c.fdr ?? '' }])
	])
	return { rows, cols }
}
