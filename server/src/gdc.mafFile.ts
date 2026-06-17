import * as common from '#shared/common.js'
import zlib from 'zlib'

/** Decode a fetched GDC data-file body to text, transparently gunzipping when the gzip magic (0x1f 0x8b)
 * is present. GDC serves CNV segment files as plain TSV but MAF files as .maf.gz (application/gzip, not
 * Content-Encoding), so the body must be decompressed by us. Handles either form. */
export function gunzipIfNeeded(buf: Buffer): string {
	const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b
	return (isGzip ? zlib.gunzipSync(buf) : buf).toString('utf8')
}

/** A parsed GDC MAF row reduced to the fields GRIN2 needs. `class` is the VEP/SO consequence
 * (One_Consequence, e.g. 'missense_variant') used for consequence filtering; totalDepth/altCount come
 * from the tumor columns and drive the GDC depth/alt-count cutoffs. */
export type GdcMafEntry = {
	dt: number
	chr: string
	pos: number
	class: string
	totalDepth: number
	altCount: number
}

/* columns we read from the GDC aliquot-merged-masked MAF (by header name, so column order is irrelevant) */
const NEEDED = ['Chromosome', 'Start_Position', 'One_Consequence', 't_depth', 't_alt_count'] as const

/**
 * Parse the text content of a GDC MAF file into the minimal mlst entries GRIN2 needs. Pure (no network)
 * so it is reusable and unit-testable against fixtures; the fetch lives in mds3.gdc.js loadMafFile().
 * GDC MAF files have leading '#' comment lines followed by a tab-delimited header row (Hugo_Symbol ...).
 */
export function parseGdcMafFile(content: string): GdcMafEntry[] {
	const lines = content.split('\n')
	let headerIdx = -1
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith('#')) continue
		if (lines[i].startsWith('Hugo_Symbol\t')) {
			headerIdx = i
			break
		}
	}
	if (headerIdx == -1) throw 'GDC MAF: header row (Hugo_Symbol...) not found'

	const header = lines[headerIdx].split('\t')
	const col: Record<string, number> = {}
	for (const name of NEEDED) {
		const idx = header.indexOf(name)
		if (idx == -1) throw `GDC MAF: column "${name}" not found`
		col[name] = idx
	}

	const mlst: GdcMafEntry[] = []
	for (let i = headerIdx + 1; i < lines.length; i++) {
		const line = lines[i]
		if (!line || line.startsWith('#')) continue
		const l = line.split('\t')
		const pos = Number(l[col['Start_Position']])
		const totalDepth = Number(l[col['t_depth']])
		const altCount = Number(l[col['t_alt_count']])
		if (!Number.isInteger(pos)) continue
		mlst.push({
			dt: common.dtsnvindel,
			chr: l[col['Chromosome']],
			pos,
			class: l[col['One_Consequence']] || '',
			totalDepth: Number.isFinite(totalDepth) ? totalDepth : 0,
			altCount: Number.isFinite(altCount) ? altCount : 0
		})
	}
	return mlst
}
