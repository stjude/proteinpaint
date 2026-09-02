import type {
	AggMatrixDot,
	AxisSection,
	TermdbAggregateMatrixRequest,
	ValidAggMatrixResponse,
	ValidGetDataResponse
} from '#types'
import { PSEUDOBULK } from '#types'
import { getData } from '../termdb.matrix.js'

type ValueByGene = Record<string, number | null>
type ColData = { column: string; termId: string; colorTmp: ValueByGene; sizeTmp: ValueByGene }
type ProcessedData = { values: ValueByGene; min: number; max: number }
export type AggregateMatrixDataRequest = TermdbAggregateMatrixRequest &
	Required<Pick<TermdbAggregateMatrixRequest, 'rows' | 'gradientMethod' | 'sizeMethod'>>

export async function getAggMatrixData(q: AggregateMatrixDataRequest, ds: any): Promise<ValidAggMatrixResponse> {
	const queryGenes = new Set<string>()
	const rowSections: AxisSection[] = []
	let rowCount = 0
	let rowLongest = ''

	for (const section in q.rows) {
		const terms = q.rows[section].map(tw => {
			const gene = tw.term?.['gene']
			if (gene) queryGenes.add(gene)
			const rowId = gene || tw.term.id
			const label = tw.term.name || rowId
			if (label.length > rowLongest.length) rowLongest = label
			rowCount++
			return { id: rowId, label }
		})
		rowSections.push({ id: section, terms })
	}
	if (!queryGenes.size) throw new Error('No genes found in aggregate matrix rows')

	const genes = Array.from(queryGenes)
	const columns: ColData[] = []
	const colSections: AxisSection[] = []
	let colorMin = Infinity
	let colorMax = -Infinity
	let sizeMin = Infinity
	let sizeMax = -Infinity
	let colCount = 0
	let colLongest = ''

	/* Each category has its own HDF5 files. Process them sequentially so each batched-gene
	 * response can be collected before the next category is loaded. */
	for (const section in q.columns) {
		const sectionColumns = q.columns[section]
		const terms = sectionColumns.map(tw => {
			const label = tw.term.name || tw.term.id
			if (label.length > colLongest.length) colLongest = label
			colCount++
			return { id: tw.term.id, label }
		})
		colSections.push({ id: section, terms })

		for (const tw of sectionColumns) {
			const colorData = await getColumnData(tw, genes, q.gradientMethod, q, ds)
			const sizeData = await getColumnData(tw, genes, q.sizeMethod, q, ds)
			colorMin = Math.min(colorMin, colorData.min)
			colorMax = Math.max(colorMax, colorData.max)
			sizeMin = Math.min(sizeMin, sizeData.min)
			sizeMax = Math.max(sizeMax, sizeData.max)
			columns.push({
				column: section,
				termId: tw.term.id,
				colorTmp: colorData.values,
				sizeTmp: sizeData.values
			})
		}
	}

	const data: AggMatrixDot[][] = []
	for (const { terms, id: rowSection } of rowSections) {
		for (const { id: row } of terms) {
			data.push(
				columns.map(col => ({
					rowSection,
					row,
					colSection: col.column,
					column: col.termId,
					colorValue: col.colorTmp[row] ?? null,
					sizeValue: col.sizeTmp[row] ?? null
				}))
			)
		}
	}

	return {
		colorScale: { min: colorMin, max: colorMax },
		sizeScale: { min: sizeMin, max: sizeMax },
		data,
		axesLayout: {
			rows: { sections: rowSections, rowCount, longestLabel: rowLongest },
			columns: { sections: colSections, colCount, longestLabel: colLongest }
		}
	}
}

async function getColumnData(
	tw: any,
	genes: string[],
	method: AggregateMatrixDataRequest['gradientMethod'],
	q: AggregateMatrixDataRequest,
	ds: any
): Promise<ProcessedData> {
	const columnTerm = tw.term
	if (columnTerm.type !== PSEUDOBULK) {
		throw new Error(`Term type: ${columnTerm.type} not supported in aggregate matrix route.`)
	}
	const term = {
		...tw,
		term: {
			...columnTerm,
			category: columnTerm.category || columnTerm.id,
			dataTypeDetails: { genes, method }
		}
	}

	const response = await getData({ terms: [term], filter: q.filter, filter0: q.filter0 }, ds, false)
	if ('error' in response) throw new Error(response.error)
	return processGetDataResponse(response, genes)
}

/** Aggregate every queried gene in one sparse pass over a validated getData response. */
function processGetDataResponse(data: ValidGetDataResponse, genes: string[]): ProcessedData {
	const geneSet = new Set(genes)
	const sums: Record<string, number> = {}
	const counts: Record<string, number> = {}

	for (const sample of Object.values(data.samples)) {
		for (const [gene, entry] of Object.entries(sample)) {
			if (!geneSet.has(gene) || !entry || typeof entry !== 'object') continue
			const value = (entry as { value?: unknown }).value
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			sums[gene] = (sums[gene] || 0) + value
			counts[gene] = (counts[gene] || 0) + 1
		}
	}

	const values: ValueByGene = {}
	let min = Infinity
	let max = -Infinity
	for (const gene of genes) {
		const count = counts[gene] || 0
		const aggregate = count ? sums[gene] / count : null
		values[gene] = aggregate
		if (aggregate !== null) {
			min = Math.min(min, aggregate)
			max = Math.max(max, aggregate)
		}
	}

	if (min === Infinity || max === -Infinity) throw new Error('No valid aggregate values found in getData response')
	if (min === max) throw new Error(`All aggregate values are the same: ${min}. Cannot use identical data for scaling.`)
	return { values, min, max }
}
