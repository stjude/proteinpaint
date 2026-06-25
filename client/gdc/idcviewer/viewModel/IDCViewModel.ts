import type { IDCParquetData, IDCStudy, IDCViewerRow, ResponseHit } from '../IDCTypes'

/** Transforms raw parquet data + GDC case hits into display-ready IDCViewerRow[].
 *  All conditional shaping lives here so the View stays a thin renderer. */
export class IDCViewModel {
	buildTableData(idcData: ReadonlyArray<IDCParquetData>, caseHits: ResponseHit[]): IDCViewerRow[] {
		const rowsByCase = new Map<ResponseHit, IDCParquetData[]>()
		caseHits.forEach(hit => {
			rowsByCase.set(hit, [])
			const filteredData = idcData.filter(data => hit.case_id === data.gdc_case_id)
			if (filteredData.length > 0) {
				rowsByCase.get(hit)!.push(...filteredData)
			}
		})

		const viewerRows: IDCViewerRow[] = []
		for (const [hit, idcArray] of rowsByCase) {
			const studiesMap = new Map<string, IDCStudy>()
			;(idcArray || []).forEach((r: IDCParquetData) => {
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
					const mod = r.study_type.toString().trim().toUpperCase()
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
		return viewerRows
	}
}
