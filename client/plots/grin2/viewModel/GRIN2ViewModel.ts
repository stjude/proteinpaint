import { dt2lesion } from '#shared/common.js'
import type { GRIN2Response, GRIN2ViewData, DtUsage } from '../GRIN2Types'

/** Transforms a GRIN2 server response into display-ready ViewData.
 *  All conditional shaping (significance circles, header text)
 *  lives here so the View stays a thin renderer. */
export class GRIN2ViewModel {
	viewData: GRIN2ViewData

	constructor(response: GRIN2Response, manhattanSettings: any, dtUsage: DtUsage) {
		this.viewData = {
			manhattan: response.pngImg ? { plotData: response, settings: manhattanSettings } : null,
			topGenes: this.buildTopGenes(response, manhattanSettings, dtUsage),
			statsSections: response.stats?.lst || []
		}
	}

	private buildTopGenes(response: GRIN2Response, manhattanSettings: any, dtUsage: DtUsage): GRIN2ViewData['topGenes'] {
		if (!response.topGeneTable || !response.stats?.lst) return null

		// "showing N of M": N = genes actually in the table, M = total genes GRIN tested. Look up the
		// total-genes cell by label rather than positional index (rows[0]) so reordering the Summary
		// rows can't silently turn this into a wrong/sample count.
		const totalGenes = response.stats.lst[0].rows.find((r: any) => r[0] === 'Total Genes')?.[1] ?? '?'
		const headerText = `Top Genes (showing ${response.topGeneTable.rows.length.toLocaleString()} of ${totalGenes})`

		const qValueEntries = this.buildQValueEntries(response.topGeneTable.columns, dtUsage)
		const lesionTypeCircleCache = this.buildCircleCache(manhattanSettings.lesionTypeColors)
		const qValueThreshold = manhattanSettings.qValueThreshold

		const rows = response.topGeneTable.rows.map((row: any) => {
			const circles = qValueEntries
				.filter(({ colIndex }) => {
					const qValue = row[colIndex]?.value
					return typeof qValue === 'number' && qValue < qValueThreshold
				})
				.map(({ type }) => lesionTypeCircleCache.get(type)!)
			return [{ value: '', html: circles.join('') }, ...row]
		})

		return {
			headerText,
			columns: [{ label: '', width: '20px' }, ...response.topGeneTable.columns],
			rows,
			dataItems: response.topGeneTable.rows
		}
	}

	private buildQValueEntries(columns: { label: string }[], dtUsage: DtUsage): { colIndex: number; type: string }[] {
		const dtMapping: Record<string, { col: string; type: string }[]> = {}
		Object.entries(dt2lesion).forEach(([dt, cfg]: [string, any]) => {
			dtMapping[dt] = cfg.lesionTypes.map((lt: any) => ({
				col: `Q-value (${lt.name})`,
				type: lt.lesionType
			}))
		})

		const entries: { colIndex: number; type: string }[] = []
		Object.entries(dtUsage).forEach(([key, info]: [string, any]) => {
			// dtUsage values may be either { checked: bool } objects or bare booleans depending on call site
			const isChecked = typeof info === 'object' ? info?.checked : !!info
			if (isChecked && dtMapping[key]) {
				dtMapping[key].forEach(({ col, type }) => {
					const colIndex = columns.findIndex(c => c.label === col)
					if (colIndex !== -1) entries.push({ colIndex, type })
				})
			}
		})
		return entries
	}

	private buildCircleCache(lesionTypeColors: Record<string, string>): Map<string, string> {
		return new Map(
			Object.entries(lesionTypeColors).map(([type, color]) => [
				type,
				`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${color};margin-right:3px;"></span>`
			])
		)
	}
}
