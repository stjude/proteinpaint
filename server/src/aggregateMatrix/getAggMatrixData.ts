import type {
	AggMatrixDot,
	AxisSection,
	TermdbAggregateMatrixRequest,
	ValidAggMatrixResponse,
	ValidGetDataResponse
} from '#types'
import { PSEUDOBULK } from '#types'
import { isDictionaryType, isNumericTerm } from '#shared/terms.js'
import { getData } from '../termdb.matrix.js'
import { calculateAggregateMethod, calculateSampleBasedMethods } from './aggregateMethods.ts'

type ValueByRow = Record<string, number | null>
type RowData = { id: string; label: string; section: string; tw: any; queryId: string }
type ColData = { section: string; id: string; colorValues: ValueByRow; sizeValues: ValueByRow }
type ProcessedData = { values: ValueByRow; min: number; max: number }
export type AggregateMatrixDataRequest = TermdbAggregateMatrixRequest &
	Required<Pick<TermdbAggregateMatrixRequest, 'rows' | 'gradientMethod' | 'sizeMethod'>>

export async function getAggMatrixData(q: AggregateMatrixDataRequest, ds: any): Promise<ValidAggMatrixResponse> {
	const columnTerms = Object.values(q.columns).flat()
	const pseudobulkColumns = columnTerms.filter(tw => tw.term.type == PSEUDOBULK).length
	if (!pseudobulkColumns) {
		return getIntersectionMatrixData(q, ds)
	}
	if (pseudobulkColumns != columnTerms.length) {
		throw new Error('Pseudobulk and sample-based columns cannot currently be combined in one aggregate matrix')
	}
	const { rows, sections: rowSections, longestLabel: rowLongest } = makeRows(q)
	const columns: ColData[] = []
	const colSections: AxisSection[] = []
	let colLongest = ''
	let colorMin = Infinity
	let colorMax = -Infinity
	let sizeMin = Infinity
	let sizeMax = -Infinity

	for (const section in q.columns) {
		const sectionColumns = q.columns[section]
		colSections.push({
			id: section,
			terms: sectionColumns.map(tw => {
				const label = tw.term.name || tw.term.id
				if (label.length > colLongest.length) colLongest = label
				return { id: tw.term.id, label }
			})
		})

		/* Process columns sequentially to bound peak getData response memory. Each generic
		 * column loads both methods from one response; pseudobulk retains one read per method. */
		for (const columnTw of sectionColumns) {
			let colorData: ProcessedData
			let sizeData: ProcessedData
			if (columnTw.term.type == PSEUDOBULK) {
				const genes = rows.map(row => row.id)
				colorData = await getPseudobulkData(columnTw, genes, q.gradientMethod, q, ds)
				sizeData = await getPseudobulkData(columnTw, genes, q.sizeMethod, q, ds)
			} else {
				const byMethod = await getSampleBasedData(columnTw, rows, [q.gradientMethod, q.sizeMethod], q, ds)
				colorData = summarizeValues(byMethod.get(q.gradientMethod)!, rows.map(row => row.id))
				sizeData = summarizeValues(byMethod.get(q.sizeMethod)!, rows.map(row => row.id))
			}

			colorMin = Math.min(colorMin, colorData.min)
			colorMax = Math.max(colorMax, colorData.max)
			sizeMin = Math.min(sizeMin, sizeData.min)
			sizeMax = Math.max(sizeMax, sizeData.max)
			columns.push({
				section,
				id: columnTw.term.id,
				colorValues: colorData.values,
				sizeValues: sizeData.values
			})
		}
	}

	if (!columns.length) throw new Error('No aggregate matrix columns found')
	const data: AggMatrixDot[][] = rows.map(row =>
		columns.map(column => ({
			rowSection: row.section,
			row: row.id,
			colSection: column.section,
			column: column.id,
			colorValue: column.colorValues[row.id] ?? null,
			sizeValue: column.sizeValues[row.id] ?? null
		}))
	)

	return {
		colorScale: { min: colorMin, max: colorMax },
		sizeScale: { min: sizeMin, max: sizeMax },
		data,
		axesLayout: {
			rows: { sections: rowSections, rowCount: rows.length, longestLabel: rowLongest },
			columns: {
				sections: colSections,
				colCount: columns.length,
				longestLabel: colLongest
			}
		}
	}
}

type AxisSource = { section: string; tw: any; queryId: string; expand: boolean }
type ResolvedAxisEntry = { id: string; label: string; section: string; source: AxisSource; key?: string }

