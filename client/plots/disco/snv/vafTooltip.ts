import { fillbar } from '#dom'
import type Data from '#plots/disco/data/Data.ts'

export type ReadCountValue = Data['refCount'] | Data['altCount']

export function getIntegerCount(v: ReadCountValue): number | null {
	if (Number.isInteger(v)) return v as number
	if (typeof v == 'string' && /^-?\d+$/.test(v)) {
		const n = Number(v)
		if (Number.isInteger(n)) return n
	}
	return null
}

export function hasValidReadCounts(refCountValue: ReadCountValue, altCountValue: ReadCountValue): boolean {
	const refCount = getIntegerCount(refCountValue)
	const altCount = getIntegerCount(altCountValue)
	return refCount != null && altCount != null && refCount >= 0 && altCount >= 0 && refCount + altCount > 0
}

export function appendVafBar(td2: any, refCountValue: ReadCountValue, altCountValue: ReadCountValue) {
	const refCount = getIntegerCount(refCountValue)
	const altCount = getIntegerCount(altCountValue)
	if (refCount == null || altCount == null) return

	const totalCount = refCount + altCount
	const fraction = altCount / totalCount
	const div = td2
		.append('div')
		.style('margin-left', '5px')
		.style('margin-top', '4px')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '6px')

	div.append('span').style('font-size', '0.8em').style('color', '#555').text('VAF')
	fillbar(div, { f: fraction, v1: altCount, v2: totalCount })
}
