type CellCache = {
	cellIds: string[]
	sampleIds: string[]
	x: Float32Array
	y: Float32Array

	byCellId: Map<string, number>
}

export class SingleCellMetaCache {
	sampleIntIds = new Set<any>()
	sampleIntId2Name = new Map<any, string>()
	sampleName2IntId = new Map<string, any>()
	metaIdMap = new Map<string, Map<string, string>>()
	metaResultNames = new Set<string>()
	cellTypeFractions?: Map<any, any>

	registerCohortSample(sampleName: string, sampleIntId: any): void {
		/** Sample INT ids correspond to the primary key in the termdb */
		this.sampleIntIds.add(sampleIntId)
		this.sampleIntId2Name.set(sampleIntId, sampleName)
		this.sampleName2IntId.set(sampleName, sampleIntId)
	}

	addMetaResult(
		metaResultName: string,
		text: string,
		idxs: any, // TODO: update type
		sampleName2id: (sampleName: string) => any
	): void {
		const cellCache = this.initCellCacheFromText(text, idxs)
		this.mapMetaResult(metaResultName, cellCache, sampleName2id)
	}

	// TODO: update type of idxs
	private initCellCacheFromText(text: string, idxs): CellCache {
		const lines = text.trim().split('\n')
		if (!lines[0]) throw new Error('meta result file is empty')
		const headerColumnCount = lines[0].split('\t').length

		const cellIdIdx = idxs?.cell ?? 0
		const sampleIdIdx = idxs?.sample ?? 1
		const xIdx = idxs.x
		const yIdx = idxs.y
		const cellTypeIdx = idxs.cellType

		if (!Number.isInteger(xIdx) || xIdx < 0 || xIdx >= headerColumnCount)
			throw new Error('X column index is invalid in ds file')
		if (!Number.isInteger(yIdx) || yIdx < 0 || yIdx >= headerColumnCount)
			throw new Error('Y column index is invalid in ds file')

		const hasCellTypeIdx = Number.isInteger(cellTypeIdx)

		const n = lines.length - 1

		const cellIds: string[] = new Array(n)
		const sampleIds: string[] = new Array(n)
		const x = new Float32Array(n)
		const y = new Float32Array(n)
		const cellTypes: string[] = new Array(n)

		const byCellId = new Map<string, number>()

		for (let i = 1; i < lines.length; i++) {
			const row = lines[i].split('\t').map(s => s.trim())
			const rowIdx = i - 1

			const cellId = row[cellIdIdx]
			const sampleName = row[sampleIdIdx]

			cellIds[rowIdx] = cellId
			sampleIds[rowIdx] = sampleName
			x[rowIdx] = Number(row[xIdx])
			y[rowIdx] = Number(row[yIdx])

			if (!cellId) throw new Error(`meta result row missing cell id at row index ${rowIdx + 1}`)
			if (!sampleName) throw new Error(`meta result row missing sample id at row index ${rowIdx + 1}`)
			if (!Number.isFinite(x[rowIdx]) || !Number.isFinite(y[rowIdx])) {
				throw new Error(`meta result row has non-numeric x/y at row index ${rowIdx + 1}`)
			}

			byCellId.set(cellId, rowIdx)

			if (hasCellTypeIdx) {
				const cellType = row[cellTypeIdx]
				if (!cellType) throw new Error(`meta result row missing cell type at row index ${rowIdx + 1}`)
				cellTypes[rowIdx] = cellType
			}
		}

		const cellCache = {
			cellIds,
			sampleIds,
			x,
			y,
			byCellId
		}
		if (hasCellTypeIdx) cellCache.cellTypes = cellTypes

		return cellCache
	}

	private mapMetaResult(
		metaResultName: string,
		cellCache: CellCache,
		sampleName2id: (sampleName: string) => any
	): void {
		const byCellId = new Map<string, string>()
		const sample2cellType2abundance = new Map() // sample => cellType => abundance

		for (let i = 0; i < cellCache.cellIds.length; i++) {
			const cellId = cellCache.cellIds[i]
			const sampleName = cellCache.sampleIds[i]
			if (!cellId) throw new Error(`meta result row missing cell id at row index ${i + 1}`)
			if (!sampleName) throw new Error(`meta result row missing sample id at row index ${i + 1}`)

			byCellId.set(cellId, sampleName)

			const sampleIntId = sampleName2id(sampleName)
			if (sampleIntId !== undefined) {
				this.registerCohortSample(sampleName, sampleIntId)
			}

			if (cellCache.cellTypes) {
				// cell types are cached, determine abundances in each sample
				const cellType = cellCache.cellTypes[i]
				if (!cellType) throw new Error(`meta result row missing cell type at row index ${i + 1}`)
				if (!sample2cellType2abundance.has(sampleIntId)) sample2cellType2abundance.set(sampleIntId, new Map())
				const cellType2abundance = sample2cellType2abundance.get(sampleIntId)
				if (!cellType2abundance.has(cellType)) cellType2abundance.set(cellType, 0)
				const abundance = cellType2abundance.get(cellType)
				cellType2abundance.set(cellType, abundance + 1)
			}
		}

		this.metaResultNames.add(metaResultName)
		this.metaIdMap.set(metaResultName, byCellId)

		if (cellCache.cellTypes) {
			// cell types are cached, determine cell type fractions in each sample
			const cellType2sample2fraction = new Map()
			for (const [sample, cellType2abundance] of sample2cellType2abundance) {
				const totalAbundance = [...cellType2abundance.values()].reduce((total, value) => total + value, 0)
				for (const [cellType, abundance] of cellType2abundance) {
					const fraction = abundance / totalAbundance
					if (!cellType2sample2fraction.has(cellType)) cellType2sample2fraction.set(cellType, new Map())
					const sample2fraction = cellType2sample2fraction.get(cellType)
					sample2fraction.set(sample, fraction)
				}
			}
			this.cellTypeFractions = cellType2sample2fraction
		}
	}
}
