import type { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import type { Annotation } from '@sjcrh/proteinpaint-types'
import { buildAnnotationsCsv } from '#plots/wsiviewer/interactions/annotationsCsv.ts'

export class DownloadCSVButtonRenderer {
	constructor() {}

	render(holder: any, sessionWSImage: SessionWSImage | undefined) {
		if (!holder) return
		// create button (styling similar to other controls)
		const btn = holder
			.append('div')
			.style('margin', '20px 0 0 0')
			.append('button')
			.attr('type', 'submit')
			.style('font-size', '1.25em')
			.style('padding', '10px 25px')
			.style('border-radius', '20px')
			.style('border', '1px solid black')
			.style('background-color', 'transparent')
			.style('margin', '0 10px')
			.style('cursor', 'pointer')
			.text('Export Annotations')

		btn.on('click', () => {
			if (!sessionWSImage) {
				// nothing to export
				return
			}
			this.downloadAllAsCsv(sessionWSImage)
		})
	}

	private downloadAllAsCsv(sessionWSImage: SessionWSImage) {
		const annotations: Annotation[] = (sessionWSImage.annotations || []) as Annotation[]

		if (!Array.isArray(annotations) || annotations.length === 0) {
			const fileBase = ((sessionWSImage as any).filename || 'annotations').toString().replace(/\.\w+$/, '')
			const filename = `${fileBase}_annotations.csv`
			this.triggerDownload(filename, '')
			return
		}

		// use shared CSV builder; prefer session filename for every row
		const fileNameForRow = (sessionWSImage as any).filename ?? ''
		const csv = buildAnnotationsCsv(annotations as any[], fileNameForRow)

		const fileBase = ((sessionWSImage as any).filename || 'annotations').toString().replace(/\.\w+$/, '')
		const filename = `${fileBase}_annotations.csv`
		this.triggerDownload(filename, csv)
	}

	private triggerDownload(filename: string, content: string) {
		const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	}
}
