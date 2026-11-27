/*
The row format of the driver knowledge base files in server/genome/driverKb/, see the README there.

parseKbText() reads one file and checks every row, as the intake scripts that write the files do, so that an
edit that breaks a row fails the server launch instead of silently dropping the rule.
*/

import type { DriverRuleKind } from '#types'

export const KB_FORMAT = 'driverKb/1'

export const KB_COLUMNS = [
	'id',
	'kind',
	'gene',
	'partner',
	'start',
	'end',
	'ref',
	'alt',
	'exon',
	'isoform',
	'region',
	'window',
	'tier',
	'label',
	'info'
] as const

export type KbKind = DriverRuleKind

/** the kind of change of an exon or gene rule, or of an enhancer rule (gain) */
export type KbChange = 'any' | 'missense' | 'trunc' | 'fs' | 'inframe' | 'del' | 'ins' | 'dup' | 'splice' | 'gain'

/** one rule of a kb file */
export type KbRow = {
	/** '<source>:<id in the source>', unique across the files of a kb */
	id: string
	/** the id of the source file, the prefix of id */
	source: string
	kind: KbKind
	/** gene symbol; for fusion and sv, the 5' gene, or the first gene or locus; for enhancer, the gene that the
	locus activates; '*' is any gene */
	gene: string
	/** fusion and sv: the 3' gene, or the second gene or locus; '*' is any gene; enhancer: the name of the
	locus, e.g. N-Me */
	partner: string
	/** protein residue of snv, fs and inframe */
	start: number | null
	/** last residue of a range, inclusive; null for a single residue */
	end: number | null
	/** reference amino acid at start: one letter, 'X' for a splice site, '*' for a stop codon */
	ref: string
	/** snv: the alt amino acids, '*' for nonsense and 'sp' for splice; empty for any change */
	alts: string[]
	/** exon and gene rules: the kind of change; enhancer: gain, a gain or amplification of the locus */
	change: KbChange | ''
	/** exon (and optionally itd): the first and last exon, 1-based */
	exon: [number, number] | null
	/** the isoform that exon is numbered on; '' is the default RefSeq isoform of the gene */
	isoform: string
	/** enhancer: the coordinates of the locus by genome build, the one exception to rules free of builds; null for
	another kind */
	regions: { [build: string]: { chr: string; start: number; stop: number } } | null
	/** sv: the bp around the gene and the partner within which a breakpoint counts; a locus of index.json, e.g. IGH,
	counts by the span of its genes, without the window */
	window: number
	tier: 1 | 2
	label: string
	/** provenance, not used for matching */
	info: string
}

export type KbFile = {
	meta: { [key: string]: string }
	rows: KbRow[]
}

const REQUIRED: { [kind in KbKind]: string[] } = {
	snv: ['gene', 'start', 'ref'],
	fs: ['gene', 'start'],
	inframe: ['gene', 'start'],
	exon: ['gene', 'exon', 'alt'],
	gene: ['gene', 'alt'],
	fusion: ['gene', 'partner'],
	sv: ['gene', 'partner'],
	itd: ['gene'],
	amp: ['gene'],
	del: ['gene'],
	deepDel: ['gene'],
	enhancer: ['gene', 'partner', 'alt', 'region']
}

const CHANGES = new Set<string>(['any', 'missense', 'trunc', 'fs', 'inframe', 'del', 'ins', 'dup', 'splice'])
const AMINO_ACIDS = new Set('ACDEFGHIKLMNPQRSTVWY'.split(''))
const SNV_REFS = new Set([...AMINO_ACIDS, 'X', '*'])
const SNV_ALTS = new Set([...AMINO_ACIDS, '*', 'sp'])
/** a region of the region cell, as in a genome browser: hg38=chr8:129167819-129168726 */
const REGION = /^(\w+)=(\w+):(\d+)-(\d+)$/

/** parses the text of a kb file, whose row ids must start with '<sourceId>:'; throws '<file>:<line>: <reason>' */
export function parseKbText(text: string, file: string, sourceId: string): KbFile {
	const meta: { [key: string]: string } = {}
	const rows: KbRow[] = []
	const ids = new Set<string>()
	let header = false
	const lines = text.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (!line.trim()) continue
		const where = `${file}:${i + 1}`
		if (!header && line.startsWith('#')) {
			const eq = line.indexOf('=')
			if (eq == -1) throw `${where}: metadata line is not #key=value`
			meta[line.slice(1, eq)] = line.slice(eq + 1)
			continue
		}
		if (!header) {
			if (line.split('\t').join(',') != KB_COLUMNS.join(',')) throw `${where}: header is not ${KB_COLUMNS.join(' ')}`
			header = true
			continue
		}
		const row = parseRow(line, where, sourceId)
		if (ids.has(row.id)) throw `${where}: duplicate id ${row.id}`
		ids.add(row.id)
		rows.push(row)
	}
	if (!header) throw `${file}: no header line`
	if (meta.format != KB_FORMAT) throw `${file}: #format is not ${KB_FORMAT}`
	for (const k of ['source', 'license']) {
		if (!meta[k]) throw `${file}: #${k} missing`
	}
	return { meta, rows }
}