async function getIntersectionMatrixData(q: AggregateMatrixDataRequest, ds: any): Promise<ValidAggMatrixResponse> {
	const rowSources = makeAxisSources(q.rows, 'row')
	const columnSources = makeAxisSources(q.columns, 'column')
	const response = await queryData(
		[...rowSources, ...columnSources].map(source => makeSampleTerm(source.tw, source.queryId)),
		q,
		ds
	)
	const rows = resolveAxisEntries(rowSources, response)
	const columns = resolveAxisEntries(columnSources, response)
	if (!rows.length || !columns.length) throw new Error('No aggregate matrix axis entries found')

	const rowLookup = makeEntryLookup(rows)
	const columnLookup = makeEntryLookup(columns)
	const cellCount = rows.length * columns.length
	const counts = new Uint32Array(cellCount)
	const columnCounts = new Uint32Array(columns.length)
	const sums = new Float64Array(cellCount)
	for (const sample of Object.values<any>(response.samples)) {
		const rowIndexes = resolveSampleEntryIndexes(sample, rowSources, rowLookup)
		const columnIndexes = resolveSampleEntryIndexes(sample, columnSources, columnLookup)
		if (!columnIndexes.length) continue
		for (const columnIndex of columnIndexes) columnCounts[columnIndex]++
		if (!rowIndexes.length) continue
		for (const rowIndex of rowIndexes) {
			for (const columnIndex of columnIndexes) {
				const index = rowIndex * columns.length + columnIndex
				counts[index]++
				const value = sample[columns[columnIndex].source.queryId]?.value
				if (typeof value == 'number' && Number.isFinite(value)) sums[index] += value
			}
		}
	}

	let colorMin = Infinity
	let colorMax = -Infinity
	let sizeMin = Infinity
	let sizeMax = -Infinity
	const data = rows.map((row, rowIndex) =>
		columns.map((column, columnIndex) => {
			const index = rowIndex * columns.length + columnIndex
			const stats = { matches: counts[index], columnCount: columnCounts[columnIndex], sum: sums[index] }
			const colorValue = calculateAggregateMethod(q.gradientMethod, stats)
			const sizeValue = calculateAggregateMethod(q.sizeMethod, stats)
			if (colorValue !== null) {
				if (colorValue < colorMin) colorMin = colorValue
				if (colorValue > colorMax) colorMax = colorValue
			}
			if (sizeValue !== null) {
				if (sizeValue < sizeMin) sizeMin = sizeValue
				if (sizeValue > sizeMax) sizeMax = sizeValue
			}
			return {
				rowSection: row.section,
				row: row.id,
				colSection: column.section,
				column: column.id,
				colorValue,
				sizeValue
			}
		})
	)

	return {
		colorScale: getScale(colorMin, colorMax),
		sizeScale: getScale(sizeMin, sizeMax),
		data,
		axesLayout: {
			rows: makeAxisLayout(rows, 'row'),
			columns: makeAxisLayout(columns, 'column')
		}
	}
}

function makeAxisSources(axis: Record<string, any[]>, prefix: string): AxisSource[] {
	const sources: AxisSource[] = []
	for (const [section, terms] of Object.entries(axis)) {
		for (const tw of terms) {
			sources.push({
				section,
				tw,
				queryId: `agg_${prefix}_${sources.length}`,
				expand: isDictionaryType(tw.term.type)
			})
		}
	}
	return sources
}

function resolveAxisEntries(sources: AxisSource[], response: ValidGetDataResponse): ResolvedAxisEntry[] {
	const entries: ResolvedAxisEntry[] = []
	for (const source of sources) {
		if (!source.expand) {
			const id = source.tw.term.gene || source.tw.term.id || source.tw.term.name
			entries.push({ id, label: source.tw.term.name || id, section: source.section, source })
			continue
		}
		const observed = new Set<string>()
		for (const sample of Object.values<any>(response.samples)) {
			const entry = sample[source.queryId]
			if (entry?.key !== undefined && entry?.key !== null) observed.add(String(entry.key))
		}
		const bins = response.refs?.byTermId?.[source.queryId]?.bins || []
		const orderedKeys = bins.map(bin => String(bin.name || bin.label)).filter(key => observed.has(key))
		for (const key of observed) if (!orderedKeys.includes(key)) orderedKeys.push(key)
		for (const key of orderedKeys) {
			entries.push({
				id: key,
				label: source.tw.term.values?.[key]?.label || key,
				section: source.section,
				source,
				key
			})
		}
	}
	return entries
}

function makeEntryLookup(entries: ResolvedAxisEntry[]) {
	const lookup = new Map<string, number>()
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i]
		lookup.set(`${entry.source.queryId}\0${entry.key ?? ''}`, i)
	}
	return lookup
}

function resolveSampleEntryIndexes(sample: any, sources: AxisSource[], lookup: Map<string, number>) {
	const indexes: number[] = []
	for (const source of sources) {
		const annotation = sample[source.queryId]
		if (!annotation) continue
		const index = lookup.get(`${source.queryId}\0${source.expand ? String(annotation.key) : ''}`)
		if (index !== undefined) indexes.push(index)
	}
	return indexes
}

