/** Per-sample mutation → lesion conversion for GRIN2. Pure functions (no I/O): route an mlst by data type
 * and filter/convert each entry to the lesion tuple [sampleName, chrom, start, end, lesionType]. Split out
 * of main.ts so the request/response orchestration there stays focused on the cache + Python + render flow.
 * These are the functions exercised directly by grin2.unit.spec.ts. */

import {
	dtsnvindel,
	dtcnv,
	dtfusionrna,
	dtsv,
	dtitd,
	dt2lesion,
	optionToDt,
	mclasscnvgain,
	mclasscnvloss,
	mclasscnvAmp,
	mclasscnvHomozygousDel
} from '#shared'
import type { GRIN2Request } from '#types'
import { mayFilterByMaf } from '../mds3.init.js'
import { mayLog } from '../helpers.ts'
import type { CnvType, Lesion } from './types.ts'

// Building the lesion map to send to python
export function buildLesionTypeMap(availableOptions: string[]): Record<string, string> {
	const lesionTypeMap: Record<string, string> = {}

	for (const option of availableOptions) {
		const dt = optionToDt[option]
		if (!dt || !dt2lesion[dt]) continue

		dt2lesion[dt].lesionTypes.forEach(lt => {
			lesionTypeMap[lt.lesionType] = lt.name
		})
	}

	return lesionTypeMap
}

// Function to get CNV lesion type based on gain or loss in a more robust way
export function getCnvLesionType(isGain: boolean): string {
	const cnvConfig = dt2lesion[dtcnv]
	const targetName = isGain ? 'Gain' : 'Loss'

	const lesionType = cnvConfig.lesionTypes.find(lt => lt.name === targetName)
	if (!lesionType) {
		throw new Error(`CNV lesion type '${targetName}' not found`)
	}

	return lesionType.lesionType
}

/** Process the MLST data for each sample: apply the per-dt hypermutator cutoff, then filter and convert.
 * hyperMutatedDt lists the data types (dtsnvindel/dtcnv) dropped for this sample as hypermutated, so the
 * caller can report them. */
export function processSampleMlst(
	sampleName: string,
	mlst: any[],
	request: GRIN2Request,
	cnvType: CnvType
): { sampleLesions: Lesion[]; contributedTypes: Set<number>; hyperMutatedDt: number[] } {
	const sampleLesions: Lesion[] = []
	const contributedTypes = new Set<number>()

	// Hypermutator cutoff: a sample with more than the per-dt cutoff of raw records for a data type is
	// treated as hypermutated for that dt and contributes none of it (such samples dominate the gene-level
	// statistics). Counted on raw mlst records before consequence/threshold filtering, mirroring the GDC
	// prototype's per-file count. cutoff <= 0 (or absent) disables the check; only snvindel and cnv have one.
	const snvCutoff = request.snvindelOptions?.hyperMutator ?? 0
	const cnvCutoff = request.cnvOptions?.hyperMutator ?? 0
	let skipSnvHyper = false
	let skipCnvHyper = false
	if (snvCutoff > 0 || cnvCutoff > 0) {
		let snvCount = 0
		let cnvCount = 0
		for (const m of mlst) {
			if (m.dt === dtsnvindel) snvCount++
			else if (m.dt === dtcnv) cnvCount++
		}
		skipSnvHyper = snvCutoff > 0 && snvCount > snvCutoff
		skipCnvHyper = cnvCutoff > 0 && cnvCount > cnvCutoff
	}
	const hyperMutatedDt: number[] = []
	if (skipSnvHyper) hyperMutatedDt.push(dtsnvindel)
	if (skipCnvHyper) hyperMutatedDt.push(dtcnv)

	for (const m of mlst) {
		switch (m.dt) {
			case dtsnvindel: {
				if (!request.snvindelOptions || skipSnvHyper) break

				const les = filterAndConvertSnvIndel(sampleName, m, request.snvindelOptions)
				if (les) {
					sampleLesions.push(les)
					contributedTypes.add(dtsnvindel)
				}
				break
			}

			case dtcnv: {
				if (!request.cnvOptions || skipCnvHyper) break

				const les = filterAndConvertCnv(sampleName, m, request.cnvOptions, cnvType)
				if (les) {
					sampleLesions.push(les)
					contributedTypes.add(dtcnv)
				}
				break
			}

			case dtfusionrna: {
				if (!request.fusionOptions) break

				const les = breakpointsToLesions(sampleName, m, dtfusionrna)
				if (les.length) {
					sampleLesions.push(...les)
					contributedTypes.add(dtfusionrna)
				}
				break
			}

			case dtsv: {
				if (!request.svOptions) break

				const les = breakpointsToLesions(sampleName, m, dtsv)
				if (les.length) {
					sampleLesions.push(...les)
					contributedTypes.add(dtsv)
				}
				break
			}

			case dtitd: {
				if (!request.itdOptions) break

				const les = itdToLesion(sampleName, m)
				if (les) {
					sampleLesions.push(les)
					contributedTypes.add(dtitd)
				}
				break
			}

			default:
				break
		}
	}

	return { sampleLesions, contributedTypes, hyperMutatedDt }
}

