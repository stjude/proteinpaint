import type { Selection } from 'd3-selection'
import type { IDCParquetData, IDCStudy, IDCViewerRow, ResponseHit } from './types'

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

export async function sha256FromArrayBuffer(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', buffer)
	return bytesToHex(new Uint8Array(digest))
}

export async function sha256FromBytes(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
	return bytesToHex(new Uint8Array(digest))
}

export function parseSha256Sidecar(text: string): string {
	const firstLine = text.trim().split(/\r?\n/)[0]?.trim() || ''
	return firstLine.split(/\s+/)[0].toLowerCase()
}

export async function verifyDownloadedParquet(parquetBuffer: ArrayBuffer, sha256SidecarText: string): Promise<boolean> {
	const actual = (await sha256FromArrayBuffer(parquetBuffer)).toLowerCase()
	const expected = parseSha256Sidecar(sha256SidecarText)
	return expected.length > 0 && actual === expected
}

export async function verifyParquetUrlWithSidecar(url: string): Promise<boolean> {
	const [parquetResp, sidecarResp] = await Promise.all([fetch(url), fetch(`${url}.sha256`)])

	if (!parquetResp.ok) {
		throw new Error(`Failed to fetch parquet: ${parquetResp.status} ${parquetResp.statusText}`)
	}
	if (!sidecarResp.ok) {
		throw new Error(`Failed to fetch sidecar: ${sidecarResp.status} ${sidecarResp.statusText}`)
	}

	const [buffer, sidecarText] = await Promise.all([parquetResp.arrayBuffer(), sidecarResp.text()])

	return verifyDownloadedParquet(buffer, sidecarText)
}

export function buildTableData(idcData: ReadonlyArray<IDCParquetData>, caseHits: ResponseHit[]): IDCViewerRow[] {
	const rowsByCase = new Map<ResponseHit, IDCParquetData[]>()
	idcData.forEach(row => {
		const hit: ResponseHit | undefined = caseHits.find(hit => hit.case_id === row.gdc_case_id)
		if (hit) {
			if (!rowsByCase.get(hit)) rowsByCase.set(hit, [])
			rowsByCase.get(hit)!.push(row)
		}
	})

	const viewerRows: IDCViewerRow[] = []
	for (const [hit, idcArray] of rowsByCase) {
		// group rows by StudyInstanceUID
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
				const rawMod = r.study_type.toString()
				const mod = rawMod.trim().toUpperCase()
				if (mod === 'M') st.hasWSI = true
				if (mod === 'R') st.hasRadiology = true
			}
		})
		const studiesList = Array.from(studiesMap.values())
		// compute counts for non-expanded row display
		const wsiCount = studiesList.filter(s => s.hasWSI).length
		const radiologyCount = studiesList.filter(s => s.hasRadiology).length
		console.log(`Case ${hit.submitter_id}: ${studiesList.length} studies`, hit, studiesList, idcArray)
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