function makeAxisLayout(entries: ResolvedAxisEntry[], axis: 'row' | 'column') {
	const bySection = new Map<string, { id: string; label: string }[]>()
	let longestLabel = ''
	for (const entry of entries) {
		if (!bySection.has(entry.section)) bySection.set(entry.section, [])
		bySection.get(entry.section)!.push({ id: entry.id, label: entry.label })
		if (entry.label.length > longestLabel.length) longestLabel = entry.label
	}
	return {
		sections: [...bySection].map(([id, terms]) => ({ id, terms })),
		[axis == 'row' ? 'rowCount' : 'colCount']: entries.length,
		longestLabel
	} as any
}

function getScale(min: number, max: number) {
	if (min === Infinity) throw new Error('No valid aggregate values found in getData response')
	if (min === max) throw new Error(`All aggregate values are the same: ${min}. Cannot use identical data for scaling.`)
	return { min, max }
}

function makeRows(q: AggregateMatrixDataRequest) {
	const rows: RowData[] = []
	const sections: AxisSection[] = []
	let longestLabel = ''
	for (const section in q.rows) {
		const terms = q.rows[section].map(tw => {
			const id = tw.term?.['gene'] || tw.term.id
			if (!id) throw new Error(`Row term has no identifier`)
			const label = tw.term.name || id
			if (label.length > longestLabel.length) longestLabel = label
			const row = { id, label, section, tw, queryId: `agg_row_${rows.length}` }
			rows.push(row)
			return { id, label }
		})
		sections.push({ id: section, terms })
	}
	if (!rows.length) throw new Error('No aggregate matrix rows found')
	return { rows, sections, longestLabel }
}

async function getPseudobulkData(
	tw: any,
	genes: string[],
	method: string,
	q: AggregateMatrixDataRequest,
	ds: any
): Promise<ProcessedData> {
	const term = {
		...tw,
		term: {
			...tw.term,
			category: tw.term.category || tw.term.id,
			dataTypeDetails: { genes, method }
		}
	}
	const response = await queryData([term], q, ds)
	return aggregateNumericValues(response, genes)
}

async function getSampleBasedData(
	columnTw: any,
	rows: RowData[],
	methods: string[],
	q: AggregateMatrixDataRequest,
	ds: any
) {
	const rowTerms = rows.map(row => makeSampleTerm(row.tw, row.queryId))
	const columnId = 'agg_column'
	const columnTerm = makeSampleTerm(columnTw, columnId)
	const response = await queryData([...rowTerms, columnTerm], q, ds)
	const valuesByQueryId = calculateSampleBasedMethods(
		methods,
		response.samples,
		rows.map(row => row.queryId),
		columnId
	)
	const byMethod = new Map<string, ValueByRow>()
	for (const [method, values] of valuesByQueryId) {
		const valuesByRow: ValueByRow = {}
		for (const row of rows) valuesByRow[row.id] = values[row.queryId]
		byMethod.set(method, valuesByRow)
	}
	return byMethod
}

/** Dictionary numeric terms define binned cohorts; non-dictionary numeric terms remain unexpanded features. */
function makeSampleTerm(tw: any, id: string) {
	const isNumeric = isNumericTerm(tw.term)
	const isDictionaryNumeric = isNumeric && isDictionaryType(tw.term.type)
	return {
		...tw,
		$id: id,
		term: { ...tw.term },
		q: isDictionaryNumeric
			? { ...tw.term.bins?.default, ...tw.q, mode: 'discrete' }
			: isNumeric
				? { ...tw.q, mode: 'continuous' }
				: { ...tw.q }
	}
}

async function queryData(terms: any[], q: AggregateMatrixDataRequest, ds: any): Promise<ValidGetDataResponse> {
	const response = await getData({ terms, filter: q.filter, filter0: q.filter0 }, ds, false)
	if ('error' in response) throw new Error(response.error)
	return response
}

function aggregateNumericValues(data: ValidGetDataResponse, ids: string[]): ProcessedData {
	const idSet = new Set(ids)
	const sums: Record<string, number> = {}
	const counts: Record<string, number> = {}
	for (const sample of Object.values(data.samples)) {
		for (const [id, entry] of Object.entries(sample)) {
			if (!idSet.has(id) || !entry || typeof entry != 'object') continue
			const value = (entry as { value?: unknown }).value
			if (typeof value != 'number' || !Number.isFinite(value)) continue
			sums[id] = (sums[id] || 0) + value
			counts[id] = (counts[id] || 0) + 1
		}
	}
	const values: ValueByRow = {}
	for (const id of ids) values[id] = counts[id] ? sums[id] / counts[id] : null
	return summarizeValues(values, ids)
}

function summarizeValues(values: ValueByRow, rowIds: string[]): ProcessedData {
	let min = Infinity
	let max = -Infinity
	for (const id of rowIds) {
		const value = values[id]
		if (value === null || !Number.isFinite(value)) continue
		min = Math.min(min, value)
		max = Math.max(max, value)
	}
	if (min === Infinity) throw new Error('No valid aggregate values found in getData response')
	if (min === max) throw new Error(`All aggregate values are the same: ${min}. Cannot use identical data for scaling.`)
	return { values, min, max }
}
