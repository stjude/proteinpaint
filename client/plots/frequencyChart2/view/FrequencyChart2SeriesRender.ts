import { SeriesRender } from '../../runChart2/view/SeriesRender.ts'
import { table2col } from '#dom'

/**
 * FrequencyChart2 tooltip: x-axis label + sample count only (no y value).
 */
export class FrequencyChart2SeriesRender extends SeriesRender {
	showHoverTip(event: any, d: any) {
		const tip = this.runChart2?.dom?.hovertip
		if (!tip) return
		const cfg = this.runChart2?.state?.config
		const xTermName = cfg?.tw?.term?.name ?? 'Period'
		tip.clear()
		const table = table2col({ holder: tip.d.append('div') })
		if (this.series.seriesId) table.addRow('Period', this.series.seriesId)
		table.addRow(xTermName, d.xName ?? String(d.x))
		table.addRow('Sample Count', String(d.sampleCount ?? ''))
		tip.show(event.clientX, event.clientY)
	}
}
