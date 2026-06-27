import type { IDCParquetData, IDCStudy, IDCViewerRow, ResponseHit, SortByField } from '../IDCTypes'

/** Transforms raw parquet data + GDC case hits into display-ready IDCViewerRow[].
 *  All conditional shaping lives here so the View stays a thin renderer. */
export class IDCViewModel {
	buildTableData(
		idcData: ReadonlyArray<IDCParquetData>,
		caseHits: ResponseHit[],
		options: { idcMatchedOnly?: boolean; sortBy?: SortByField; sortDirection?: 'asc' | 'desc' } = {}
	): IDCViewerRow[] {
		const { idcMatchedOnly = false, sortBy, sortDirection = 'asc' } = options
		const rowsByCaseId = new Map<string, IDCParquetData[]>()
		for (const hit of caseHits) {
			rowsByCaseId.set(hit.case_id, [])
		}
		for (const data of idcData) {
			const rows = rowsByCaseId.get(data.gdc_case_id)
			if (rows) {
				rows.push(data)
			}
		}

		const viewerRows: IDCViewerRow[] = []
		for (const hit of caseHits) {
			const idcArray = rowsByCaseId.get(hit.case_id) || []
			const studiesMap = new Map<string, IDCStudy>()
			idcArray.forEach((r: IDCParquetData) => {
				const studyId = r?.StudyInstanceUID ?? 'n/a'
				if (!studiesMap.has(studyId)) {
					studiesMap.set(studyId, {
						StudyInstanceUID: r?.StudyInstanceUID ?? null,
						collectionId: r?.collection_id ?? null,
						series: [],
						hasWSI: false,
						hasRadiology: false,
						StudyDate: r?.StudyDate ?? 'n/a',
						StudyDescription: r?.StudyDescription ?? null
					})
				}
				const st = studiesMap.get(studyId)
				if (st) {
					st.series.push(r)
					const mod = String(r.study_type ?? '')
						.trim()
						.toUpperCase()
					if (mod === 'M') st.hasWSI = true
					if (mod === 'R') st.hasRadiology = true
				}
			})

			const studiesList = Array.from(studiesMap.values())
			const wsiCount = studiesList.filter(s => s.hasWSI).length
			const radiologyCount = studiesList.filter(s => s.hasRadiology).length

			viewerRows.push({
				caseId: hit.submitter_id || 'N/A',
				programName: hit.project.program.name || 'N/A',
				project: hit.project.project_id || 'N/A',
				studiesList,
				studiesCount: studiesList.length,
				wsiCount,
				radiologyCount
			})
		}

		const result = idcMatchedOnly ? viewerRows.filter(r => r.studiesList.length > 0) : viewerRows

		if (sortBy) {
			const fieldMap: Record<SortByField, keyof IDCViewerRow> = {
				submitter_id: 'caseId',
				'project.project_id': 'project',
				'project.program.name': 'programName'
			}
			const field = fieldMap[sortBy]
			result.sort((a, b) => {
				const va = String(a[field] ?? '')
				const vb = String(b[field] ?? '')
				const cmp = va.localeCompare(vb)
				return sortDirection === 'asc' ? cmp : -cmp
			})
		}

		return result
	}
}
