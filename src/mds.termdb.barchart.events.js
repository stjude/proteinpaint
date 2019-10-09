import { event } from 'd3-selection'
import { Menu } from './client'

const tip = new Menu({ padding: '5px' })

export default function getHandlers(self) {
	const s = self.settings

	function triggerBarClickMenu() {
		const d = event.target.__data__ || event.target.parentNode.__data__
		// bar label data only has {id,label},
		// while bar data has all required data including seriesId
		const term1 = self.terms.term1
		const term2 = self.terms.term2 ? self.terms.term2 : null
		const uncomp_term1 = term1.values ? Object.values(term1.values).map(v=>v.label) : []
		const uncomp_term2 = term2 && term2.values ? Object.values(term2.values).map(v=>v.label) : []
		const term1unit = term1.unit && !uncomp_term1.includes(d.seriesId || d.id) ? ' ' + term1.unit : ''
		const term2unit = term2 && term2.unit && !uncomp_term2.includes(d.dataId || d.id) ? ' ' + term2.unit : ''
		const seriesLabel =
			(term1.values && d.seriesId in term1.values ? term1.values[d.seriesId].label : d.seriesId ? d.seriesId : d.id) +
			term1unit
		const dataLabel =
			(term2 && term2.values && d.dataId in term2.values ? term2.values[d.dataId].label : d.dataId ? d.dataId : d.id) +
			term2unit
		const icon = !term2
			? ''
			: "<div style='display:inline-block; width:14px; height:14px; margin: 2px 3px; vertical-align:top; background:" +
			  d.color +
			  "'>&nbsp;</div>"
		const header =
			`<div style='padding:2px'><b>${term1.name}</b>: ${seriesLabel}</div>` +
			(d.seriesId && term2 ? `<div style='padding:2px'><b>${term2.name}</b>: ${dataLabel} ${icon}</div>` : '')

		const data = d.seriesId || d.seriesId === 0 ? d : { seriesId: d.id }
		const termValues = getTermValues(data, self)
		const options = [
			{
				label: d.seriesId ? 'Hide "' + seriesLabel + '"' : 'Hide',
				callback: () => {
					self.settings.exclude.cols.push(d.seriesId === 0 ? 0 : d.seriesId || d.id)
					self.main()
				}
			}
		]
		if (d.dataId || d.dataId === 0) {
			options.push({
				label: 'Hide "' + dataLabel + '" ' + icon,
				callback: () => {
					self.settings.exclude.rows.push(d.dataId)
					self.main()
				}
			})
		}
		self.bus.emit('postClick', { header, termValues, options, x: event.clientX, y: event.clientY })
	}

	return {
		chart: {
			title(chart) {
				if (!self.terms.term0) return chart.chartId
				return self.terms.term0.values && chart.chartId in self.terms.term0.values
					? self.terms.term0.values[chart.chartId].label
					: chart.chartId
			}
		},
		svg: {
			mouseout: () => {
				tip.hide()
			}
		},
		series: {
			mouseover(d) {
				const term1 = self.terms.term1
				const term2 = self.terms.term2 ? self.terms.term2 : null
				const uncomp_term1 = term1.values ? Object.values(term1.values).map(v=>v.label) : []
				const uncomp_term2 = term2 && term2.values ? Object.values(term2.values).map(v=>v.label) : []
				const term1unit = term1.unit && !uncomp_term1.includes(d.seriesId) ? ' ' + term1.unit : ''
				const term2unit = term2 && term2.unit && !uncomp_term2.includes(d.dataId) ? ' ' + term2.unit : ''
				const seriesLabel =
					(term1.values && d.seriesId in term1.values ? term1.values[d.seriesId].label : d.seriesId) +
					term1unit
				const dataLabel =
					(term2 && term2.values && d.dataId in term2.values ? term2.values[d.dataId].label : d.dataId) +
					term2unit
				const icon = !term2
					? ''
					: "<div style='display:inline-block; width:14px; height:14px; margin: 2px 3px; vertical-align:top; background:" +
					  d.color +
					  "'>&nbsp;</div>"
				const rows = [`<tr><td colspan=2 style='padding:3px; text-align:center'>${seriesLabel}</td></tr>`]
				if (term2)
					rows.push(
						`<tr><td colspan=2 style='padding:3px; text-align:center'>${icon} <span>${dataLabel}</span></td></tr>`
					)
				rows.push(
					`<tr><td style='padding:3px; color:#aaa'>#Individuals</td><td style='padding:3px; text-align:center'>n=${d.total}</td></tr>`
				)
				if (!term1.iscondition && (!term2 || !term2.iscondition)) {
					rows.push(
						`<tr><td style='padding:3px; color:#aaa'>Percentage</td><td style='padding:3px; text-align:center'>${(
							(100 * d.total) /
							(term2 ? d.seriesTotal : d.chartTotal)
						).toFixed(1)}%</td></tr>`
					)
				}
				tip.show(event.clientX, event.clientY).d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
			},
			mouseout: () => {
				tip.hide()
			},
			rectFill(d) {
				return d.color
			},
			click: triggerBarClickMenu
		},
		colLabel: {
			text: d => {
				return self.terms.term1.values && 'id' in d && d.id in self.terms.term1.values
					? self.terms.term1.values[d.id].label
					: 'label' in d
					? d.label
					: d
			},
			click: triggerBarClickMenu,
			mouseover: () => {
				event.stopPropagation()
				tip.show(event.clientX, event.clientY).d.html('Click to hide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		rowLabel: {
			text: d => {
				return self.terms.term1.values && 'id' in d && d.id in self.terms.term1.values
					? self.terms.term1.values[d.id].label
					: 'label' in d
					? d.label
					: d
			},
			click: triggerBarClickMenu,
			mouseover: () => {
				event.stopPropagation()
				tip.show(event.clientX, event.clientY).d.html('Click to hide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		legend: {
			click: () => {
				event.stopPropagation()
				const d = event.target.__data__
				if (d === undefined) return
				if (d.type == 'col') {
					const i = self.settings.exclude.cols.indexOf(d.id)
					if (i == -1) return
					self.settings.exclude.cols.splice(i, 1)
					self.main()
				}
				if (d.type == 'row') {
					const i = self.settings.exclude.rows.indexOf(d.dataId)
					if (i == -1) {
						self.settings.exclude.rows.push(d.dataId)
					} else {
						self.settings.exclude.rows.splice(i, 1)
					}
					self.main()
				}
			},
			mouseover: () => {
				event.stopPropagation()
				tip.show(event.clientX, event.clientY).d.html('Click to unhide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		yAxis: {
			text: () => {
				if (s.orientation == 'vertical') {
					return s.unit == 'pct' ? '% of patients' : '# of patients'
				} else {
					const term = self.terms.term1
					return term.iscondition && self.plot.term.q.value_by_max_grade
						? 'Maximum grade'
						: term.iscondition && self.plot.term.q.value_by_most_recent
						? 'Most recent grade'
						: term.iscategorical || !term.unit
						? ''
						: term.unit //term.name[0].toUpperCase() + term.name.slice(1)
				}
			}
		},
		xAxis: {
			text: () => {
				if (s.orientation == 'vertical') {
					const term = self.terms.term1
					const q1 = term.q
					return term.iscondition && q1.bar_by_grade && q1.value_by_max_grade
						? 'Maximum grade'
						: term.iscondition && q1.bar_by_grade && q1.value_by_most_recent
						? 'Most recent grades'
						: term.iscategorical || !term.unit
						? ''
						: term.unit // term.name[0].toUpperCase() + term.name.slice(1)
				} else {
					return s.unit == 'pct' ? '% of patients' : '# of patients'
				}
			}
		}
	}
}

function getTermValues(d, self) {
	/*
    d: clicked bar data
    callback
  */

	const termValues = []
	self.terms.term0 = self.plot.term0 ? self.plot.term0.term : null
	self.terms.term1 = self.plot.term.term
	self.terms.term2 = self.plot.term2 ? self.plot.term2.term : null
	for (const termNum of ['term0', 'term', 'term2']) {
		const term = self.plot[termNum]
		// always exclude term0 value for now
		if (termNum == 'term0' || !term) continue
		const key = termNum == 'term' ? d.seriesId : d.dataId
		if (!key && key !== 0) continue
		const q = term ? term.q : {}
		const label = !term || !term.term.values ? key : key in term.term.values ? term.term.values[key].label : key

		if (term.term.iscondition) {
			if (termNum == 'term0' || !self.terms.term2 || self.terms.term1.id != self.terms.term2.id) {
				termValues.push(
					Object.assign(
						{
							term: term.term,
							values: [{ key, label }]
						},
						q
					)
				)
			}

			if (termNum == 'term' && self.terms.term2 && term.term.id == self.terms.term2.id) {
				const q2 = self.plot.term2.q
				const term2Label =
					self.terms.term2.values && d.dataId in self.terms.term2.values
						? self.terms.term2.values[d.dataId].label
						: d.dataId

				termValues.push(
					Object.assign(
						{
							term: term.term,
							grade_and_child: [
								{
									grade: q2.bar_by_grade ? d.dataId : key,
									grade_label: q2.bar_by_grade ? term2Label : label,
									child_id: q2.bar_by_children ? d.dataId : key,
									child_label: q2.bar_by_children ? term2Label : label
								}
							]
						},
						q2
					)
				)
			}
		} else {
			const bins = term.bins
			if (!bins || !bins.length) {
				// not associated with numeric bins
				termValues.push({ term: term.term, values: [{ key, label }] })
			} else {
				const range = bins.find(d => d.label == label || d.name == label)
				if (range) termValues.push({ term: term.term, ranges: [range] })
				else if (termNum == 'term' && d.unannotatedSeries) {
					termValues.push({ term: term.term, ranges: [{ value: d.unannotatedSeries.value, label }] })
				} else if (termNum == 'term2' && d.unannotatedData) {
					termValues.push({ term: term.term, ranges: [{ value: d.unannotatedData.value, label }] })
				} else if (q && q.binconfig && q.binconfig.unannotated) {
					for (const id in q.binconfig.unannotated._labels) {
						const _label = q.binconfig.unannotated._labels[id]
						if (_label == label) termValues.push({ term: term.term, ranges: [{ value: id, label }] })
					}
				}
			}
		}
	}
	return termValues
}