function parseRow(line: string, where: string, sourceId: string): KbRow {
	const cells = line.split('\t')
	// an editor may strip the tabs of blank trailing cells
	if (cells.length > KB_COLUMNS.length) throw `${where}: more than ${KB_COLUMNS.length} cells`
	const c: { [col: string]: string } = {}
	KB_COLUMNS.forEach((col, i) => (c[col] = (cells[i] ?? '').trim()))

	if (!c.id) throw `${where}: id missing`
	if (!c.id.startsWith(sourceId + ':')) throw `${where}: id ${c.id} does not start with '${sourceId}:'`
	const kind = c.kind as KbKind
	if (!(kind in REQUIRED)) throw `${where}: unknown kind ${c.kind}`
	for (const col of REQUIRED[kind]) {
		if (!c[col]) throw `${where}: ${kind} requires ${col}`
	}
	if (c.tier != '1' && c.tier != '2') throw `${where}: tier must be 1 or 2`

	const start = positiveInt(c.start, 'start', where)
	const end = positiveInt(c.end, 'end', where)
	if (end != null && (start == null || end < start)) throw `${where}: end is before start`
	const window = positiveInt(c.window, 'window', where) ?? 0

	let alts: string[] = []
	let change: KbChange | '' = ''
	if (kind == 'snv') {
		if (!SNV_REFS.has(c.ref)) throw `${where}: invalid ref ${c.ref}`
		alts = c.alt ? c.alt.split(',') : []
		for (const a of alts) {
			if (!SNV_ALTS.has(a)) throw `${where}: invalid alt ${a}`
		}
	} else if (kind == 'exon' || kind == 'gene') {
		if (!CHANGES.has(c.alt)) throw `${where}: alt of ${kind} must be one of ${[...CHANGES].join(',')}`
		change = c.alt as KbChange
	} else if (kind == 'enhancer') {
		if (c.alt != 'gain') throw `${where}: alt of enhancer must be gain`
		change = 'gain'
	}

	if (c.region && kind != 'enhancer') throw `${where}: region is only for enhancer rows`
	const regions = c.region ? parseRegions(c.region, where) : null

	let exon: [number, number] | null = null
	if (c.exon) {
		const m = /^(\d+)(?:-(\d+))?$/.exec(c.exon)
		if (!m) throw `${where}: exon must be a number or a range like 2-3`
		exon = [Number(m[1]), Number(m[2] ?? m[1])]
		if (exon[0] < 1 || exon[1] < exon[0]) throw `${where}: invalid exon range ${c.exon}`
	}

	return {
		id: c.id,
		source: sourceId,
		kind,
		gene: c.gene,
		partner: c.partner,
		start,
		end,
		ref: c.ref,
		alts,
		change,
		exon,
		isoform: c.isoform,
		regions,
		window,
		tier: c.tier == '1' ? 1 : 2,
		label: c.label,
		info: c.info
	}
}

/** the regions of a region cell, comma-separated <build>=<chr>:<start>-<stop> */
function parseRegions(cell: string, where: string): NonNullable<KbRow['regions']> {
	const regions: NonNullable<KbRow['regions']> = {}
	for (const r of cell.split(',')) {
		const m = REGION.exec(r.trim())
		if (!m) throw `${where}: region must be <build>=<chr>:<start>-<stop>, comma-separated: ${r}`
		const [build, chr, start, stop] = [m[1], m[2], Number(m[3]), Number(m[4])]
		if (start < 1 || stop < start) throw `${where}: invalid region ${r}`
		if (regions[build]) throw `${where}: two regions of ${build}`
		regions[build] = { chr, start, stop }
	}
	return regions
}

function positiveInt(v: string, col: string, where: string): number | null {
	if (!v) return null
	if (!/^\d+$/.test(v) || Number(v) < 1) throw `${where}: ${col} must be a positive integer`
	return Number(v)
}