export function filterAndConvertSnvIndel(
	sampleName: string,
	entry: any,
	options: GRIN2Request['snvindelOptions']
): Lesion | null {
	// Check if options and consequences exist for typescript
	if (!options?.consequences) {
		return null
	}

	// Only include mutations whose consequence class is selected. An empty list means no consequence is
	// selected, so nothing is included — mirrors cnvOptions.cnvCategories, and the UI disables Run when
	// snvindel is the only enabled data type with no consequence checked.
	if (!options.consequences.includes(entry.class)) {
		return null
	}

	if (!Number.isInteger(entry.pos)) {
		return null
	}

	if (options.mafFilter?.lst?.length) {
		// has non-empty maf filter. apply maf filtering
		if (!Array.isArray(entry.vafs)) return null // lacks vaf and skip entry
		// TEMP fix! delete this and use !mayFilterByMaf(options.mafFilter, entry) when helper accepts .vafs[]
		const copy = { dt: dtsnvindel }
		for (const v of entry.vafs) {
			copy[v.id] = v.refCount + ',' + v.altCount
		}
		try {
			if (!mayFilterByMaf(options.mafFilter, copy)) return null
		} catch (e: unknown) {
			mayLog('mayFilterByMaf() crashed on a snvindel ' + (e instanceof Error ? e.message : String(e)))
			return null
		}
	}

	const start = entry.pos
	const end = entry.pos

	return [sampleName, entry.chr, start, end, dt2lesion[dtsnvindel].lesionTypes[0].lesionType]
}

/** Pick the gain/loss thresholds for a cnv segment's resolved value type. A per-type entry in
 * cnvOptions.byType (mixed cohort) wins over the flat lossThreshold/gainThreshold (single-type
 * cohort). Returns null when neither supplies a complete pair. 'category' never reaches here. */
function resolveCnvThresholds(
	options: NonNullable<GRIN2Request['cnvOptions']>,
	effectiveType: CnvType
): { lossThreshold: number; gainThreshold: number } | null {
	const byType = options.byType?.[effectiveType as 'log2ratio' | 'segmean' | 'copyNumber']
	const lossThreshold = byType?.lossThreshold ?? options.lossThreshold
	const gainThreshold = byType?.gainThreshold ?? options.gainThreshold
	if (lossThreshold === undefined || gainThreshold === undefined) return null
	return { lossThreshold, gainThreshold }
}