export function renderTable(
	holder: Selection<HTMLDivElement, unknown, any, any>,
	tableData: ReadonlyArray<IDCViewerRow>
): void {
	holder.selectAll('*').remove()

	if (tableData.length === 0) {
		holder.append('div').text('No IDC studies found for the current cohort.')
		return
	}

	const table = holder
		.append('table')
		.style('width', '100%')
		.style('border-collapse', 'collapse')
		.style('font-size', '14px')

	const thead = table.append('thead')
	const headerRow = thead.append('tr').style('background-color', '#f5f5f5').style('border-bottom', '2px solid #ddd')

	const headers = ['GDC Case ID', 'Program', 'Project', 'IDC Studies (Click to expand)']
	const expandableHeaders = [
		'IDC Study Instance UID',
		'Collection',
		'Study Date',
		'Study Description',
		'IDC Histopathology Viewer',
		'IDC Radiology Viewer'
	]

	headers.forEach(header => {
		headerRow.append('th').style('padding', '10px').style('text-align', 'left').style('font-weight', '600').text(header)
	})

	const tbody = table.append('tbody')
	tableData.forEach((row, rowIdx) => {
		const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f9f9f9'
		const tr = tbody.append('tr').style('background-color', bgColor).style('border-bottom', '1px solid #eee')
		tr.append('td').style('padding', '10px').text(row.caseId)
		tr.append('td').style('padding', '10px').text(row.programName)
		tr.append('td').style('padding', '10px').text(row.project)

		const studyCellButton = tr
			.append('td')
			.style('padding', '10px')
			.append('button')
			.on('click', () => {
				const expanded = studyCellButton.attr('aria-expanded') === 'true'
				studyCellButton.attr('aria-expanded', String(!expanded))
				const detailsRowID = 'study-details' + row.caseId.replace('.', '')
				if (!expanded) {
					const detailsRow = tbody
						.insert('tr', function (this: HTMLTableSectionElement) {
							const index = Array.from(this.children).indexOf(tr.node()!)
							return this.children[index + 1] || null
						})
						.attr('id', detailsRowID)
					const detailsTable = detailsRow
						.append('td')
						.attr('colspan', '4')
						.append('div')
						.append('table')
						.style('width', '100%')
						.style('border-collapse', 'collapse')
					const detailsThead = detailsTable.append('thead')
					const detailsHeaderRow = detailsThead
						.append('tr')
						.style('background-color', '#e0e0e0')
						.style('border-bottom', '1px solid #ccc')
					expandableHeaders.forEach(header => {
						detailsHeaderRow
							.append('th')
							.style('padding', '8px')
							.style('text-align', 'left')
							.style('font-weight', '500')
							.text(header)
					})
					const detailsTbody = detailsTable.append('tbody')
					row.studiesList.forEach(study => {
						const studyRow = detailsTbody.append('tr').style('border-bottom', '1px solid #eee')
						studyRow
							.append('td')
							.style('padding', '8px')
							.text(study.StudyInstanceUID || 'N/A')
						studyRow
							.append('td')
							.style('padding', '8px')
							.text(study.collectionId || 'N/A')
						studyRow
							.append('td')
							.style('padding', '8px')
							.text(study.StudyDate || 'N/A')
						studyRow
							.append('td')
							.style('padding', '8px')
							.text(study.StudyDescription || 'N/A')
						const histoCell = studyRow.append('td').style('padding', '8px')
						if (study.hasWSI) {
							histoCell
								.append('a')
								.text('Open Study')
								.attr('href', `https://viewer.imaging.datacommons.cancer.gov/slim/studies/${study.StudyInstanceUID}`)
								.style('color', 'green')
								.style('font-size', '16px')
								.attr('title', 'WSI available')
						} else {
							histoCell
								.append('span')
								.text('\u2717')
								.style('color', 'red')
								.style('font-size', '16px')
								.attr('title', 'No WSI')
						}
						const radioCell = studyRow.append('td').style('padding', '8px')
						if (study.hasRadiology) {
							radioCell
								.append('a')
								.text('Open Study')
								.attr(
									'href',
									`https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=${study.StudyInstanceUID}`
								)
								.style('color', 'green')
								.style('font-size', '16px')
								.attr('title', 'Radiology available')
						} else {
							radioCell
								.append('span')
								.text('\u2717')
								.style('color', 'red')
								.style('font-size', '16px')
								.attr('title', 'No Radiology')
						}
					})
				} else {
					holder.select(`#${detailsRowID}`).remove()
				}
			})
		studyCellButton.style('cursor', 'pointer')
		const studyCellDiv = studyCellButton.append('div')
		// studyCellDiv.append('span').text('\u25BC')
		studyCellDiv
			.append('span')
			.text(`${row.studiesCount} IDC study (${row.wsiCount} Histopathology + ${row.radiologyCount} Radiology)`)
	})
}
