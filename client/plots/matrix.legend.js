import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10, interpolateReds, interpolateBlues } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { mclass, dt2label, morigin } from '#shared/common'

export function getLegendData(legendGroups, refs, self) {
	const s = this.settings.matrix
	const legendData = []
	const dvt = this.config.divideBy || {}
	const dvtId = dvt && 'id' in dvt ? dvt.id : dvt.name
	for (const $id in legendGroups) {
		const legend = legendGroups[$id]
		if ($id == 'Consequences') {
			for (const f of this.config.legendValueFilter.lst) {
				if (f.tvs.term.type !== 'geneVariant') continue
				if (f.legendGrpName != $id) continue
				for (const v of f.tvs.values) {
					for (const key of v.mclasslst) {
						const legendk = v.origin ? v.origin + key : key
						legend.values[legendk] = {
							key,
							dt: v.dt,
							origin: v.origin,
							label: v.label || self.mclass[key].label,
							fill: v.color || self.mclass[key]?.color,
							order: key == 'CNV_loss' ? -2 : key.startsWith('CNV_') ? -1 : 0,
							crossedOut: f.tvs.legendFilterType == 'geneVariant_hard' ? true : false,
							greyedOut: f.tvs.legendFilterType == 'geneVariant_soft' ? true : false
						}
					}
				}
			}

			const keys = Object.keys(legend.values)
			if (!keys.length) continue
			legendData.unshift({
				name: 'Consequences',
				order: legend.order,
				$id: legend.$id,
				dt: legend.dt,
				origin: legend.origin,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples?.size
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
						greyedOut: item.greyedOut,
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

		for (const f of this.config.legendValueFilter.lst) {
			const name = t.tw.legend?.group || t.tw.label || t.tw.term.name

			if (f.legendGrpName != $id && f.legendGrpName != name && f.tvs.term.name != name) continue
			if (f.tvs.term.type == 'geneVariant') {
				for (const v of f.tvs.values) {
					for (const key of v.mclasslst) {
						const legendk = v.origin ? v.origin + key : key
						legend.values[legendk] = {
							key,
							dt: v.dt,
							origin: v.origin,
							label: v.label || self.mclass[key].label,
							fill: v.color || self.mclass[key]?.color,
							order: key == 'CNV_loss' ? -2 : key.startsWith('CNV_') ? -1 : 0,
							crossedOut: f.tvs.legendFilterType == 'geneVariant_hard' ? true : false,
							greyedOut: f.tvs.legendFilterType == 'geneVariant_soft' ? true : false
						}
					}
				}
			} else {
				if (f.tvs.term.type == 'integer' || f.tvs.term.type == 'float') {
					if (t.ref?.bins) {
						for (const v of f.tvs.ranges) {
							const termValues = Object.values(t.ref.bins)
							legend.values[v.name] = {
								key: v.name,
								label: termValues.find(vl => vl.name == v.name)?.name || v.name,
								fill: termValues.find(vl => vl.name == v.name)?.color,
								crossedOut: true
							}
						}
					}
				} else {
					for (const v of f.tvs.values) {
						const termValues = Object.values(t.tw.term.values)
						legend.values[v.key] = {
							key: v.key,
							label: termValues.find(vl => vl.key == v.key)?.label || v.key,
							fill: termValues.find(vl => vl.key == v.key)?.color,
							crossedOut: true
						}
					}
				}
			}
		}

		const keys = Object.keys(legend.values).sort()
		const hasScale = Object.values(legend.values).find(v => v.scale)
		if (hasScale) {
			legendData.push({
				name: $id,
				order: legend.order,
				$id: legend.$id,
				dt: legend.dt,
				origin: legend.origin,
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
							greyedOut: item.greyedOut,
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
							greyedOut: item.greyedOut,
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
				dt: legend.dt,
				origin: legend.origin,
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
						greyedOut: item.greyedOut,
						origin: item.origin
					}
				})
			})
		}
	}

	for (const f of this.config.legendGrpFilter.lst) {
		legendData.push(f.legendData)
	}

	// sort the items in legend groups, put greyedOut and crossedOut items to the end
	for (const itemsGrp of legendData) {
		itemsGrp.items.sort((a, b) => {
			const getStatusOrder = item => {
				if (!item.greyedOut && !item.crossedOut) return 0
				if (item.greyedOut && !item.crossedOut) return 1
				if (item.crossedOut) return 2
				return 3
			}
			return getStatusOrder(a) - getStatusOrder(b)
		})
	}
	return legendData.sort((a, b) => (a.order && b.order ? a.order - b.order : a.order ? -1 : b.order ? 1 : 0))
}

export function getLegendItemText(item, count, t, s) {
	if (item.crossedOut || item.greyedOut) {
		// when the legend is crossed out
		return item.label
	}
	let text = item.label
	const notes = [count]
	if (item.isExcluded) notes.push('hidden')
	if (t?.tw?.term?.type == 'geneVariant' && s.geneVariantCountSamplesSkipMclass.includes(item.key))
		notes.push('not counted')
	if (!notes.length) return text
	return (text += ` (${notes.join(', ')})`)
}