export function filterAndConvertCnv(
	sampleName: string,
	entry: any,
	options: GRIN2Request['cnvOptions'],
	cnvType: CnvType
): Lesion | null {
	if (!options) return null

	if (!Number.isInteger(entry.start)) return null
	if (!Number.isInteger(entry.stop)) return null

	// Filter max segment length (applies to every cnv type). Default 0 = no filter, matching the
	// request contract; an omitted maxSegLength must not silently drop all segments.
	const maxSegLength = options.maxSegLength ?? 0
	if (maxSegLength > 0 && entry.stop - entry.start > maxSegLength) {
		return null
	}

	// Classify the segment as gain or loss according to how this cnv value is quantified.
	// A per-entry valueType (stamped at the data source, e.g. GDC loadCnvFile) wins over the
	// dataset-level default, so a single cohort may mix segmean and copyNumber segments.
	const effectiveType: CnvType = entry.valueType ?? cnvType
	let isGain: boolean
	if (effectiveType == 'category') {
		// qualitative call carried in the segment's class; no numeric thresholds.
		// When the request lists cnvCategories (UI checkboxes), drop any segment whose class isn't selected;
		// an omitted list (undefined) means "all classes", an empty list means "none".
		if (Array.isArray(options.cnvCategories) && !options.cnvCategories.includes(entry.class)) return null
		// map the class to a gain/loss lesion. GDC's 5-category data distinguishes a gain from a high-level
		// amplification and a loss from a homozygous deletion; GRIN2 renders only gain vs loss, so both
		// gain-like classes => gain and both loss-like classes => loss.
		if (entry.class == mclasscnvgain || entry.class == mclasscnvAmp) isGain = true
		else if (entry.class == mclasscnvloss || entry.class == mclasscnvHomozygousDel) isGain = false
		else return null
	} else {
		// numeric value: log2ratio/segmean (baseline 0) or copyNumber (baseline 2).
		// The comparison is identical across these; only the threshold values differ,
		// e.g. copyNumber uses positive cutoffs straddling baseline 2 (loss<=1, gain>=3).
		// In a mixed cohort, cnvOptions.byType[effectiveType] supplies the right cutoffs for this
		// segment; otherwise fall back to the flat lossThreshold/gainThreshold (single-type cohort).
		const thresholds = resolveCnvThresholds(options, effectiveType)
		if (!thresholds) return null
		if (!Number.isFinite(entry.value)) return null
		if (entry.value >= thresholds.gainThreshold) isGain = true
		else if (entry.value <= thresholds.lossThreshold) isGain = false
		else return null // between thresholds = neutral
	}

	const lesionType = getCnvLesionType(isGain)

	const start = entry.start
	const end = entry.stop

	return [sampleName, entry.chr, start, end, lesionType]
}

/** Convert a fusion or sv breakpoint entry to lesions — one per breakpoint (chrA, and chrB when present).
 * Fusion and sv are byte-identical here (no filtering; each breakpoint becomes a lesion), differing only
 * by dt for the lesion-type label, so they share this. Returns [] when the entry lacks a valid chrA/posA.
 * Emitting both partners as separate lesions lets GRIN2 identify genes affected at each breakpoint. */
export function breakpointsToLesions(sampleName: string, entry: any, dt: number): Lesion[] {
	if (!entry.chrA || entry.posA === undefined) return []
	const lesionType = dt2lesion[dt].lesionTypes[0].lesionType
	const lesions: Lesion[] = [[sampleName, entry.chrA, entry.posA, entry.posA, lesionType]]
	if (entry.chrB && entry.posB !== undefined) {
		lesions.push([sampleName, entry.chrB, entry.posB, entry.posB, lesionType])
	}
	return lesions
}

/** Convert an ITD entry to a single region lesion. ITD is an in-frame internal tandem duplication
 * spanning chr:start-stop (same shape the itd query emits, mds3.init.js validate_query_itd), so it
 * maps like a cnv segment — no filtering options. Returns null when the region is malformed. */
export function itdToLesion(sampleName: string, entry: any): Lesion | null {
	if (!Number.isInteger(entry.start) || !Number.isInteger(entry.stop)) return null
	return [sampleName, entry.chr, entry.start, entry.stop, dt2lesion[dtitd].lesionTypes[0].lesionType]
}
