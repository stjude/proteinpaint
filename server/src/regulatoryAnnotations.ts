import path from 'path'
import { get_lines_bigfile } from './utils.js'
import serverconfig from './serverconfig.js'
import type { Genome } from '#types'

/**
 * Annotation format expected by the GPDM Python analysis script.
 * Must match the DmrAnnotation type in shared/types/src/routes/termdb.dmr.ts
 */
type GpdmAnnotation = {
	name: string
	start: number
	end: number
	base_methylation?: number
	length_scale_bp?: number
}

/**
 * ENCODE cCRE classification strings mapped to GPDM annotation type keywords.
 * The GPDM Python code does case-insensitive substring matching on the name
 * to assign biologically-informed priors (see core.py DEFAULT_BASE_METHYLATION).
 *
 * ENCODE cCRE BED format (V4):
 *   col0: chrom
 *   col1: start
 *   col2: end
 *   col3: accession (e.g. EH38E1234567)
 *   col4: UCSC label (e.g. prom, enhP, enhD, CTCF-only, K4m3)
 *   col5: classification description
 *
 * ENCODE V3 format:
 *   col0-2: chrom, start, end
 *   col3: accession
 *   col4: description (PLS, pELS, dELS, CTCF-only, DNase-H3K4me3)
 *
 * We support both by checking the classification column for known keywords.
 */
const CCRE_TYPE_MAP: Record<string, string> = {
	// V4 UCSC labels
	prom: 'Promoter',
	enhp: 'Enhancer',
	enhd: 'Enhancer',
	'ctcf-only': 'CTCF',
	'ctcf-bound': 'CTCF',
	k4m3: 'Promoter',
	// V3 classification labels
	pls: 'Promoter', // Promoter-like signature
	pels: 'Enhancer', // Proximal enhancer-like signature
	dels: 'Enhancer', // Distal enhancer-like signature
	'dnase-h3k4me3': 'Promoter'
}

/**
 * Map an ENCODE cCRE classification string to a GPDM annotation type keyword.
 * Returns the mapped type or null if unrecognized.
 */
function mapCcreType(classification: string): string | null {
	const lower = classification.toLowerCase().trim()
	for (const [key, type] of Object.entries(CCRE_TYPE_MAP)) {
		if (lower.includes(key)) return type
	}
	return null
}

/**
 * Query regulatory annotation BED files for a genomic region and return
 * annotations formatted for the GPDM analysis pipeline.
 *
 * Queries two optional tabix-indexed BED files configured in the genome:
 * 1. cpgIsland — UCSC CpG Island track (4-column BED: chrom, start, end, name)
 * 2. encodeCCRE — ENCODE cCREs (5+ column BED with classification in col4/col5)
 *
 * Annotations are named with a type keyword prefix (e.g. "CGI_chr8_127736000")
 * so the Python code's substring matching assigns the correct biological priors.
 *
 * @param genome - The genome object with optional regulatoryAnnotations config
 * @param chr - Chromosome name (e.g. "chr8")
 * @param start - Region start coordinate
 * @param stop - Region end coordinate
 * @returns Array of annotations ready to pass to gpdm_analysis.py
 */
export async function getRegulatoryAnnotations(
	genome: Genome,
	chr: string,
	start: number,
	stop: number
): Promise<GpdmAnnotation[]> {
	const annotations: GpdmAnnotation[] = []
	const regAnno = genome.regulatoryAnnotations
	if (!regAnno) return annotations

	const queries: Promise<void>[] = []

	if (regAnno.cpgIsland) {
		queries.push(queryCpgIslands(regAnno.cpgIsland, chr, start, stop, annotations))
	}
	if (regAnno.encodeCCRE) {
		queries.push(queryEncodeCCRE(regAnno.encodeCCRE, chr, start, stop, annotations))
	}

	await Promise.all(queries)
	return annotations
}

/**
 * Query UCSC CpG Island BED file for the region.
 *
 * UCSC cpgIslandExt format after conversion to simple BED:
 *   col0: chrom, col1: start, col2: end, col3: name
 *
 * Each island is named "CGI_<chr>_<start>" so the Python code matches "CGI"
 * and applies prior methylation=0.15, length_scale=200bp.
 *
 * Additionally derives Shore annotations (±2kb flanking each CGI, prior=0.40,
 * length_scale=300bp) since shores are not in any standard annotation file
 * but are biologically important transitional zones.
 */
async function queryCpgIslands(
	file: string,
	chr: string,
	start: number,
	stop: number,
	annotations: GpdmAnnotation[]
): Promise<void> {
	const fullPath = path.join(serverconfig.tpmasterdir, file)
	const region = `${chr}:${start}-${stop}`

	try {
		await get_lines_bigfile({
			args: [fullPath, region],
			callback: (line: string) => {
				const cols = line.split('\t')
				if (cols.length < 3) return
				const s = Math.max(parseInt(cols[1]), start)
				const e = Math.min(parseInt(cols[2]), stop)
				if (s >= e) return

				// CpG Island annotation
				annotations.push({
					name: `CGI_${chr}_${s}`,
					start: s,
					end: e
				})

				// Derive Shore annotations (2kb flanking regions)
				const shoreSize = 2000
				const shoreLeft = Math.max(start, s - shoreSize)
				if (shoreLeft < s) {
					annotations.push({
						name: `Shore_${chr}_${shoreLeft}`,
						start: shoreLeft,
						end: s
					})
				}
				const shoreRight = Math.min(stop, e + shoreSize)
				if (shoreRight > e) {
					annotations.push({
						name: `Shore_${chr}_${e}`,
						start: e,
						end: shoreRight
					})
				}
			}
		})
	} catch (_e) {
		// File may not exist; silently skip
	}
}

/**
 * Query ENCODE cCRE BED file for the region.
 *
 * Maps ENCODE classifications to GPDM annotation types:
 *   PLS/prom/K4m3  → "Promoter" (prior=0.20, length_scale=250bp)
 *   pELS/dELS/enhP/enhD → "Enhancer" (prior=0.45, length_scale=600bp)
 *   CTCF-only/CTCF-bound → "CTCF" (prior=0.55, length_scale=150bp)
 *
 * Unrecognized classifications are skipped since the Python code would
 * fall back to generic defaults which are no better than the density heuristic.
 */
async function queryEncodeCCRE(
	file: string,
	chr: string,
	start: number,
	stop: number,
	annotations: GpdmAnnotation[]
): Promise<void> {
	const fullPath = path.join(serverconfig.tpmasterdir, file)
	const region = `${chr}:${start}-${stop}`

	try {
		await get_lines_bigfile({
			args: [fullPath, region],
			callback: (line: string) => {
				const cols = line.split('\t')
				if (cols.length < 5) return
				const s = Math.max(parseInt(cols[1]), start)
				const e = Math.min(parseInt(cols[2]), stop)
				if (s >= e) return

				// Classification may be in col4 (V3: 5 cols) or col5 (V4: 6+ cols).
				// V4 entries can be comma-separated (e.g. "dELS,CTCF-bound");
				// use the first recognized type.
				const classificationCol = cols.length >= 6 ? cols[5] : cols[4]
				let annType: string | null = null
				for (const part of classificationCol.split(',')) {
					annType = mapCcreType(part)
					if (annType) break
				}
				if (!annType) return

				annotations.push({
					name: `${annType}_${chr}_${s}`,
					start: s,
					end: e
				})
			}
		})
	} catch (_e) {
		// File may not exist; silently skip
	}
}
