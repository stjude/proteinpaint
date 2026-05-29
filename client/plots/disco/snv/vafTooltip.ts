import { fillbar } from '#dom'
import type Data from '#plots/disco/data/Data.ts'

export type ReadCountValue = string | number | undefined
export type VafEntry = {
	label: string
	refCount?: ReadCountValue
	totalCount?: ReadCountValue
	altCount: ReadCountValue
}

export function getIntegerCount(v: ReadCountValue): number | null {
	if (Number.isInteger(v)) return v as number
	if (typeof v == 'string' && /^-?\d+$/.test(v)) {
		const n = Number(v)
		if (Number.isInteger(n)) return n
	}
	return null
}

export function getReadCounts(
	refCountValue: ReadCountValue,
	altCountValue: ReadCountValue,
	totalCountValue?: ReadCountValue
) {
	const altCount = getIntegerCount(altCountValue)
	if (altCount == null || altCount < 0) return null

	const totalCount = getIntegerCount(totalCountValue)
	if (totalCount != null) {
		if (totalCount <= 0 || totalCount < altCount) return null
		return { altCount, refCount: totalCount - altCount, totalCount }
	}

	const refCount = getIntegerCount(refCountValue)
	if (refCount == null || refCount < 0 || refCount + altCount <= 0) return null
	return { altCount, refCount, totalCount: refCount + altCount }
}

export function hasValidReadCounts(
	refCountValue: ReadCountValue,
	altCountValue: ReadCountValue,
	totalCountValue?: ReadCountValue
): boolean {
	return getReadCounts(refCountValue, altCountValue, totalCountValue) != null
}

export function getVafEntries(vafs: Data['vafs']): VafEntry[] {
	const entries: VafEntry[] = []
	if (Array.isArray(vafs)) {
		for (const vaf of vafs) {
			const label = vaf?.id || vaf?.name
			const refCount = vaf?.refCount
			const totalCount = vaf?.totalCount
			const altCount = vaf?.altCount
			if (!label || altCount == null || (refCount == null && totalCount == null)) continue
			entries.push({ label, refCount, totalCount, altCount })
		}
	}
	return entries
}

export function getNumericFraction(v: ReadCountValue): number | null {
	if (typeof v != 'number' && typeof v != 'string') return null
	const n = Number(v)
	return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null
}

export function getMutationFractions(vafs: Data['vafs']): number[] {
	const fractions: number[] = []
	if (!Array.isArray(vafs)) return fractions

	for (const vaf of vafs) {
		const explicitFraction = getNumericFraction(vaf?.fraction ?? vaf?.mutationFraction)
		if (explicitFraction != null) {
			fractions.push(explicitFraction)
			continue
		}

		const counts = getReadCounts(vaf?.refCount, vaf?.altCount, vaf?.totalCount)
		if (!counts) continue
		fractions.push(counts.altCount / counts.totalCount)
	}
	return fractions
}

export function getMaxMutationFraction(vafs: Data['vafs']): number | null {
	const fractions = getMutationFractions(vafs)
	return fractions.length ? Math.max(...fractions) : null
}

export function hasAnyValidVafEntry(vafs: Data['vafs']): boolean {
	return getVafEntries(vafs).some(vaf => hasValidReadCounts(vaf.refCount, vaf.altCount, vaf.totalCount))
}

export function appendVafBar(
	td2: any,
	refCountValue: ReadCountValue,
	altCountValue: ReadCountValue,
	label = 'VAF',
	totalCountValue?: ReadCountValue
) {
	const counts = getReadCounts(refCountValue, altCountValue, totalCountValue)
	if (!counts) return

	const fraction = counts.altCount / counts.totalCount
	const div = td2
		.append('div')
		.style('margin-left', '5px')
		.style('margin-top', '4px')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '6px')

	div.append('span').style('font-size', '0.8em').style('color', '#555').text(label)
	fillbar(div, { f: fraction, v1: counts.altCount, v2: counts.totalCount })
}

export function appendVafBars(td2: any, vafs: Data['vafs']) {
	for (const vaf of getVafEntries(vafs)) {
		if (!hasValidReadCounts(vaf.refCount, vaf.altCount, vaf.totalCount)) continue
		appendVafBar(td2, vaf.refCount, vaf.altCount, vaf.label, vaf.totalCount)
	}
}
