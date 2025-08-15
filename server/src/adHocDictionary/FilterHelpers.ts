export default class FilterHelpers {
	static allSamplesSet: Set<string>
	static dataRows: string[][]
	static headersIdxMap: Map<string, number>
	static sampleKeyIdx: number

	constructor(sampleKeyIdx: number, headersIdx: Map<string, number>) {
		FilterHelpers.sampleKeyIdx = sampleKeyIdx
		FilterHelpers.headersIdxMap = headersIdx
	}

	public static normalizeFilter(raw: any) {
		if (!raw) return null

		if (raw.type === 'tvslst') {
			return {
				type: 'tvslst',
				join: String(raw.join ?? 'and').toLowerCase() as 'and' | 'or',
				in: raw.in,
				lst: (raw.lst ?? []).map(FilterHelpers.normalizeFilter).filter(Boolean)
			}
		}

		if (raw.type === 'tvs' && raw.tvs?.term) {
			const t = raw.tvs.term
			const termType = String(t.type)
			if (termType === 'categorical') {
				const vals = (raw.tvs.values ?? []).map((v: any) => v.key)
				return {
					termid: t.id,
					type: termType,
					filter: vals,
					isNot: !!raw.tvs.isnot
				}
			} else {
				// numeric-like: normalize ranges with defaults & inclusivity
				const ranges = (raw.tvs.ranges ?? []).map((r: any) => {
					const min = r.startunbounded ? -Infinity : r.start
					const max = r.stopunbounded ? Infinity : r.stop
					const includeMin = r.startinclusive !== false // default true
					const includeMax = r.stopinclusive !== false // default true
					return { min, max, includeMin, includeMax }
				})
				return {
					termid: t.id,
					type: termType,
					filter: ranges,
					isNot: !!raw.tvs.isnot
				}
			}
		}

		return null
	}

	public static getMatches(filter: any, lines: string[]): string[] {
		FilterHelpers.dataRows = lines.slice(1).map(l => l.split(','))

		FilterHelpers.allSamplesSet = new Set<string>()
		const samplesIdx = new Map<string, number>()

		FilterHelpers.dataRows.forEach((row, idx) => {
			FilterHelpers.allSamplesSet.add(row[FilterHelpers.sampleKeyIdx])
			samplesIdx.set(row[FilterHelpers.sampleKeyIdx], idx)
		})

		const matchSamples = [...FilterHelpers.evalNode(filter)]

		const samples: any = []
		for (const sample of matchSamples) {
			const idx = samplesIdx.get(sample)
			if (idx != null) samples.push(FilterHelpers.dataRows[idx])
		}

		return samples
	}

	private static evalNode(filter): Set<string> {
		if (filter.type === 'tvslst') {
			const g = filter
			const childSets = (g.lst ?? []).map(FilterHelpers.evalNode)
			if (childSets.length === 0) return new Set<string>()

			let acc = new Set<string>(childSets[0])
			for (let i = 1; i < childSets.length; i++) {
				acc =
					g.join === 'or' ? FilterHelpers.joinSampleList(acc, childSets[i]) : FilterHelpers.intersect(acc, childSets[i])
			}
			if (g.in === false) acc = FilterHelpers.findOthers(FilterHelpers.allSamplesSet, acc)
			return acc
		}
		return FilterHelpers.evalLeaf(filter)
	}

	private static evalLeaf(leaf, isMatch?: (leaf, cellValue: string) => boolean): Set<string> {
		const match = isMatch ?? FilterHelpers.defaultIsMatch

		const leafCache = new Map<string, Set<string>>()

		const leafKey = leaf => `${leaf.termid}|${leaf.type}|${leaf.isNot ? 1 : 0}|${JSON.stringify(leaf.filter)}`

		const key = leafKey(leaf)
		const cached = leafCache.get(key)
		if (cached) return cached

		const colIdx = FilterHelpers.headersIdxMap.get(leaf.termid)
		if (colIdx == null) {
			const empty = new Set<string>()
			leafCache.set(key, empty)
			return empty
		}

		const matched = new Set<string>()
		for (const row of FilterHelpers.dataRows) {
			const cell = (row[colIdx] ?? '').trim()
			if (cell && match(leaf, cell)) matched.add(row[this.sampleKeyIdx])
		}

		const result = leaf.isNot ? FilterHelpers.findOthers(FilterHelpers.allSamplesSet, matched) : matched
		leafCache.set(key, result)
		return result
	}

	private static defaultIsMatch(leaf, raw: string) {
		if (leaf.type === 'categorical') {
			return leaf.filter.includes(raw)
		}
		const x = Number(raw)
		if (!Number.isFinite(x)) return false
		return leaf.filter.some(r => {
			const greaterOrEqual = r.includeMin ? x >= r.min : x > r.min
			const lesserOrEqual = r.includeMax ? x <= r.max : x < r.max
			return greaterOrEqual && lesserOrEqual
		})
	}

	/** Find samples present in both sets */
	private static intersect(set1: Set<string>, set2: Set<string>) {
		const intersectingSamples = new Set<string>()
		const [smallestSet, largestSet] = set1.size < set2.size ? [set1, set2] : [set2, set1]
		//Evaluate the smallest to reduce computing power
		for (const v of smallestSet) if (largestSet.has(v)) intersectingSamples.add(v)
		return intersectingSamples
	}

	/** Add together sample sets when join == 'add' */
	private static joinSampleList(set1: Set<string>, set2: Set<string>) {
		const list = new Set<string>(set1)
		for (const v of set2) list.add(v)
		return list
	}

	/** If term is negated, find all other samples */
	private static findOthers(all: Set<string>, subset: Set<string>) {
		const otherSamples = new Set<string>(all)
		for (const v of subset) otherSamples.delete(v)
		return otherSamples
	}
}
