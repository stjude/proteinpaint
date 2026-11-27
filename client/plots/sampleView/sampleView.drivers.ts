import { renderTable, escapeHtml } from '#dom'
import { dtsnvindel, dtfusionrna, dtsv, dtitd, dtcnv, dt2label, mclass } from '#shared/common.js'
import type { DriverTag, DriverRankInfo, DriverKbSource } from '#types'

/*********************************************************************
 * sampleView driver alterations
 *
 * The driver events of a sample, from the termdb/singleSampleMutation response of a dataset that ranks them by its
 * driver knowledge base (termdbConfig.queries.singleSampleMutation.driverRank): each driver event has .driver, and
 * the driver events are first in mlst[], ranked by the server.
 *
 * A view of the tags must credit the sources of the rules (the Cancer Hotspots data are under the ODbL), so the face
 * and the table both show driverRank.sources.
 *********************************************************************/

/** a row of the driver table: a driver event, or the same alteration seen as several events, e.g. an sv by both breakpoints */
export type DriverRow = {
	label: string
	type: string
	tier: 1 | 2
	evidence: string
	sources: string[]
	/** the variant allele fraction of the event, 0-1, of the first of its vafs[] with reads, which a dataset lists
	first, e.g. tumor DNA */
	vaf?: number
	/** the id of that vafs[] entry, e.g. tumor_DNA_WGS */
	vafId?: string
	origin?: 'somatic' | 'germline'
	/** the number of events of the alteration */
	count: number
}

/** a singleSampleMutation response with driverRank */
export type DriverData = { mlst: any[]; driverRank?: DriverRankInfo }

/** rows on the face of the tile */
const FACE_ROWS = 5

const TIER_COLOR = { 1: '#b91c1c', 2: '#d97706' }
const TIER_TITLE = { 1: 'Tier 1: a known driver alteration', 2: 'Tier 2: a likely driver' }

const CNV_LABEL = { amp: 'amplification', del: 'deletion', deepDel: 'homozygous deletion' }

/** the evidence of the best rule that matched, by its kind */
const REASON = {
	snv: 'Known residue change',
	fs: 'Known frameshift',
	inframe: 'Known in-frame indel',
	exon: 'Known exon mutation',
	gene: 'Gene-level evidence',
	fusion: 'Known fusion',
	sv: 'Known rearrangement',
	itd: 'Known tandem duplication',
	amp: 'Focal amplification',
	del: 'Deletion',
	deepDel: 'Homozygous deletion',
	enhancer: 'Gain of a known enhancer'
}

/** the rows of the driver events, in the server's order, one per alteration */
export function getDriverRows(data: DriverData): DriverRow[] {
	const names = new Map((data.driverRank?.sources || []).map(s => [s.id, s.label || s.id]))
	const rows: DriverRow[] = []
	const byKey = new Map<string, DriverRow>()
	for (const m of data.mlst || []) {
		const tag: DriverTag | undefined = m?.driver
		if (!tag) continue
		const label = getEventLabel(m, tag)
		const key = label + '\t' + tag.tier
		const seen = byKey.get(key)
		if (seen) {
			seen.count++
			continue
		}
		const row: DriverRow = {
			label,
			type: getEventType(m),
			tier: tag.tier,
			evidence: getEvidence(tag),
			sources: tag.sources.map(id => names.get(id) || id),
			count: 1
		}
		const vaf = getVaf(m)
		if (vaf) {
			row.vaf = vaf.vaf
			if (vaf.id) row.vafId = vaf.id
		}
		const origin = m.origin ?? m.vorigin
		if (typeof origin == 'string' && origin) row.origin = origin.toLowerCase() == 'germline' ? 'germline' : 'somatic'
		byKey.set(key, row)
		rows.push(row)
	}
	return rows
}

