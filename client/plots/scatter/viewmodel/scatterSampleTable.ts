import { mclass } from '#shared/common.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getDateStrFromNumber } from '#shared/terms.js'
import { SINGLECELL_GENE_EXPRESSION } from '#types'

/** One row per sample, one column per term in play. Shared by the hover tooltip / click menu
 * (scatterTooltip) and the lasso's group table (scatterLasso), which listed the same samples
 * with the same columns and had drifted into two copies — the lasso's read raw `d[category]`
 * while the tooltip's ran the values through getCategoryValue(). Both now format. */

/** Reads the display value a sample carries for one plot dimension.
 *
 * `category` is the key on the sample object, not a term id: 'x' | 'y' | 'category' (color) |
 * 'shape' | 'scale'. `tw` is the matching term wrapper, used only to decide formatting.
 */
export function getCategoryValue(category, d, tw, includeMutation = false) {
	if (category == '') return ''
	let value = d[category]
	if (tw?.term.type == 'geneVariant' && tw.q?.type == 'values') {
		const mutation = value.split(', ')[0]
		for (const id in mclass) {
			const class_info = mclass[id]
			if (mutation == class_info.label) {
				const mname = d.cat_info[category].find(m => m.class == class_info.key).mname
				if (mname && includeMutation) value = `${mname} ${value}`
			}
		}
	}
	if (tw?.term.type == 'date') value = getDateStrFromNumber(value)
	/** Not all scge terms will have a geneExp value, such as when the scge term
	 * is a coordTW. When no geneExp value, value = d[category] is the correct value. */ else if (
		tw?.term.type == SINGLECELL_GENE_EXPRESSION &&
		Number.isFinite(d.geneExp)
	) {
		value = roundValueAuto(d.geneExp)
	} else if (typeof value == 'number' && value % 1 != 0) value = roundValueAuto(value)
	return value
}

/** Builds `{columns, rows}` in the shape both renderTable and showResultsTable accept.
 * Columns are included only when the plot actually has that term, and the sample-name and
 * Info columns only when at least one row can fill them. */
export function buildSampleTableData(config, itemLabel: string, samples: any[]) {
	const hasName = samples.some(d => d.sample || d.cellId)
	const hasInfo = samples.some(d => 'info' in d)

	const dims: { tw: any; key: string; sortable?: boolean }[] = [
		{ tw: config.term, key: 'x' },
		{ tw: config.term2, key: 'y' },
		{ tw: config.colorTW, key: 'category' },
		{ tw: config.shapeTW, key: 'shape' },
		{ tw: config.scaleDotTW, key: 'scale', sortable: true }
	].filter(d => d.tw)

	const columns: any[] = []
	if (hasName) columns.push({ label: config.controlLabels?.Sample || itemLabel })
	for (const d of dims) columns.push(d.sortable ? { label: d.tw.term.name, sortable: true } : { label: d.tw.term.name })
	if (hasInfo) columns.push({ label: 'Info' })

	const rows = samples.map(s => {
		const row: any[] = []
		if (hasName) row.push({ value: s.sample || s.cellId || '' })
		for (const d of dims) row.push({ value: getCategoryValue(d.key, s, d.tw) })
		if (hasInfo)
			row.push({
				value:
					'info' in s
						? Object.entries(s.info)
								.map(([k, v]) => `${k}: ${v}`)
								.join(', ')
						: ''
			})
		return row
	})
	return { columns, rows }
}
