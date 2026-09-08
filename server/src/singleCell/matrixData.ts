import { getBin } from '#shared/terms.js'
import { get_bin_label, compute_bins, assignBinColors } from '#shared/termdb.bins.js'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE } from '#types'

/* Annotates termdb.matrix.js samples{} with single cell term data.

Single cell data is unique. Cells, not samples, are displayed, so every single cell term resolves to
a list of cell-level values (see getSingleCellCellValues()) that becomes one row per cell:
- SINGLECELL_GENE_EXPRESSION: numeric, read from the expression store by sample and gene
- SINGLECELL_NUMERIC_VALUE and SINGLECELL_CELLTYPE: read from a plot column, numeric and string
  respectively. Both come from the same data.get() getter, which formats either column identically

At times cells are compared against cohort level terms in the termdb. The sampleId from the tsv file
is mapped to the primary key in the termdb to match the cohort level data to the cell data:
1. getSingleCellSampleEntry() and getSampleId4Cell() map a cell to a termdb sampleId and copy that
   sample's cohort level data onto the cell row
2. for meta analysis results, the "cell" is a pseudo-sample representing a group of cells.
   hydrateMetaResultCellRows() fills those rows from their mapped cohort sample row
*/

type CellValue = {
	cellId: string
	/** sampleIntId (termdb primary key) of the cohort sample this cell belongs to, when the getter
	 * supplies it. May arrive as a string; getSampleId4Cell() falls back to reading it as a sample
	 * name when it resolves to no sampleIntId */
	sampleId?: string | number
	value: number | string
}

/** term types whose cell values are numbers, and so are binned when q.mode is discrete */
const scNumericTypes = new Set<string>([SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE])

/** Returns one entry per cell with data for this term. Also used by termdb.getDefaultBins.js to
 * compute bins of a numeric single cell term.
 * @param q req.query
 * @param tw tw of a single cell term
 * @param ds Entire dataset configuration from the ds file
 */
export async function getSingleCellCellValues(q: any, tw: any, ds: any): Promise<CellValue[]> {
	const cells: CellValue[] = []

	if (tw.term.type == SINGLECELL_GENE_EXPRESSION) {
		if (!ds.queries?.singleCell?.geneExpression) throw new Error('not supported by dataset: singleCell.geneExpression')
		/* the expression store is keyed by cell id and holds no sample id; the cohort sample is
		recovered from data.metaIdMap in getSampleId4Cell(). this breaks if a ds ever ships the
		expression store without the plot files that map is built from */
		const cell2value = await ds.queries.singleCell.geneExpression.get(q, tw.term.sample, tw.term.gene)
		for (const cellId in cell2value) cells.push({ cellId, value: cell2value[cellId] })
		return cells
	}

	if (!ds.queries?.singleCell?.data) throw new Error('not supported by dataset: singleCell.data')
	const data = await ds.queries.singleCell.data.get({
		sample: tw.term.sample,
		plots: [tw.term.plot],
		colorBy: { [tw.term.plot]: tw.term.name }
	})
	const isNumeric = scNumericTypes.has(tw.term.type)
	for (const cell of data.plots[0].noExpCells) {
		// the getter returns every plot column as a string, under cell.category
		if (isNumeric && (cell.category == null || String(cell.category).trim() === '')) continue
		const value = isNumeric ? Number(cell.category) : cell.category
		if (isNumeric && !Number.isFinite(value)) continue
		cells.push({ cellId: cell.cellId, sampleId: cell.sampleId, value })
	}
	return cells
}

/** Adds one row per cell to samples{}, keyed by cell id.
 * @param q req.query
 * @param tw tw of a single cell term
 * @param samples termdb.matrix.js samples{}, mutated here
 * @param byTermId refs.byTermId{} of the response, to return computed bins
 */