/** the face of the tile: the top driver events, with the sources of their rules */
export function renderDriverFace(face: any, data: DriverData) {
	const rows = getDriverRows(data)
	const div = face.append('div').attr('data-testid', 'sjpp-sampleview-drivers-face').style('padding', '6px 4px 0')
	if (!rows.length) {
		div.append('div').style('color', '#6b7280').text('No known driver alterations recognized')
		return
	}
	for (const row of rows.slice(0, FACE_ROWS)) {
		const line = div
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'baseline')
			.style('gap', '6px')
			.style('margin-bottom', '4px')
			.style('white-space', 'nowrap')
			.style('overflow', 'hidden')
			.style('text-overflow', 'ellipsis')
		renderTierBadge(line, row.tier)
		line.append('span').style('font-weight', 500).text(row.label)
	}
	if (rows.length > FACE_ROWS) {
		div
			.append('div')
			.style('color', '#6b7280')
			.text(`+${rows.length - FACE_ROWS} more`)
	}
	renderHypermutated(div, data.driverRank)
	renderAttribution(div, data.driverRank?.sources || [], true)
}

/** the expanded tile: a table of all the driver events */
export function renderDriverTable(holder: any, data: DriverData) {
	const rows = getDriverRows(data)
	const div = holder.append('div').attr('data-testid', 'sjpp-sampleview-drivers-table').style('padding', '5px')
	renderHypermutated(div, data.driverRank)
	if (!rows.length) {
		div
			.append('div')
			.style('color', '#6b7280')
			.text('No known driver alterations were recognized among the events of this sample.')
		return
	}
	const hasVaf = rows.some(r => r.vaf != undefined)
	// with several VAF fields in the sample, e.g. of tumor DNA and RNA, a value names its field
	const labelVafId = getVafIds(data.mlst).size > 1
	// the origin column only tells apart a germline driver; a column of all somatic says nothing
	const hasOrigin = rows.some(r => r.origin == 'germline')
	const columns: any[] = [
		{ label: 'Alteration' },
		{ label: 'Type' },
		{ label: 'Tier', tooltip: `${TIER_TITLE[1]}. ${TIER_TITLE[2]}.` },
		{ label: 'Evidence' },
		{ label: 'Sources' }
	]
	if (hasVaf)
		columns.push({
			label: 'VAF',
			align: 'right',
			tooltip: 'Variant allele fraction, of the first VAF field of the event with reads'
		})
	if (hasOrigin) columns.push({ label: 'Origin' })
	const tableRows = rows.map(r => {
		const cells: any[] = [
			{ value: r.count > 1 ? `${r.label} (${r.count} events)` : r.label },
			{ value: r.type },
			{ value: `Tier ${r.tier}`, color: TIER_COLOR[r.tier] },
			{ value: r.evidence },
			{ value: r.sources.join(', ') }
		]
		if (hasVaf) cells.push(getVafCell(r, labelVafId))
		if (hasOrigin) cells.push({ value: r.origin || '' })
		return cells
	})
	renderTable({
		div: div.append('div'),
		columns,
		rows: tableRows,
		showLines: false,
		striped: true,
		maxHeight: '60vh',
		dataTestId: 'sjpp-sampleview-drivers-rows'
	})
	renderAttribution(div, data.driverRank?.sources || [], false)
}

function getEventLabel(m: any, tag: DriverTag): string {
	const genes = tag.genes || []
	// a cnv or sv over an enhancer, e.g. 1.4 Mb from MYC, by the gene that it activates
	if (tag.reason == 'enhancer') {
		const locus = tag.locus ? ` (${tag.locus})` : ''
		return `${genes.join(', ')} enhancer${locus} ${m.dt == dtsv ? 'duplication' : 'gain'}`
	}
	switch (m.dt) {
		case dtsnvindel:
			return `${m.gene} ${m.mname}`
		case dtfusionrna:
			return `${m.geneA || genes[0] || '?'}::${m.geneB || genes[1] || '?'} fusion`
		case dtsv:
			return (genes.length ? genes.join('::') : `${m.chrA}:${m.posA}::${m.chrB}:${m.posB}`) + ' rearrangement'
		case dtitd:
			return `${genes.join(', ') || m.chr} ITD`
		case dtcnv:
			return `${genes.join(', ')} ${CNV_LABEL[tag.reason] || 'copy number change'}`
		default:
			return genes.join(', ') || String(dt2label[m.dt] || m.dt)
	}
}

