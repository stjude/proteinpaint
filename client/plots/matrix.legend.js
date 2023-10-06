import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10, interpolateReds, interpolateBlues } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'

export function getLegendData(legendGroups, refs) {
	const s = this.settings.matrix
	const legendData = []
	const dvt = this.config.divideBy || {}
	const dvtId = dvt && 'id' in dvt ? dvt.id : dvt.name
	for (const $id in legendGroups) {
		const legend = legendGroups[$id]
		if ($id == 'Consequences') {
			const keys = Object.keys(legend.values)
			if (!keys.length) continue
			legendData.unshift({
				name: 'Consequences',
				order: legend.order,
				$id: legend.$id,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples.size
					return {
						termid: 'Consequences',
						key: item.key,
						text: this.getLegendItemText(item, count, {}, s),
						color: item.fill,
						order: i,
						border: '1px solid #ccc',
						count,
						isLegendItem: true,
						dt: item.dt,
						crossedOut: item.crossedOut,
						origin: item.origin
					}
				})
			})

			// sort the legend by name
			legendData[0].items.sort((a, b) => (a.text < b.text ? -1 : 1))
			continue
		}

		const t =
			$id == dvtId
				? { tw: dvt }
				: this.termOrder.find(t => t.tw.$id == $id || t.tw.legend?.group == $id) || {
						tw: { term: { id: $id, name: $id, type: $id === 'CNV' ? 'geneVariant' : '' } }
				  }
		const keys = Object.keys(legend.values).sort((a, b) => legend.values[a].order - legend.values[b].order)
		const hasScale = Object.values(legend.values).find(v => v.scale)
		if (hasScale) {
			legendData.push({
				name: $id,
				order: legend.order,
				$id: legend.$id,
				hasScale,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples?.size
					if (item.scale) {
						return {
							termid: $id,
							key: item.key,
							text: this.getLegendItemText(item, count, t, s),
							width: 100,
							scale: item.scale,
							domain: item.domain,
							minLabel: item.minLabel,
							maxLabel: item.maxLabel,
							order: 'order' in item ? item.order : i,
							count,
							isLegendItem: true,
							dt: item.dt,
							crossedOut: item.crossedOut,
							origin: item.origin
						}
					} else {
						return {
							termid: $id,
							key: item.key,
							text: this.getLegendItemText(item, count, t, s),
							color: item.fill || this.colorScaleByTermId[$id](key),
							order: 'order' in item ? item.order : i,
							count,
							isLegendItem: true,
							dt: item.dt,
							crossedOut: item.crossedOut,
							origin: item.origin
						}
					}
				})
			})
		} else {
			const grp = $id
			const term = t.tw.term
			const ref = legend.ref
			if (ref.bins)
				keys.sort((a, b) => ref.bins.findIndex(bin => bin.name === a) - ref.bins.findIndex(bin => bin.name === b))
			else if (ref.keyOrder) keys.sort((a, b) => ref.keyOrder.indexOf(a) - ref.keyOrder.indexOf(b))

			if (!this.colorScaleByTermId[grp])
				this.colorScaleByTermId[grp] =
					keys.length < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)

			const name = t.tw.legend?.group || t.tw.label || term.name
			legendData.push({
				name: name.length < s.rowlabelmaxchars ? name : name.slice(0, s.rowlabelmaxchars) + '...',
				order: legend.order,
				$id: legend.$id,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples?.size
					return {
						$id,
						termid: term.id,
						key: item.key,
						text: this.getLegendItemText(item, count, t, s),
						color: t.scale || item.fill || this.colorScaleByTermId[grp](key),
						order: 'order' in item ? item.order : i,
						count,
						isExcluded: item.isExcluded,
						//onClickCallback: this.handleLegendItemClick,
						isLegendItem: true,
						dt: item.dt,
						crossedOut: item.crossedOut,
						origin: item.origin
					}
				})
			})
		}
	}

	return legendData.sort((a, b) => (a.order && b.order ? a.order - b.order : a.order ? -1 : b.order ? 1 : 0))
}

export function getLegendItemText(item, count, t, s) {
	let text = item.label
	const notes = [count]
	if (item.isExcluded) notes.push('hidden')
	if (t?.tw?.term?.type == 'geneVariant' && s.geneVariantCountSamplesSkipMclass.includes(item.key))
		notes.push('not counted')
	if (!notes.length) return text
	return (text += ` (${notes.join(', ')})`)
}
