import type {
	AggMatrixDot,
	AxisSection,
	TermdbAggregateMatrixRequest,
	ValidAggMatrixResponse,
	ValidGetDataResponse
} from '#types'
import { PSEUDOBULK } from '#types'
import { getData } from '../termdb.matrix.js'
import { calculateSampleBasedMethods } from './aggregateMethods.ts'

type ValueByRow = Record<string, number | null>
type RowData = { id: string; label: string; section: string; tw: any; queryId: string }
type ColData = { section: string; id: string; colorValues: ValueByRow; sizeValues: ValueByRow }
type ProcessedData = { values: ValueByRow; min: number; max: number }
export type AggregateMatrixDataRequest = TermdbAggregateMatrixRequest &
	Required<Pick<TermdbAggregateMatrixRequest, 'rows' | 'gradientMethod' | 'sizeMethod'>>

export async function getAggMatrixData(q: AggregateMatrixDataRequest, ds: any): Promise<ValidAggMatrixResponse> {
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
	const rowTerms = rows.map(row => ({ ...row.tw, $id: row.queryId, term: { ...row.tw.term } }))
	const columnId = 'agg_column'
	const columnTerm = { ...columnTw, $id: columnId, term: { ...columnTw.term } }
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