function getEventType(m: any): string {
	if (m.dt == dtsnvindel) {
		const label = mclass[m.class]?.label
		// e.g. MISSENSE as Missense; a splice event of some datasets has class false
		if (label) return label.charAt(0) + label.slice(1).toLowerCase()
		return typeof m.mname == 'string' && m.mname.endsWith('_splice') ? 'Splice' : dt2label[dtsnvindel]
	}
	return dt2label[m.dt] || String(m.dt)
}

function getEvidence(tag: DriverTag): string {
	// an snv rule of Cancer Hotspots is a recurrently mutated residue
	if (tag.reason == 'snv' && tag.ruleIds[0]?.startsWith('hotspots:')) return 'Hotspot'
	if (tag.reason == 'inframe' && tag.ruleIds[0]?.startsWith('hotspots:')) return 'In-frame indel hotspot'
	return REASON[tag.reason] || tag.reason
}

/** the VAF of the first of the vafs[] of an event with reads; a dataset lists the primary one first, e.g. tumor DNA
before tumor RNA and germline DNA */
function getVaf(m: any): { vaf: number; id?: string } | undefined {
	for (const v of Array.isArray(m.vafs) ? m.vafs : []) {
		const alt = Number(v?.altCount)
		const ref = Number(v?.refCount)
		if (!(alt >= 0 && ref >= 0 && alt + ref > 0)) continue
		return { vaf: alt / (alt + ref), id: typeof v.id == 'string' && v.id ? v.id : undefined }
	}
}

/** the ids of the VAF fields of the events of a sample */
function getVafIds(mlst: any[]): Set<string> {
	const ids = new Set<string>()
	for (const m of mlst || []) {
		for (const v of Array.isArray(m?.vafs) ? m.vafs : []) if (typeof v?.id == 'string' && v.id) ids.add(v.id)
	}
	return ids
}

function getVafCell(r: DriverRow, labelVafId: boolean) {
	if (r.vaf == undefined) return { value: '' }
	const pct = `${Math.round(r.vaf * 100)}%`
	if (!labelVafId || !r.vafId) return { value: pct }
	return {
		html:
			`${pct} <span data-testid="sjpp-sampleview-drivers-vafid" style="font-size:0.75em;color:#6b7280">` +
			`${escapeHtml(r.vafId)}</span>`
	}
}

function renderTierBadge(holder: any, tier: 1 | 2) {
	holder
		.append('span')
		.attr('title', TIER_TITLE[tier])
		.style('flex', 'none')
		.style('font-size', '0.75em')
		.style('font-weight', 600)
		.style('color', 'white')
		.style('background', TIER_COLOR[tier])
		.style('border-radius', '3px')
		.style('padding', '0 4px')
		.text(`T${tier}`)
}

function renderHypermutated(holder: any, info?: DriverRankInfo) {
	const h = info?.hypermutated
	if (!h) return
	holder
		.append('div')
		.attr('data-testid', 'sjpp-sampleview-drivers-hypermutated')
		.style('color', '#92400e')
		.style('margin', '4px 0')
		.text(
			`Hypermutated sample (${h.snvindelCount} SNV/indels, above ${h.threshold}): ` +
				'tier 2 evidence of SNV/indels is not used.'
		)
}

/** credits the sources of the rules that tagged the events: their names on a face, which a click expands, and
 * links to them and their licenses in the table */
function renderAttribution(holder: any, sources: DriverKbSource[], compact: boolean) {
	if (!sources.length) return
	const div = holder
		.append('div')
		.attr('data-testid', 'sjpp-sampleview-drivers-sources')
		.style('color', '#6b7280')
		.style('font-size', compact ? '0.75em' : '0.85em')
		.style('margin-top', '6px')
	if (compact) {
		div.text('Rules: ' + sources.map(s => s.label).join(', '))
		return
	}
	div.append('span').text('Driver rules from ')
	sources.forEach((s, i) => {
		if (i) div.append('span').text(', ')
		appendLink(div, s.label, s.url)
		if (!s.license) return
		div.append('span').text(' (')
		appendLink(div, s.license, s.licenseUrl)
		div.append('span').text(')')
	})
}

function appendLink(holder: any, text: string, url?: string) {
	if (url) holder.append('a').attr('href', url).attr('target', '_blank').text(text)
	else holder.append('span').text(text)
}
