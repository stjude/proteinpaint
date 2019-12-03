import { event } from 'd3-selection'
import { Menu } from '../client'

const tip = new Menu({ padding: '5px' })

export default function getHandlers(self) {
	const s = self.settings

	return {
		chart: {
			title(chart) {
				if (!self.config.term0) return chart.chartId
				return self.config.term0.values && chart.chartId in self.config.term0.values
					? self.config.term0.values[chart.chartId].label
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
				const t1 = self.config.term.term
				const t2 = self.config.term2 && self.config.term2.term
				const term1unit = t1.unit
				const seriesLabel =
					(t1.values && d.seriesId in t1.values ? t1.values[d.seriesId].label : d.seriesId) +
					(t1.unit ? ' ' + t1.unit : '')
				const dataLabel =
					(t2 && t2.values && d.dataId in t2.values ? t2.values[d.dataId].label : d.dataId) +
					(t2 && t2.unit ? ' ' + t2.unit : '')
				const icon = !t2
					? ''
					: "<div style='display:inline-block; width:14px; height:14px; margin: 2px 3px; vertical-align:top; background:" +
					  d.color +
					  "'>&nbsp;</div>"
				const rows = [`<tr><td colspan=2 style='padding:3px; text-align:center'>${seriesLabel}</td></tr>`]
				if (t2)
					rows.push(
						`<tr><td colspan=2 style='padding:3px; text-align:center'>${icon} <span>${dataLabel}</span></td></tr>`
					)
				rows.push(
					`<tr><td style='padding:3px; color:#aaa'>#Individuals</td><td style='padding:3px; text-align:center'>n=${d.total}</td></tr>`
				)
				if (!t1.iscondition && (!t2 || !t2.iscondition)) {
					rows.push(
						`<tr><td style='padding:3px; color:#aaa'>Percentage</td><td style='padding:3px; text-align:center'>${(
							(100 * d.total) /
							(t2 ? d.seriesTotal : d.chartTotal)
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
			click: self.opts.bar_click_override
				? d => self.opts.bar_click_override(getTermValues(d, self))
				: d => handle_click(self, d)
		},
		colLabel: {
			text: d => {
				return self.config.term.values && 'id' in d && d.id in self.config.term.values
					? self.config.term.values[d.id].label
					: 'label' in d
					? d.label
					: d
			},
			click: () => {
				const d = event.target.__data__
				if (d === undefined) return
				const term = self.config.term
				const q = JSON.parse(JSON.stringify(term.q))
				if (!q.hiddenValues) q.hiddenValues = {}
				q.hiddenValues[d.id] = 1
				self.app.dispatch({
					type: 'plot_edit',
					id: term.id,
					config: {
						term: {
							id: term.id,
							term: term.term,
							q
						}
					}
				})
			},
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
				return self.config.term.values && 'id' in d && d.id in self.config.term.values
					? self.config.term.values[d.id].label
					: 'label' in d
					? d.label
					: d
			},
			click: () => {
				const d = event.target.__data__
				if (d === undefined) return
				const term = self.config.term
				const q = JSON.parse(JSON.stringify(term.q))
				if (!q.hiddenValues) q.hiddenValues = {}
				q.hiddenValues[d.id] = 1
				self.app.dispatch({
					type: 'plot_edit',
					id: term.id,
					config: {
						term: {
							id: term.id,
							term: term.term,
							q
						}
					}
				})
			},
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

				const term = d.type == 'col' ? self.config.term : self.config.term2
				const q = JSON.parse(JSON.stringify(term.q))
				if (!q.hiddenValues) q.hiddenValues = {}
				if (!q.hiddenValues[d.id]) {
					q.hiddenValues[d.id] = 1
				} else {
					delete q.hiddenValues[d.id]
				}

				self.app.dispatch({
					type: 'plot_edit',
					id: term.id,
					config: {
						term: {
							id: term.id,
							term: term.term,
							q
						}
					}
				})
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
					const term = self.config.term
					return term.iscondition && self.config.term.q.value_by_max_grade
						? 'Maximum grade'
						: term.iscondition && self.config.term.q.value_by_most_recent
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
					const term = self.config.term
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

function handle_click(self) {
	const d = event.target.__data__ || event.target.parentNode.__data__
	// bar label data only has {id,label},
	// while bar data has all required data including seriesId
	const term1 = self.config.term.term
	const term2 = self.config.term2 ? self.config.term2 : null
	const uncomp_term1 = term1.values ? Object.values(term1.values).map(v => v.label) : []
	const uncomp_term2 = term2 && term2.values ? Object.values(term2.values).map(v => v.label) : []
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

	const data = d.seriesId || d.seriesId === 0 ? d : { seriesId: d.id, dataId: d.dataId }

	const options = []
	if (self.opts.bar_click_opts.includes('hide_bar')) {
		options.push({
			label: d.seriesId ? 'Hide "' + seriesLabel + '"' : 'Hide',
			callback: () => {
				const term = self.config.term
				const q = JSON.parse(JSON.stringify(term.q))
				if (!q.hiddenValues) q.hiddenValues = {}
				q.hiddenValues[d.seriesId] = 1
				self.app.dispatch({
					type: 'plot_edit',
					id: term.id,
					config: {
						term: {
							id: term.id,
							term: term.term,
							q
						}
					}
				})
			}
		})

		if (d.dataId || d.dataId === 0) {
			options.push({
				label: 'Hide "' + dataLabel + '" ' + icon,
				callback: () => {
					const term = self.config.term2
					const q = JSON.parse(JSON.stringify(term.q))
					if (!q.hiddenValues) q.hiddenValues = {}
					q.hiddenValues[d.dataId] = 1
					self.app.dispatch({
						type: 'plot_edit',
						id: term.id,
						config: {
							term2: {
								id: term.id,
								term: term.term,
								q
							}
						}
					})
				}
			})
		}
	}

	if (self.opts.bar_click_opts.includes('add_filter')) {
		options.push({
			label: 'Add as filter',
			callback: menuoption_add_filter
		})
	}

	// TODO: add to cart and gp
	// if (self.opts.bar_click_opts.includes('select_to_gp')) {
	// 	options.push({
	// 		label: 'Select to GenomePaint',
	// 		callback: menuoption_select_to_gp
	// 	})
	// }
	//
	// if (self.opts.bar_click_opts.includes('add_to_cart')) {
	// 	options.push({
	// 		label: 'Add group to cart',
	// 		callback: menuoption_select_group_add_to_cart
	// 	})
	// }

	if (!options.length) return
	self.app.tip.clear()
	if (header) {
		self.app.tip.d.append('div').html(header)
	}
	const tvslst = getTermValues(data, self)
	self.app.tip.d
		.append('div')
		.selectAll('div')
		.data(options)
		.enter()
		.append('div')
		.attr('class', 'sja_menuoption')
		.html(d => d.label)
		.on('click', d => {
			self.app.tip.hide()
			d.callback(self, tvslst)
		})
	self.app.tip.show(event.clientX, event.clientY)
}

function menuoption_add_filter(self, tvslst) {
	/*
	self: the tree object
	tvslst: an array of 1 or 2 term-value setting objects
		this is to be added to the obj.termfilter.terms[]
		if barchart is single-term, tvslst will have only one element
		if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
  	*/
	if (!tvslst) return

	if (!self.state.termfilter || !self.state.termfilter.show_top_ui) {
		// do not display ui, and do not collect callbacks
		return
	}
	self.app.dispatch({ type: 'filter_add', tvslst })
}

/* 			TODO: add to cart and gp          */

function menuoption_select_to_gp(self, tvslst) {
	const lst = []
	for (const t of tvslst) lst.push(t)
	if (self.termfilter && self.termfilter.terms) {
		for (const t of self.termfilter.terms) {
			lst.push(JSON.parse(JSON.stringify(t)))
		}
	}

	// const pane = newpane({ x: 100, y: 100 })
	// import('./block').then(_ => {
	// 	new _.Block({
	// 		hostURL: localStorage.getItem('hostURL'),
	// 		holder: pane.body,
	// 		genome: obj.genome,
	// 		nobox: true,
	// 		chr: obj.genome.defaultcoord.chr,
	// 		start: obj.genome.defaultcoord.start,
	// 		stop: obj.genome.defaultcoord.stop,
	// 		nativetracks: [obj.genome.tracks.find(i => i.__isgene).name.toLowerCase()],
	// 		tklst: [
	// 			{
	// 				type: tkt.mds2,
	// 				dslabel: obj.dslabel,
	// 				vcf: {
	// 					numerical_axis: {
	// 						AFtest: {
	// 							groups: [{ is_termdb: true, terms: lst }, obj.bar_click_menu.select_to_gp.group_compare_against]
	// 						}
	// 					}
	// 				}
	// 			}
	// 		]
	// 	})
	// })
}

function menuoption_select_group_add_to_cart(self, tvslst) {
	if (!tvslst || !tvslst.length) return

	const new_group = {}
	new_group.is_termdb = true
	new_group.terms = []

	for (const [i, term] of tvslst.entries()) {
		new_group.terms.push(term)
	}

	if (!self.selected_groups) {
		self.selected_groups = []
	}

	self.selected_groups.push(new_group)
	self.components.cart.main()
}

function getTermValues(d, self) {
	/*
    d: clicked bar data
  */

	const termValues = []
	const t1 = self.config.term
	const t2 = self.config.term2
	for (const term of [t1, t2]) {
		if (!term) continue
		const i = term == t1 ? 1 : 2
		const key = term == t1 ? d.seriesId : d.dataId
		// const q = term ? term.q : {}
		const q = self.currServerData.refs.q[i]
		const label = !term || !term.term.values ? key : key in term.term.values ? term.term.values[key].label : key

		if (term.term.iscondition) {
			if (!t2 || t1.id != t2.id) {
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

			if (term == t1 && t2 && term.term.id == t2.id) {
				const q2 = t2.q
				const term2Label =
					t2.term.values && d.dataId in t2.term.values ? self.config.term2.values[d.dataId].label : d.dataId

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
			// const bins = term.term.bins
			const bins = self.currServerData.refs.bins[i]
			if (!bins || !bins.length) {
				// not associated with numeric bins
				termValues.push({ term: term.term, values: [{ key, label }] })
			} else {
				const range = bins.find(d => d.label == label || d.name == label)
				if (range) termValues.push({ term: term.term, ranges: [range] })
				else if (term == t1 && d.unannotatedSeries) {
					termValues.push({ term: term.term, ranges: [{ value: d.unannotatedSeries.value, label }] })
				} else if (term == t2 && d.unannotatedData) {
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
