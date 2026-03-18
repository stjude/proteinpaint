import path from 'path'
import { get_lines_bigfile } from './utils.js'
import serverconfig from './serverconfig.js'
import type { Genome } from '#types'
import type { GpdmAnnotation } from '#types'

/**
 * Maps the primary ENCODE cCRE classification (col5, first comma-delimited token)
 * to a GPDM annotation type. Our file (encodeCCRE.hg38.gz) is 6-column V4 format:
 *   col0: chrom, col1: start, col2: end, col3: DHS accession, col4: cCRE accession,
 *   col5: classification (e.g. "PLS", "pELS,CTCF-bound")
 * The 9 distinct classification values in the file all have a recognized primary type.
 */
const CCRE_TYPE_MAP: Record<string, string> = {
	PLS: 'Promoter',
	pELS: 'Enhancer',
	dELS: 'Enhancer',
	'CTCF-only': 'CTCF',
	'DNase-H3K4me3': 'Promoter'
}

/**
 * Query tabix-indexed CpG island and ENCODE cCRE BED files for a genomic region.
 * Annotation names are prefixed with the type keyword (e.g. "CGI_chr8_127736000",
 * "Promoter_chr8_127800000") so the Python code can match them to dataset-derived
 * priors from the priors file.
 */
export async function getRegulatoryAnnotations(
	genome: Genome,
	chr: string,
	start: number,
	stop: number,
	shoreSize = 2000
): Promise<GpdmAnnotation[]> {
	const annotations: GpdmAnnotation[] = []
	const regAnno = genome.regulatoryAnnotations
	if (!regAnno) return annotations

	const queries: Promise<void>[] = []

	if (regAnno.cpgIsland) {
		queries.push(queryCpgIslands(regAnno.cpgIsland, chr, start, stop, annotations, shoreSize))
	}
	if (regAnno.encodeCCRE) {
		queries.push(queryEncodeCCRE(regAnno.encodeCCRE, chr, start, stop, annotations))
	}

	await Promise.all(queries)
	return annotations
}

/**
 * Query UCSC CpG Island BED file (col0: chrom, col1: start, col2: end, col3: name).
 * Derives Shore annotations (flanking each CGI) since shores are not in any standard
 * annotation file. The default 2kb distance is the canonical definition from
 * Irizarry et al. (2009) Nature Genetics, which showed most tissue-specific and
 * cancer-related differential methylation occurs in shores rather than islands.
 */
async function queryCpgIslands(
	file: string,
	chr: string,
	start: number,
	stop: number,
	annotations: GpdmAnnotation[],
	shoreSize: number
): Promise<void> {
	const fullPath = path.join(serverconfig.tpmasterdir, file)
	const region = `${chr}:${start}-${stop}`

	await get_lines_bigfile({
		args: [fullPath, region],
		callback: (line: string) => {
			const cols = line.split('\t')
			if (cols.length < 3) return
			const s = Math.max(parseInt(cols[1]), start)
			const e = Math.min(parseInt(cols[2]), stop)
			if (s >= e) return

			annotations.push({ name: `CGI_${chr}_${s}`, start: s, end: e })

			const shoreLeft = Math.max(start, s - shoreSize)
			if (shoreLeft < s) annotations.push({ name: `Shore_${chr}_${shoreLeft}`, start: shoreLeft, end: s })
			const shoreRight = Math.min(stop, e + shoreSize)
			if (shoreRight > e) annotations.push({ name: `Shore_${chr}_${e}`, start: e, end: shoreRight })
		}
	})
}

/**
 * Query ENCODE cCRE BED file for the region.
 * Features with unrecognized classifications are skipped: without a known type
 * keyword we cannot assign the correct dataset-derived priors, so leaving the
 * region as intergenic (filled by the GP model) is better than annotating it
 * with the wrong biological context.
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

	await get_lines_bigfile({
		args: [fullPath, region],
		callback: (line: string) => {
			const cols = line.split('\t')
			if (cols.length < 6) return
			const s = Math.max(parseInt(cols[1]), start)
			const e = Math.min(parseInt(cols[2]), stop)
			if (s >= e) return

			// Primary type is always the first comma-delimited token in col5
			const annType = CCRE_TYPE_MAP[cols[5].split(',')[0]]
			if (!annType) return

			annotations.push({ name: `${annType}_${chr}_${s}`, start: s, end: e })
		}
	})
}
