type CellCache = {
  cellIds: string[]
  sampleIds: string[]
  x: Float32Array
  y: Float32Array

  byCellId: Map<string, number>
}

type CoordsColumns = { x: number; y: number }

export class SingleCellMetaCache {
  sampleIntIds = new Set<any>()
  sampleIntId2Name = new Map<any, string>()
  sampleName2IntId = new Map<string, any>()
  metaIdMap = new Map<string, Map<string, string>>()
  metaResultNames = new Set<string>()

  registerCohortSample(sampleName: string, sampleIntId: any): void {
    /** Sample INT ids correspond to the primary key in the termdb */
    this.sampleIntIds.add(sampleIntId)
    this.sampleIntId2Name.set(sampleIntId, sampleName)
    this.sampleName2IntId.set(sampleName, sampleIntId)
  }

  addMetaResult(
    metaResultName: string,
    text: string,
    coordsColumns: CoordsColumns,
    sampleName2id: (sampleName: string) => any
  ): void {
    const cellCache = this.initCellCacheFromText(text, coordsColumns)
    this.mapMetaResult(metaResultName, cellCache, sampleName2id)
  }

  private initCellCacheFromText(text: string, coordsColumns: CoordsColumns): CellCache {
    const lines = text.trim().split('\n')
    if (!lines[0]) throw new Error('meta result file is empty')
    const headerColumnCount = lines[0].split('\t').length

    const cellIdIdx = 0 //May need to be defined in the ds file or force in file structure.
    const sampleIdIdx = 1 //May need to be defined in the ds file or force in file structure.
    const xIdx = coordsColumns.x
    const yIdx = coordsColumns.y

    if (!Number.isInteger(xIdx) || xIdx < 0 || xIdx >= headerColumnCount)
      throw new Error('X column index is invalid in ds file')
    if (!Number.isInteger(yIdx) || yIdx < 0 || yIdx >= headerColumnCount)
      throw new Error('Y column index is invalid in ds file')

    const n = lines.length - 1

    const cellIds: string[] = new Array(n)
    const sampleIds: string[] = new Array(n)
    const x = new Float32Array(n)
    const y = new Float32Array(n)

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
    }

    return {
      cellIds,
      sampleIds,
      x,
      y,
      byCellId
    }
  }

  private mapMetaResult(
    metaResultName: string,
    cellCache: CellCache,
    sampleName2id: (sampleName: string) => any
  ): void {
    const byCellId = new Map<string, string>()

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
    }

    this.metaResultNames.add(metaResultName)
    this.metaIdMap.set(metaResultName, byCellId)
  }
}