/** Helper class for filtering from termdb filter*/
export default class FilterHelpers {
	static allImagesSet: Set<string>
	static dataRows: string[][]
	static headersMap: Map<string, { idx: number; label: string }>
	static imageKeyIdx: number

	constructor(imageKeyIdx: number, headersMap: Map<string, { idx: number; label: string }>) {
		FilterHelpers.imageKeyIdx = imageKeyIdx
		FilterHelpers.headersMap = headersMap
	}

	/** Mutate the filter object so it's easier to work with */
	public static normalizeFilter(raw: any) {
		if (!raw || (raw.type == 'tvslst' && !raw?.lst.length)) return null

		if (raw.type === 'tvslst') {
			return {
				type: 'tvslst',
				join: String(raw.join ?? 'and').toLowerCase() as 'and' | 'or',
				in: raw.in,
				lst: (raw.lst ?? []).map(FilterHelpers.normalizeFilter)
			}
		} else if (raw.type === 'tvs' && raw.tvs?.term) {
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
		} else return null
	}

	/** Returns list of images matching the filter */
	public static getMatches(filter: any, lines: string[]): string[] {
		FilterHelpers.dataRows = lines.slice(1).map(l => l.split(','))

		//TODO: keep FilterHelpers.allImagesSet or use only imagesIdx??
		FilterHelpers.allImagesSet = new Set<string>()
		const imagesIdx = new Map<string, number>()

		FilterHelpers.dataRows.forEach((row, idx) => {
			FilterHelpers.allImagesSet.add(row[this.imageKeyIdx])
			imagesIdx.set(row[this.imageKeyIdx], idx)
		})

		/** If no filter.tvs.lst is provided, return all images
		 * Otherwise iterate over the filter tree to return matches. */
		const matchedImages = filter == null ? [...FilterHelpers.allImagesSet] : [...FilterHelpers.evalNode(filter)]
		const images: any = []
		if (!matchedImages || !matchedImages.length) {
			console.log('No matches found for filter [src/adHocDictionary/FilterHelpers.ts getMatches()]')
			return images
		}

		for (const image of matchedImages) {
			const idx = imagesIdx.get(image)
			if (idx != null) images.push(FilterHelpers.dataRows[idx])
		}
		return images
	}

	/** Intersects the filter with the data rows */
	private static evalNode(filter): Set<string> {
		if (filter.type === 'tvslst') {
			const g = filter
			const childSets = (g.lst ?? []).map(FilterHelpers.evalNode)
			if (childSets.length === 0) return new Set<string>()

			let acc = new Set<string>(childSets[0])
			for (let i = 1; i < childSets.length; i++) {
				acc =
					g.join === 'or' ? FilterHelpers.joinImageList(acc, childSets[i]) : FilterHelpers.intersect(acc, childSets[i])
			}
			if (g.in === false) acc = FilterHelpers.findOthers(acc)
			return acc
		}
		return FilterHelpers.evalLeaf(filter)
	}

	/** Evaluates a leaf node in the filter tree */
	private static evalLeaf(leaf, isMatch?: (leaf, cellValue: string) => boolean): Set<string> {
		const match = isMatch ?? FilterHelpers.defaultIsMatch

		const leafCache = new Map<string, Set<string>>()

		const leafKey = leaf => `${leaf.termid}|${leaf.type}|${leaf.isNot ? 1 : 0}|${JSON.stringify(leaf.filter)}`

		const key = leafKey(leaf)
		const cached = leafCache.get(key)
		if (cached) return cached

		const colIdx = FilterHelpers.headersMap.get(leaf.termid)
		if (colIdx == null) {
			const empty = new Set<string>()
			leafCache.set(key, empty)
			return empty
		}

		const matched = new Set<string>()
		for (const row of FilterHelpers.dataRows) {
			const cell = (row[colIdx.idx] ?? '').trim()
			if (cell && match(leaf, cell)) matched.add(row[this.imageKeyIdx])
		}

		const result = leaf.isNot ? FilterHelpers.findOthers(matched) : matched
		leafCache.set(key, result)
		return result
	}

	/** Check if image falls within the filter range via default min and max values. */
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

	/** Find images present in both sets */
	private static intersect(set1: Set<string>, set2: Set<string>) {
		const intersectingImages = new Set<string>()
		const [smallestSet, largestSet] = set1.size < set2.size ? [set1, set2] : [set2, set1]
		//Evaluate the smallest to reduce computing power
		for (const v of smallestSet) if (largestSet.has(v)) intersectingImages.add(v)
		return intersectingImages
	}

	/** Add together image sets when join == 'add' */
	private static joinImageList(set1: Set<string>, set2: Set<string>) {
		const list = new Set<string>(set1)
		for (const v of set2) list.add(v)
		return list
	}

	/** If term is negated, find all other images */
	private static findOthers(subset: Set<string>) {
		const otherImages = new Set<string>(FilterHelpers.allImagesSet)
		for (const v of subset) otherImages.delete(v)
		return otherImages
	}

	/** Formats matches into col and rows for table rendering. */
	public static formatData(matches: string[]) {
		const cols = [...FilterHelpers.headersMap.values()].map(h => {
			return { label: h.label }
		})
		//Ensure the image ID label appears first
		cols.unshift(cols.splice(this.imageKeyIdx, 1)[0])

		const rows = matches.map(m => {
			const row: any = []
			for (const value of m) {
				row.push({ value: value.trim() || '' })
			}
			//Ensure the image ID appears in first col
			row.unshift(row.splice(this.imageKeyIdx, 1)[0])
			return row
		})

		return { cols, rows, images: matches.map(m => m[this.imageKeyIdx]) }
	}
}
