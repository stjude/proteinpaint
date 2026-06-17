import type { GdcGRIN2File } from '#types'

/*
Pure helpers for GDC GRIN2 file discovery: per-case file dedup and CNV value-type detection. Used by the
unified GRIN2 run path (server/src/mds3.gdc.js discoverGdcGrin2CaseFiles) to decide which file and which
value type each case uses. Originally generalized from the dedup/type logic in server/routes/gdc.grin2.list.ts
(the legacy file-selection-table route); kept pure (no network — callers do the fetching) so it's testable.
*/

/** GDC CNV value type, detected from a file's data_type/workflow_type. Mirrors GdcGRIN2File.value_type. */
export type GdcCnvValueType = 'segmean' | 'copyNumber'

/**
 * Decide how a GDC CNV file's values are quantified, from its data_type and analysis workflow_type.
 * Returns null for files we don't use for GRIN2.
 * - 'Allele-specific Copy Number Segment' → absolute integer copy number (baseline 2)
 * - 'Masked Copy Number Segment', or 'Copy Number Segment' not from the DNACopy workflow → segmean (log2 ratio, baseline 0)
 * (was hardcoded to segmean in the list route; this centralizes the rule and adds copyNumber.)
 */
export function detectCnvValueType(data_type: string, workflow_type?: string): GdcCnvValueType | null {
	if (data_type == 'Allele-specific Copy Number Segment') return 'copyNumber'
	if (data_type == 'Masked Copy Number Segment') return 'segmean'
	if (data_type == 'Copy Number Segment' && workflow_type != 'DNACopy') return 'segmean'
	return null
}

/** Per-case dedup result: the kept files (one per case) plus stats for UI/telemetry. */
export type DedupResult = {
	kept: GdcGRIN2File[]
	duplicatesRemoved: number
	caseDetails: Array<{ caseName: string; fileCount: number; keptFileSize: number }>
}

/**
 * Keep exactly one file per case — the largest by file_size. A case may have several files (duplicates
 * or multiple samples); GRIN2 uses one per case. Generalized from the MAF dedup in gdc.grin2.list.ts
 * (resolving its "TODO make dedup function and add unit test") so CNV can reuse it.
 */
export function pickLargestFilePerCase(files: GdcGRIN2File[]): DedupResult {
	const byCase = new Map<string, GdcGRIN2File[]>()
	for (const f of files) {
		const k = f.case_submitter_id
		if (!byCase.has(k)) byCase.set(k, [])
		byCase.get(k)!.push(f)
	}

	const kept: GdcGRIN2File[] = []
	let duplicatesRemoved = 0
	const caseDetails: DedupResult['caseDetails'] = []

	for (const [caseName, caseFiles] of byCase) {
		if (caseFiles.length > 1) {
			caseFiles.sort((a, b) => b.file_size - a.file_size)
			kept.push(caseFiles[0])
			duplicatesRemoved += caseFiles.length - 1
			caseDetails.push({ caseName, fileCount: caseFiles.length, keptFileSize: caseFiles[0].file_size })
		} else {
			kept.push(caseFiles[0])
		}
	}

	return { kept, duplicatesRemoved, caseDetails }
}

/**
 * Choose one CNV file per case from a discovery result. A case may have files of more than one value
 * type (e.g. a segmean genotyping-array file and a copyNumber allele-specific file); preferredType (from
 * cnvOptions.dataType) picks the value type, else we default to segmean (the historical behavior). Within
 * the chosen type, keep the largest file. Returns a map of case id → the selected file.
 */
export function selectCnvFilePerCase(
	files: GdcGRIN2File[],
	preferredType?: GdcCnvValueType
): Map<string, GdcGRIN2File> {
	const byCase = new Map<string, GdcGRIN2File[]>()
	for (const f of files) {
		if (!byCase.has(f.case_submitter_id)) byCase.set(f.case_submitter_id, [])
		byCase.get(f.case_submitter_id)!.push(f)
	}

	const selected = new Map<string, GdcGRIN2File>()
	for (const [caseId, caseFiles] of byCase) {
		const wantType = preferredType ?? 'segmean'
		// prefer the requested value type; fall back to whatever this case has
		const pool = caseFiles.some(f => f.value_type == wantType)
			? caseFiles.filter(f => f.value_type == wantType)
			: caseFiles
		pool.sort((a, b) => b.file_size - a.file_size)
		selected.set(caseId, pool[0])
	}
	return selected
}
