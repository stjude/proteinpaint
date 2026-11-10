// Pure conversion of the server's OmnisearchResult into the rows shown in the results popup.
// No DOM, no app: everything here is unit-testable (see test/rows.unit.spec.ts).
import type { GeneDataTypeAvailability, OmnisearchResult } from '#types'
import type { Coord, CoordRow, DictRow, GeneRow, ResultRow, SampleRow } from './types.ts'

export function formatCoord(coord: Coord): string {
	return `${coord.chr}:${coord.start.toLocaleString()}-${coord.stop.toLocaleString()}`
}

/** A gene is listed only if at least one action (expression / variant / genome browser / methylation) can
 * be offered for it. */
export function hasAnyGeneAction(dt: Partial<GeneDataTypeAvailability> | undefined | null): boolean {
	if (!dt) return false
	return Boolean(dt.geneExpression || dt.snvindel || dt.cnv || dt.svfusion || dt.genomeBrowser || dt.dnaMethylation)
}

/** One row per gene. Genes whose name already appears among the dictionary results are skipped (the
 * dictionary row is the more specific match), as are duplicates and genes with no available action. */
export function buildGeneRows(genes: OmnisearchResult['genes'] | undefined, dictNames: Set<string>): GeneRow[] {
	const rows = new Map<string, GeneRow>()
	for (const g of Array.isArray(genes) ? genes : []) {
		const gene = g?.gene
		if (!gene || dictNames.has(gene.toUpperCase())) continue
		if (!hasAnyGeneAction(g.dataTypes)) continue
		rows.set(gene.toUpperCase(), { kind: 'gene', name: gene, gene, dataTypes: g.dataTypes, coord: g.coord || null })
	}
	return [...rows.values()]
}

export function buildDictRows(terms: OmnisearchResult['dictionaryTerms'] | undefined): DictRow[] {
	return (Array.isArray(terms) ? terms : []).map((t: any) => ({
		kind: 'dict',
		name: t.name,
		term: t,
		selectable: Boolean(t.type),
		ancestors: (t.__ancestorNames || []).join(' > ')
	}))
}

/** The server only sends samples when the dataset allows displaying sample ids, so no permission check is
 * repeated here: an empty list means no match or a dataset that does not permit it. */
export function buildSampleRows(samples: OmnisearchResult['samples'] | undefined): SampleRow[] {
	return (Array.isArray(samples) ? samples : [])
		.filter(s => s?.name)
		.map(s => ({
			kind: 'sample',
			name: s.name,
			sampleId: s.id,
			singleCell: s.singleCell,
			facetTracks: s.assays,
			wsimages: s.wsimages
		}))
}

export function buildCoordRows(coord: Coord | null | undefined): CoordRow[] {
	return coord ? [{ kind: 'coord', name: formatCoord(coord), coord }] : []
}

/** Group the results under headings (a heading only for a non-empty group). When the server capped a type
 * (total > number returned) a note row is added at the bottom of that group. Group order is the display
 * order. */
export function buildResultRows(data: OmnisearchResult): ResultRow[] {
	const dictRows = buildDictRows(data.dictionaryTerms)
	const dictNames = new Set(dictRows.map(r => r.name?.toUpperCase()))
	const geneRows = buildGeneRows(data.genes, dictNames)
	const sampleRows = buildSampleRows(data.samples)
	const coordRows = buildCoordRows(data.coord)
	const totals: Partial<NonNullable<OmnisearchResult['totals']>> = data.totals || {}

	const groups: {
		key: string
		heading: string
		noun: string
		items: ResultRow[]
		returned: number
		total?: number
	}[] = [
		{
			key: 'dictionary',
			heading: 'Dictionary',
			noun: 'dictionary variable',
			items: dictRows,
			returned: dictRows.length,
			total: totals.dictionaryTerms
		},
		{
			key: 'genes',
			heading: 'Genes',
			noun: 'gene',
			items: geneRows,
			// compare against what the server returned, not what survived client-side filtering
			returned: Array.isArray(data.genes) ? data.genes.length : 0,
			total: totals.genes
		},
		{
			key: 'samples',
			heading: 'Samples',
			noun: 'sample',
			items: sampleRows,
			returned: sampleRows.length,
			total: totals.samples
		},
		{ key: 'coord', heading: 'Genomic region', noun: '', items: coordRows, returned: coordRows.length }
	]

	const rows: ResultRow[] = []
	for (const group of groups) {
		if (!group.items.length) continue
		rows.push({ kind: 'heading', name: group.heading })
		rows.push(...group.items)
		if (typeof group.total == 'number' && group.total > group.returned) {
			rows.push({
				kind: 'note',
				testid: `sjpp-mass-chat-note-${group.key}`,
				name: `Displaying ${group.items.length} out of a total of ${group.total} ${group.noun} matches`
			})
		}
	}
	return rows
}