export async function annotateSingleCellTerm(q: any, tw: any, samples: any, byTermId: any): Promise<void> {
	const ds = q.ds
	const cells = await getSingleCellCellValues(q, tw, ds)

	// the two ways a cell value is converted into a key: bins for numeric terms, custom groups for
	// cell type terms. neither applies when the term is continuous/ungrouped, and key is the value
	const bins = scNumericTypes.has(tw.term.type) && tw.q?.mode == 'discrete' ? getListOfBins(tw) : undefined
	if (bins) byTermId[tw.$id] = { bins }
	const groups = tw.term.type == SINGLECELL_CELLTYPE ? tw.q?.customset?.groups : undefined

	// a cohort level filter only applies to meta results, whose cells map to cohort samples
	let filteredSamples = new Set()
	if ((q.filter?.lst?.length || q.filter0) && tw.term.sample?.isMetaResult) {
		filteredSamples = await ds.queries.singleCell.samples.getFilteredSingleCellSamples(q)
	}

	for (const cell of cells) {
		const cellId = cell.cellId
		if (!(cellId in samples)) {
			const entry = getSingleCellSampleEntry(samples, ds, tw, cell, filteredSamples)
			if (!entry) continue // cell is filtered out based on cohort level term filter
			samples[cellId] = entry
		}
		let value = cell.value
		let key = value
		if (bins) {
			key = get_bin_label(bins[getBin(bins, value as number)], tw.q)
		} else if (groups) {
			const group = groups.find(g => Object.values(g.values).find((v: any) => v.key == value))
			if (group) value = key = group.name
		}
		samples[cellId][tw.$id] = { value, key }
	}
}

/** Bins of a numeric single cell term in discrete mode. Same two cases as findListOfBins() in
 * termdb.matrix.js, minus its on-the-fly bin computation: term.bins is always present here, seeded
 * by termdb.getDefaultBins.js. */
function getListOfBins(tw: any): any[] {
	if (tw.q.type == 'regular-bin') {
		const { min, max } = tw.term.bins
		return compute_bins(tw.q, () => ({ min, max }))
	}
	if (!tw.q.lst) throw 'q.type is not regular-bin and q.lst[] is missing'
	// custom bins are used as given and never go through compute_bins(), so they must be colored
	// here -- and on a copy, so the request's own q.lst[] is not mutated
	return assignBinColors(tw.q.lst.map((bin: any) => ({ ...bin })))
}

/****** The next three functions are helpers for getData(). Together, they format the results from 
 * the getters into the ValidGetDataResponse obj created by getData().  
 * 
 * The samples{} row for a cell: the cohort sample's data, when the cell maps to one. */
function getSingleCellSampleEntry(samples: any, ds: any, tw: any, _cell: CellValue, filteredSamples: Set<any>) {
	const sampleId = getSampleId4Cell(ds, tw, _cell, filteredSamples)
	if (!sampleId) {
		if (!tw.term.sample?.isMetaResult) return { sample: _cell.cellId }
		else return null
	}
	const sample = samples[sampleId]
	const cell = sample ? structuredClone(sample) : ({} as any)
	cell.sample = _cell.cellId
	cell.sampleId = sampleId
	return cell
}

//See documentation above
function getSampleId4Cell(ds: any, tw: any, cell: CellValue, filteredSamples: Set<any>) {
	if (!tw.term.sample?.isMetaResult) return
	/** Note: Do not use .eID. Only for GDC in separate pathway */
	const metaResultId = tw.term.sample.sID
	const metaIdMap = ds.queries?.singleCell?.data?.metaIdMap?.get?.(metaResultId)
	const sampleMappingCache = ds.queries?.singleCell?.samples?.sampleMappingCache
	let sampleName = metaIdMap?.get?.(cell.cellId)
	if (!sampleName && cell.sampleId != undefined) {
		sampleName = sampleMappingCache?.sampleIntId2Name?.get?.(cell.sampleId)
		if (!sampleName) {
			const numericSampleId = Number(cell.sampleId)
			if (Number.isFinite(numericSampleId)) {
				sampleName = sampleMappingCache?.sampleIntId2Name?.get?.(numericSampleId)
			}
		}
		if (!sampleName && typeof cell.sampleId == 'string') sampleName = cell.sampleId
	}
	if (!sampleName) return
	if (filteredSamples.size > 0 && !filteredSamples.has(sampleName)) return
	const sampleId =
		sampleMappingCache?.sampleName2IntId?.get?.(sampleName) ?? ds.cohort?.termdb?.q?.sampleName2id?.(sampleName)
	if (sampleId == undefined) {
		throw new Error(`single cell meta result cannot map sample name = ${sampleName} to sample id`)
	}
	return String(sampleId)
}

//See documentation above
export function hydrateMetaResultCellRows(samples: any): void {
	for (const _sampleId in samples) {
		const row = samples[_sampleId]
		const sampleId = row?.sampleId
		if (!sampleId) continue
		const parentRow = samples[sampleId]
		if (!parentRow) continue
		for (const [termId, value] of Object.entries(parentRow)) {
			if (termId == 'sample' || termId == 'sampleId') continue
			if (!(termId in row)) row[termId] = value
		}
	}
}
