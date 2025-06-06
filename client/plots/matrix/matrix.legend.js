import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10, interpolateReds, interpolateBlues } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { mclass, dt2label, morigin, dtsnvindel, dtcnv } from '#shared/common.js'
import { isNumericTerm } from '#shared/terms.js'

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
				if (f.tvs.legendFilterType == 'geneVariant_soft' && f.filteredOutCats.length == 0) {
					// when the soft legend filter doesn't filter out any value, do not generate the greyed-out legend for it
					continue
				}
				for (const v of f.tvs.values) {
					for (const key of v.mclasslst) {
						const legendk = v.origin ? v.origin + key : key
						legend.values[legendk] = {
							key,
							dt: v.dt,
							origin: v.origin,
							label: v.label || self.mclass[key].label,
							fill: v.color || self.mclass[key]?.color,
							order: CNVkey2order(key),
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
					// need to push all the dt to legend group, even when the legend item is hidden or filtered out
					if (legend.dt && !legend.dt.includes(v.dt)) legend.dt.push(v.dt)
					if (f.tvs.legendFilterType == 'geneVariant_soft' && f.filteredOutCats.length == 0) {
						// when the soft legend filter doesn't filter out any value, do not generate the greyed-out legend for it
						continue
					}
					for (const key of v.mclasslst) {
						const legendk = v.origin ? v.origin + key : key
						legend.values[legendk] = {
							key,
							dt: v.dt,
							origin: v.origin,
							label: v.label || self.mclass[key]?.label || 'Gain and loss',
							fill: v.color || self.mclass[key]?.color,
							order: CNVkey2order(key),
							crossedOut: f.tvs.legendFilterType == 'geneVariant_hard' ? true : false,
							greyedOut: f.tvs.legendFilterType == 'geneVariant_soft' ? true : false
						}
					}
				}
			} else {
				if (isNumericTerm(f.tvs.term)) {
					// create a legend only if the mode is discrete, no legend created for continuous mode
					if (t.ref?.bins) {
						for (const v of f.tvs.ranges) {
							const termValues = t.ref.bins
							legend.values[v.name] = {
								key: v.name,
								label: termValues?.find(vl => vl.name == v.name)?.name || v.name,
								fill: termValues?.find(vl => vl.name == v.name)?.color,
								crossedOut: true
							}
						}
					}
				} else if (f.tvs.term.type == 'survival') {
					for (const v of f.tvs.values) {
						const termValues = t.tw.term.values
						legend.values[v.key] = {
							key: v.key,
							label: termValues?.[v.key]?.label || 'Exit code: ' + v.key,
							fill: v.key == 1 ? '#ff7f0e' : '#1f77b4',
							crossedOut: true
						}
					}
				} else {
					for (const v of f.tvs.values) {
						const termValues = t.tw.term.values
						legend.values[v.key] = {
							key: v.key,
							label: termValues?.[v.key]?.label || v.key,
							fill: termValues?.[v.key]?.color,
							crossedOut: true
						}
					}
				}
			}
		}

		const keys = Object.keys(legend.values).sort()
		const hasScale = Object.values(legend.values).find(v => v.scale)
		if (hasScale) {
			if (legend === legendGroups?.CNV) {
				/** Combine gain and loss here to avoid rendering issues */
				const gain = legend.values['CNV_amp']
				const loss = legend.values['CNV_loss']

				if (gain?.scale && loss?.scale) {
					// could use either gain or loss since matrix.cells use the same logic for both t objects
					const colors = loss.scales?.legend.range
					const domain = loss.scales?.legend.domain

					const setLegendAttr = item => {
						return {
							$id,
							domain: item.scales.legend.domain,
							key: item.key,
							isLegendItem: true,
							minLabel: domain[0], //item.minLoss, // item.maxLabel,
							maxLabel: domain.slice(-1)[0], //item.maxGain, // item.maxLabel,
							scale: item.scale,
							termid: 'CNV'
						}
					}

					legend.values.CNV_gain_loss = {
						key: $id,
						label: 'Gain and Loss',
						dt: dtcnv,
						order: -1,
						domain,
						name: 'CNV gain/loss',
						scale: scaleLinear().domain(domain).range(colors),
						minLabel: domain[0], //loss.maxLabel,
						maxLabel: domain.slice(-1)[0],
						labels: { left: 'Loss', right: 'Gain' },
						parents: [Object.assign(setLegendAttr(loss), loss), Object.assign(setLegendAttr(gain), gain)],
						samples: new Set([...gain.samples, ...loss.samples])
					}
					delete legend.values[gain.key]
					delete legend.values[loss.key]
					keys.splice(keys.indexOf(gain.key), 1)
					keys.splice(keys.indexOf(loss.key), 1)
					keys.push('CNV_gain_loss')
				}
			}

			const legendGrpLabelMaxChars = s.legendGrpLabelMaxChars || 26
			legendData.push({
				name: $id.length < legendGrpLabelMaxChars ? $id : $id.slice(0, legendGrpLabelMaxChars) + '...',
				//name:$id,
				order: legend.order,
				$id: legend.$id,
				dt: legend.dt,
				origin: legend.origin,
				hasScale,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples?.size
					if (item.scale) {
						// a legend item with scale, that has not been combined as CNV_gain_loss above
						const colors = item.scales?.legend?.range || getColors(item)
						const domain =
							item.scales?.legend?.domain || setColorScaleDomain(item.minLabel, item.maxLabel, item.domain, colors)
						return {
							termid: $id,
							key: item.key,
							text: this.getLegendItemText(item, count, t, s),
							width: 100,
							scale: item.scale,
							colors,
							domain,
							order: 'order' in item ? item.order : i,
							count,
							isLegendItem: true,
							dt: item.dt,
							crossedOut: item.crossedOut,
							greyedOut: item.greyedOut,
							origin: item.origin,
							parents: item.parents,
							labels: item.labels
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
			const legendGrpLabelMaxChars = s.legendGrpLabelMaxChars || 26
			legendData.push({
				name: name.length < legendGrpLabelMaxChars ? name : name.slice(0, legendGrpLabelMaxChars) + '...',
				order: legend.order,
				$id: legend.$id,
				dt: legend.dt,
				origin: legend.origin,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					const count = item.samples?.size
					return {
						$id,
						termid: term.id || term.name,
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

	for (const grpFilter of self.config.legendGrpFilter.lst) {
		if (
			grpFilter.dt.length == 1 &&
			grpFilter.dt[0] == 4 &&
			!legendData.filter(l => l.dt)?.find(l => l.dt.length == 1 && l.dt[0] == 4)
		) {
			legendData.push({
				name: 'CNV',
				dt: grpFilter.dt,
				origin: grpFilter.origin,
				crossedOut: true,
				items: grpFilter.filteredOutCats.map(fc => {
					return {
						dt: 4,
						termid: 'CNV',
						origin: grpFilter.origin,
						key: fc,
						text: self.mclass[fc].label,
						color: self.mclass[fc]?.color,
						isLegendItem: true
					}
				})
			})
		} else if (grpFilter.dt.includes(dtsnvindel)) {
			const controlLabels = self.settings.matrix.controlLabels
			const groupName = grpFilter.origin
				? `${grpFilter.origin[0].toUpperCase() + grpFilter.origin.slice(1)} ${controlLabels.Mutations}`
				: controlLabels.Mutations
			if (!legendData.filter(l => l.dt)?.find(l => l.dt.includes(dtsnvindel) && l.origin == grpFilter.origin)) {
				legendData.push({
					name: groupName,
					dt: grpFilter.dt,
					origin: grpFilter.origin,
					crossedOut: true,
					items: grpFilter.filteredOutCats.map(fc => {
						return {
							dt: self.mclass[fc].dt,
							origin: grpFilter.origin,
							termid: groupName,
							key: fc,
							text: self.mclass[fc].label,
							color: self.mclass[fc]?.color,
							isLegendItem: true
						}
					})
				})
			}
		} else if (
			grpFilter.dt.length == 1 &&
			grpFilter.dt[0] == 2 &&
			!legendData.filter(l => l.dt)?.find(l => l.dt.length == 1 && l.dt[0] == 2)
		) {
			legendData.push({
				name: 'Fusion RNA',
				dt: grpFilter.dt,
				origin: grpFilter.origin,
				crossedOut: true,
				items: grpFilter.filteredOutCats.map(fc => {
					return {
						dt: 2,
						origin: grpFilter.origin,
						termid: 'Fusion RNA',
						key: fc,
						text: self.mclass[fc].label,
						color: self.mclass[fc]?.color,
						isLegendItem: true
					}
				})
			})
		} else if (
			grpFilter.dt.length == 1 &&
			grpFilter.dt[0] == 5 &&
			!legendData.filter(l => l.dt)?.find(l => l.dt.length == 1 && l.dt[0] == 5)
		) {
			legendData.push({
				name: 'Structural Variation',
				dt: grpFilter.dt,
				origin: grpFilter.origin,
				crossedOut: true,
				items: grpFilter.filteredOutCats.map(fc => {
					return {
						dt: 5,
						origin: grpFilter.origin,
						termid: 'Structural Variation',
						key: fc,
						text: self.mclass[fc].label,
						color: self.mclass[fc]?.color,
						isLegendItem: true
					}
				})
			})
		}
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
	return legendData.sort((a, b) =>
		a.crossedOut && b.crossedOut
			? 0
			: a.crossedOut
			? 1
			: b.crossedOut
			? -1
			: a.order && b.order
			? a.order - b.order
			: a.order
			? -1
			: b.order
			? 1
			: 0
	)
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

/** The domain in the legend item isn't always the actual data, required for the number line
 * on the axis. The ColorScale component in svg.legend requires the data[] and color[] arrays
 * to be the same length. Also the values in data[] appear along the number line and must
 * represent the actual data. This function creates the data[] array based on the colors[]
 * array using the min and max values.
 */
function setColorScaleDomain(min, max, domain, colors) {
	if (domain[0] === min && domain[domain.length - 1] === max) return domain

	const step = (max - min) / (colors.length - 1)

	return colors.map((_, i) => {
		if (i === (colors.length - 1) / 2 && min < 0 && max > 0) return 0
		return min + step * i
	})
}

function getColors(item) {
	return item.domain?.map(c => item.scale(c)) || item.scale.range()
}

export function CNVkey2order(key) {
	return key == 'CNV_homozygous_deletion'
		? -5
		: key == 'CNV_amplification'
		? -4
		: key == 'CNV_loss'
		? -3
		: key == 'CNV_amp'
		? -2
		: key == 'CNV_loh'
		? -1
		: 0
}
