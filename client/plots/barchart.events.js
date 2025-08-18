import { Menu, renderTable } from '#dom'
import { dofetch3 } from '../common/dofetch'
import { mclass, dt2label } from '#shared/common.js'
import { newpane, export_data } from '../src/client'
import { filterJoin, getFilterItemByTag, getNormalRoot, findItemByTermId, normalizeProps } from '#filter'
import { rgb } from 'd3-color'
import { roundValueAuto } from '#shared/roundValue.js'
import { isNumericTerm } from '#shared/terms.js'
import { negateTermLabel } from './barchart'
import { getSamplelstFilter } from '../mass/groups.js'

export default function getHandlers(self) {
	const tip = new Menu({ padding: '5px' })
	self.dom.tip = tip
	const s = self.settings

	return {
		chart: {
			title(chart) {
				if (!self.config.term0) return chart.chartId
				return self.config.term0.term.values && chart.chartId in self.config.term0.term.values
					? self.config.term0.term.values[chart.chartId].label
					: chart.chartId
			}
		},
		svg: {
			mouseout: () => {
				tip.hide()
			}
		},
		series: {
			mouseover(event, d) {
				event.stopPropagation()
				let percent = self.config.term2 ? (d.total / d.seriesTotal) * 100 : (d.seriesTotal / d.chartTotal) * 100
				percent = percent.toFixed(1)
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
				if (t2) {
					rows.push(
						`<tr><td colspan=2 style='padding:3px; text-align:center'>${icon} <span>${dataLabel}</span></td></tr>`
					)
				}
				rows.push(
					`<tr><td style='padding:3px; color:#aaa'>#Individuals</td><td style='padding:3px; text-align:center'>${d.total}</td></tr>`,
					`<tr><td style='padding:3px; color:#aaa'>percent</td><td style='padding:3px; text-align:center'>${percent}%</td></tr>`
				)

				//mouse-over p-value and 2x2 table
				if (t2) {
					const pvalue = d.groupPvalues?.term2tests?.find(x => x.term2id === d.dataId).pvalue
					const term1Label = d.groupPvalues.term1Label
					const term2Label = d.groupPvalues.term2tests.find(x => x.term2id === d.dataId).term2Label
					const tableValues = d.groupPvalues.term2tests.find(x => x.term2id === d.dataId).tableValues
					const skipped = d.groupPvalues.term2tests.find(x => x.term2id === d.dataId).skipped

					// when term1 has only 2 categories, Row2 would be the other category instead of "not Row1"
					const negateTerm1Label = !(
						self.settings.cols.length - self.settings.exclude.cols.length == 2 &&
						self.chartsData.tests[d.chartId].length == 2
					)
						? negateTermLabel(term1Label)
						: self.chartsData.tests[d.chartId][0].term1Label == term1Label
						? self.chartsData.tests[d.chartId][1].term1Label
						: self.chartsData.tests[d.chartId][0].term1Label

					let negateTerm2Label = negateTermLabel(term2Label)
					if (self.settings.rows.length - self.settings.exclude.rows.length == 2) {
						// when term2 has only 2 visible categories, Col2 would be the other category instead of "not Col1"
						const visibleTerm2CatsKeys = self.settings.rows.filter(row => !self.settings.exclude.rows.includes(row))
						const visibleTerm2Labels = visibleTerm2CatsKeys
							.map(catK => self.config.term2?.term?.values?.[catK]?.label)
							.filter(x => x != undefined)
						if (visibleTerm2Labels?.length == 2)
							negateTerm2Label = visibleTerm2Labels[0] == term2Label ? visibleTerm2Labels[1] : visibleTerm2Labels[0]
					}

					rows.push(
						`<tr>
							<td style='padding:3px; color:#aaa'>p-value</td>
							<td style='padding:3px; text-align:center'>${
								skipped ? 'N/A' : pvalue > 1e-4 ? Number(pvalue.toFixed(4)) : roundValueAuto(Number(pvalue))
							}</td>
						</tr>
						<table style="margin: 5px; text-align:left; font-size: 0.8em; border-spacing: 5px; border-collapse: separate;"
							<tr>
								<td style='color:#aaa'></td>
								<td style='color:#aaa'>${term2Label}</td>
								<td style='color:#aaa'>${negateTerm2Label}</td>
							</tr>
							<tr>
								<td style='color:#aaa'>${term1Label}</td>
								<td>${tableValues.R1C1}</td>
								<td>${tableValues.R1C2}</td>
							</tr>
							<tr>
								<td style='color:#aaa'>${negateTerm1Label}</td>
								<td>${tableValues.R2C1}</td>
								<td>${tableValues.R2C2}</td>
							</tr>
						</table>`
					)
				}
				if (!t1.type == 'condition' && (!t2 || !t2.type == 'condition')) {
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
			strokeFill(d) {
				const rgbColor = rgb(d.color)
				const stroke = rgbColor.toString() == rgb('white').toString() ? rgbColor.darker() : rgbColor
				return stroke
			},
			click: self.opts.bar_click_override
				? (event, d) => self.opts.bar_click_override(getTermValues(d, self))
				: (event, d) => handle_click(event, self, d)
		},
		colLabel: {
			text: d => {
				return 'label' in d
					? d.label
					: self.config.term.values && 'id' in d && d.id in self.config.term.values
					? self.config.term.values[d.id].label
					: d
			},
			click: self.opts.bar_click_override
				? (event, d) => self.opts.bar_click_override(getTermValues(d, self))
				: (event, d) => handle_click(event, self, d),
			mouseover: event => {
				event.stopPropagation()
				tip.show(event.clientX, event.clientY).d.html('Click to hide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		rowLabel: {
			text: d => {
				return d.label
					? d.label
					: self.config.term.values && 'id' in d && d.id in self.config.term.values
					? self.config.term.values[d.id].label
					: d
			},
			click: self.opts.bar_click_override
				? (event, d) => self.opts.bar_click_override(getTermValues(d, self))
				: (event, d) => handle_click(event, self, d),
			mouseover: event => {
				event.stopPropagation()
				tip.show(event.clientX, event.clientY).d.html('Click to hide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		legend: {
			onColorClick: e => handleLegendClick(e.target, self),
			click: e => handleLegendClick(e.target, self),
			mouseover: event => {
				event.stopPropagation()
				const d = event.target.__data__
				if (d === undefined) return
				if (d.isHidden) tip.show(event.clientX, event.clientY).d.html('Click to unhide bar')
			},
			mouseout: () => {
				tip.hide()
			}
		},
		yAxis: {
			text: visibleTotal => {
				const type = self.sampleType?.plural_name || 'samples'
				const term = self.config.term
				if (s.orientation == 'vertical') {
					// Do not show the sum of serieses as (n=...) when serieses are 'Sub-condition', 'Most recent grade' or 'Any grade'
					// because a patient could have multiple 'Sub-condition', 'Most recent grade' or 'Any grade', and as a result could
					// be counted multiple times.
					return s.unit == 'pct'
						? `% of ${type}`
						: `# of ${type} ` +
								(term.q.bar_by_children || term.q.value_by_most_recent || term.q.value_by_computable_grade
									? ''
									: `(n=${visibleTotal})`)
				} else {
					return term.q.bar_by_children
						? 'Sub-condition'
						: term.q.value_by_max_grade
						? 'Maximum grade'
						: term.q.value_by_most_recent
						? 'Most recent grade'
						: term.q.value_by_computable_grade
						? 'Any grade'
						: term.type == 'categorical' || !term.unit
						? ''
						: term.unit
				}
			}
		},
		xAxis: {
			text: visibleTotal => {
				const type = self.sampleType?.plural_name || 'samples'
				const term = self.config.term
				if (s.orientation == 'vertical') {
					return term.q.bar_by_children
						? 'Sub-condition'
						: term.q.value_by_max_grade
						? 'Maximum grade'
						: term.q.value_by_most_recent
						? 'Most recent grade'
						: term.q.value_by_computable_grade
						? 'Any grade'
						: term.type == 'categorical' || !term.unit
						? ''
						: term.unit
				} else {
					// Do not show the sum of serieses as (n=...) when serieses are 'Sub-condition', 'Most recent grade' or 'Any grade'
					// because a patient could have multiple 'Sub-condition', 'Most recent grade' or 'Any grade', and as a result could
					// be counted multiple times.
					return s.unit == 'pct'
						? `% of ${type}`
						: `# of ${type} ` +
								(term.q.bar_by_children || term.q.value_by_most_recent || term.q.value_by_computable_grade
									? ''
									: `(n=${visibleTotal})`)
				}
			}
		}
	}
}

function handleColorClick(d, self, color) {
	const termNum = d.type == 'col' ? 'term' : 'term2'
	const term = self.config[termNum]
	let dataId = d.dataId
	if (term.term.values && !term.term.values?.[dataId])
		for (const [key, value] of Object.entries(term.term.values)) if (value.label == d.dataId) dataId = key
	if (term.term.values?.[dataId]) term.term.values[dataId].color = color
	if (term.term.type == 'geneVariant') {
		if (!term.term.values) term.term.values = {}
		term.term.values[d.dataId] = { label: d.dataId, color }
	}
	let binColored = null
	if (self.bins[2].length > 0) {
		//term index: term0: 0, term: 1, term2: 2
		const binMatched = self.bins[2].find(bin => bin.label == d.dataId)
		if (binMatched) {
			binMatched.color = color
			binColored = self.bins[2]
		}
	}
	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: {
			[termNum]: {
				$id: term.$id,
				id: term.id,
				isAtomic: true,
				term: term.term,
				q: getUpdatedQfromClick(d, term, d.isHidden, binColored)
			}
		}
	})
}

function handleLegendClick(target, self) {
	const d = target.__data__
	if (d === undefined) return
	if (!('type' in d)) return
	const termNum = d.type == 'col' ? 'term' : 'term2'
	const term = self.config[termNum]
	const isHidden =
		'isHidden' in d
			? !d.isHidden
			: !(term.q && term.q.hiddenValues && term.q.hiddenValues['dataId' in d ? d.dataId : d.id])
	const tip = self.app.tip
	const menu = tip.clear()
	menu.showunder(target)
	const div = menu.d.append('div')
	div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(!isHidden ? 'Show' : 'Hide')
		.on('click', () => {
			menu.hide()
			hideCategory(d, self, isHidden)
		})
	if (term.q.hiddenValues && Object.keys(term.q.hiddenValues).length > 1)
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show all')
			.on('click', () => {
				menu.hide()
				const config = {}
				const tw = structuredClone(term)
				delete tw.q.hiddenValues

				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { [termNum]: tw }
				})
			})
	const color = rgb(d.color).formatHex()
	if (color != '#ffffff') {
		const input = div
			.append('div')
			.attr('class', 'sja_sharp_border')
			.style('padding', '0px 10px')
			.text('Color:')
			.append('input')
			.attr('type', 'color')
			.attr('value', color)
			.on('change', () => {
				handleColorClick(d, self, input.node().value)
				menu.hide()
			})
	}
}

export function hideCategory(d, self, isHidden) {
	const termNum = d.type == 'col' ? 'term' : 'term2'
	const term = self.config[termNum]
	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: {
			[termNum]: {
				//Fix for list samples options not working
				//after hiding a category
				$id: term?.$id,
				id: term.id,

				isAtomic: true,
				term: term.term,
				q: getUpdatedQfromClick(d, term, isHidden)
			}
		}
	})
}

function getUpdatedQfromClick(d, term, isHidden = false, binColored = null) {
	const label = 'id' in d ? d.id : d.type == 'col' ? d.seriesId : d.dataId
	const valueId = term.term.values && Object.keys(term.term.values).find(id => term.term.values[id].label === label)
	const id = !valueId ? label : valueId
	const q = JSON.parse(JSON.stringify(term.q))
	if (!q.hiddenValues) q.hiddenValues = {}
	if (isHidden) q.hiddenValues[id] = 1
	else delete q.hiddenValues[id]
	if (binColored) q.binColored = binColored
	return q
}

function handle_click(event, self, chart) {
	const d = event.target.__data__ || event.target.parentNode.__data__
	// bar label data only has {id,label},
	// while bar data has all required data including seriesId
	const term1 = self.config.term.term
	const term2 = self.config.term2 ? self.config.term2.term : null
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
			label: data.seriesId ? 'Hide "' + seriesLabel + '"' : 'Hide',
			callback: () => {
				const term = self.config.term
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						term: {
							$id: term.$id,
							id: term.id,
							isAtomic: true,
							term: term.term,
							q: getUpdatedQfromClick({ id: data.seriesId, type: 'col' }, term, true)
						}
					}
				})
			}
		})

		if (data.dataId || data.dataId === 0) {
			options.push({
				label: 'Hide "' + dataLabel + '" ' + icon,
				callback: () => {
					const term2 = self.config.term2
					self.app.dispatch({
						isAtomic: true,
						type: 'plot_edit',
						id: self.id,
						config: {
							term2: {
								isAtomic: true,
								term: term2.term,
								q: getUpdatedQfromClick({ id: data.dataId, type: 'row' }, term2, true)
							}
						}
					})
				}
			})
		}
	}

	if (self.opts.bar_click_opts.includes('add_filter') && (!term2 || !term2.isgenotype)) {
		const item = findItemByTermId(self.state.termfilter.filter, self.config.term.term.id)
		if (!item) {
			options.push({
				label: 'Add as filter',
				callback: menuoption_add_filter
			})
		}
	}
	//disable sample listing temporarily
	if (self.config.displaySampleIds) {
		options.push({
			label: 'List samples',
			callback: async () => await listSamples(event, self, data.seriesId, data.dataId, chart.chartId)
		})
	}

	if (self.opts.bar_click_opts.includes('select_to_gp')) {
		options.push({
			label: 'Select to GenomePaint',
			callback: menuoption_select_to_gp
		})
	}

	// TODO: add to cart
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
		.on('click', async (event, d) => {
			if (event.target._clicked) return
			event.target._clicked = true
			event.target.textContent = 'Loading...'
			await d.callback(self, tvslst)
			self.app.tip.hide()
		})
	self.app.tip.show(event.clientX, event.clientY)
}

async function listSamples(event, self, seriesId, dataId, chartId) {
	// query sample data
	const terms = [self.config.term]
	const tvslst = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}
	const tvs = getTvs(1, seriesId)
	if (tvs) tvslst.lst.push(tvs)
	const hasTerm2Data = self.config.term2 && dataId // will be true if user clicks on bar, but not bar label
	if (hasTerm2Data) {
		terms.push(self.config.term2)
		const tvs = getTvs(2, dataId)
		if (tvs) tvslst.lst.push(tvs)
	}
	if (self.config.term0) {
		terms.push(self.config.term0)
		const tvs = getTvs(0, chartId)
		if (tvs) tvslst.lst.push(tvs)
	}
	const opts = {
		terms,
		filter: filterJoin([self.state.termfilter.filter, tvslst]),
		filter0: self.state.termfilter.filter0
	}
	const data = await self.app.vocabApi.getAnnotatedSampleData(opts)

	// fill table rows with sample data
	const rows = []
	const termIsNumeric = isNumericTerm(self.config.term.term)
	const term2isNumeric = self.config.term2 ? isNumericTerm(self.config.term2.term) : false
	const termIsGv = self.config.term.term.type == 'geneVariant'
	const term2isGv = self.config.term2?.term.type == 'geneVariant'
	for (const sample of data.lst) {
		const sampleName = data.refs.bySampleId[sample.sample].label
		// must filter by geneVariant term(s) here in order to filter by
		// group assignments instead of strictly by mutation status
		// e.g. if sample has both cnv gain and loss and is assigned to cnv gain
		// group (due to higher group priority), then the same group assignments
		// should be used when listing samples
		const pass = mayFilterByGeneVariant(sample)
		if (!pass) continue
		const row = [{ value: sampleName }]
		// add sample url, if applicable
		{
			const temp = self.app.vocabApi.termdbConfig?.urlTemplates?.sample
			if (temp) {
				row[0].url = temp.base + (sample[temp.namekey] || sample.sample)
			}
		}
		/** Don't show hidden values in the results
		 * May not be caught in server request for custom variables
		 * with user supplied keys */
		if (self.config.term.q?.hiddenValues && `${sample[self.config.term.$id].key}` in self.config.term.q.hiddenValues)
			continue
		if (termIsNumeric) {
			const value = sample[self.config.term.$id]?.value
			row.push({ value: roundValueAuto(value) })
		} else if (termIsGv) {
			addGvRowVals(sample, self.config.term, row)
		}
		if (hasTerm2Data) {
			//Don't show hidden values in the results
			if (
				self.config.term2.q?.hiddenValues &&
				`${sample[self.config.term2.$id].key}` in self.config.term2.q.hiddenValues
			)
				continue
			let value = sample[self.config.term2.$id]
			if (!value) {
				row.push({ value: '' })
			} else if (term2isNumeric) {
				value = roundValueAuto(value.value)
				row.push({ value })
			} else if (term2isGv) {
				addGvRowVals(sample, self.config.term2, row)
			} else {
				const label = self.config.term2.term.values?.[value.key]?.label
				value = label || value.value
				row.push({ value })
			}
		}
		rows.push(row)
	}

	// fill table columns with term metadata
	const columns = [{ label: 'Sample' }]
	if (termIsNumeric) {
		columns.push({ label: self.config.term.term.name })
	} else if (termIsGv) {
		addGvCols(self.config.term, columns)
	}
	if (hasTerm2Data) {
		if (term2isGv) {
			addGvCols(self.config.term2, columns)
		} else {
			columns.push({ label: self.config.term2.term.name })
		}
	}

	// render table
	const menu = new Menu({ padding: '5px' })
	const div = menu.d.append('div')
	renderTable({
		rows,
		columns,
		div,
		showLines: true,
		maxHeight: '40vh',
		resize: true
	})
	menu.show(event.clientX, event.clientY, false)

	function getTvs(termIndex, value) {
		const term = termIndex == 0 ? self.config.term0 : termIndex == 1 ? self.config.term : self.config.term2
		if (term.term.type == 'geneVariant') {
			// geneVariant filtering will be handled by mayFilterByGeneVariant()
			return
		}
		let tvs = {
			type: 'tvs',
			tvs: {
				term: term.term,
				values: [{ key: value }]
			}
		}
		if (isNumericTerm(term.term)) {
			const bins = self.bins[termIndex]
			tvs.tvs.ranges = [bins.find(bin => bin.label == value)]
		} else if (term.term.type == 'samplelst') {
			const list = term.term.values?.[value]?.list || []
			const ids = list.map(s => s.sampleId)
			const tvslst = getSamplelstFilter(ids)
			tvs = tvslst.lst[0] // tvslst only has the tvs for the samplelst term
		} else if (term.term.type == 'geneVariant' && term.q.type == 'values') {
			throw 'no longer supported in barchart'
			/*** code below was used to list samples for geneVariant term with q.type='values', but now only geneVariant with groupsetting is used in barchart ***/
			/*// geneVariant term with q.type='values' (groupsetting is handled mayFilterByGeneVariant())
			// chart is divided by dt term
			// get dt term from selected chart and build tvs
			const termdbmclass = self.app.vocabApi.termdbConfig?.mclass
			const dtTerm = self.chartid2dtterm[chartId]
			let key
			if (termdbmclass) {
				// custom mclass labels defined in dataset
				key = Object.keys(termdbmclass).find(k => termdbmclass[k].label == value)
			}
			if (!key) {
				key = Object.keys(mclass).find(k => mclass[k].label == value)
			}
			tvs.tvs.term = dtTerm
			;(tvs.tvs.values = [{ key }]), (tvs.tvs.includeNotTested = true) // to be able to list not tested samples*/
		}
		return tvs
	}

	function mayFilterByGeneVariant(sample) {
		if (self.config.term.term.type == 'geneVariant') {
			const tw = self.config.term
			if (tw.q.type == 'values') throw 'q.type=values not supported'
			const value = sample[tw.$id]?.value
			if (value != seriesId) return false
		}
		if (self.config.term2?.term.type == 'geneVariant' && hasTerm2Data) {
			const tw = self.config.term2
			if (tw.q.type == 'values') throw 'q.type=values not supported'
			const value = sample[tw.$id]?.value
			if (value != dataId) return false
		}
		if (self.config.term0?.term.type == 'geneVariant') {
			const tw = self.config.term0
			if (tw.q.type == 'values') throw 'q.type=values not supported'
			const value = sample[tw.$id]?.value
			if (value != chartId) return false
		}
		return true
	}

	// add geneVariant values to row
	function addGvRowVals(sample, tw, row) {
		const mlst = sample[tw.$id]?.values
		const gene2mlst = new Map()
		// map each gene to its mutations
		for (const gene of tw.term.genes) {
			const mlst_gene = mlst.filter(m => m.gene == gene.id)
			gene2mlst.set(gene.name, mlst_gene)
		}
		if (!gene2mlst.size) throw 'gene2mlst is empty'
		if (gene2mlst.size == 1) {
			// single gene, add its mutations to mutation column
			const entry = gene2mlst.entries().next().value
			const mlst = entry[1]
			const htmls = mlst2htmls(mlst)
			row.push({ html: htmls.join('<br>') })
		} else {
			// multiple genes, add each gene to gene column and its
			// mutations to mutation column
			const genes = []
			const htmls = []
			for (const [gene, mlst] of gene2mlst) {
				genes.push(...Array(mlst.length).fill(gene))
				htmls.push(...mlst2htmls(mlst))
			}
			row.push({ html: genes.join('<br>') })
			row.push({ html: htmls.join('<br>') })
		}
	}

	function mlst2htmls(mlst) {
		const htmls = mlst.map(m => {
			const mname = m.mname || ''
			const color = mclass[m.class].color
			const label = mclass[m.class].label.toUpperCase()
			const html = `<span>${mname}</span><span style="margin-left: ${
				mname ? '5px' : '0px'
			}; color: ${color}; font-size: .8em;">${label}</span>`
			return html
		})
		return htmls
	}

	// add geneVariant columns
	function addGvCols(tw, columns) {
		if (tw.term.genes.length == 1) {
			columns.push({ label: tw.term.name })
		} else {
			columns.push({ label: 'Gene' })
			if (tw.q.type == 'predefined-groupset') {
				const groupset = tw.term.groupsetting.lst[tw.q.predefined_groupset_idx]
				columns.push({ label: dt2label[groupset.dt] })
			} else {
				columns.push({ label: seriesId })
			}
		}
	}
}

function menuoption_add_filter(self, tvslst) {
	/*
	self: the tree object
	tvslst: an array of 1 or 2 term-value setting objects
		this is to be added to the obj.termfilter.filter[]
		if barchart is single-term, tvslst will have only one element
		if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
  	*/
	if (!tvslst) return
	if (!self.state.termfilter || self.state.nav?.header_mode !== 'with_tabs') {
		// do not display ui, and do not collect callbacks
		return
	}
	const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
	const filter = filterJoin([
		filterUiRoot,
		{
			type: 'tvslst',
			in: true,
			join: tvslst.length > 1 ? 'and' : '',
			lst: [...tvslst.map(wrapTvs)]
		}
	])
	filter.tag = 'filterUiRoot'
	self.app.dispatch({
		type: 'filter_replace',
		filter
	})
}

function wrapTvs(tvs) {
	return tvs.type === 'tvs' ? tvs : { type: 'tvs', tvs }
}

/* 			TODO: add to cart and gp          */

function menuoption_listsamples(self, tvslst) {
	const filterRoot = getNormalRoot({
		type: 'tvslst',
		join: 'and',
		lst: [
			self.state.termfilter.filter,
			// create a copy of tvslst to not mutate the barchart state,
			// such as when deleting tvs.tvs.term.values below
			...tvslst.map(tvs => wrapTvs(JSON.parse(JSON.stringify(tvs))))
		]
	})
	///////////// quick fix to delete term.values{} from stringified filter to reduce url length
	normalizeProps(filterRoot, f => {
		delete f.tag
		if (f.type == 'tvs' && f.tvs && f.tvs.term) delete f.tvs.term.values
	})
	const arg = [
		'getsamples=1',
		'genome=' + self.app.vocabApi.vocab.genome,
		'dslabel=' + self.app.vocabApi.vocab.dslabel,
		'filter=' + encodeURIComponent(JSON.stringify(filterRoot))
	]

	dofetch3('termdb?' + arg.join('&')).then(data => {
		export_data(data.samples.length + ' samples', [{ text: data.samples.join('\n') }])
	})
}

function menuoption_select_to_gp(self, tvslst) {
	const lst = []
	for (const t of tvslst) {
		const f = wrapTvs(t)
		const item = findItemByTermId(self.state.termfilter.filter, t.tvs.term.id)
		if (!item) lst.push(wrapTvs(t))
	}

	import('../src/block').then(async _ => {
		const obj = {
			genome: self.app.opts.genome,
			dslabel: self.state.dslabel
		}
		const pane = newpane({ x: 100, y: 100 })
		const filterRoot = getNormalRoot(self.state.termfilter.filter)
		const filterUiRoot = getFilterItemByTag(filterRoot, filterUiRoot)
		if (filterUiRoot && filterUiRoot != filterRoot) delete filterUiRoot.tag
		filterRoot.tag = 'filterUiRoot'
		if (lst.length) {
			filterRoot.join = 'and'
			filterRoot.lst.push(...lst)
		}
		const cohortFilter = getFilterItemByTag(filterRoot, 'cohortFilter')
		if (cohortFilter) {
			cohortFilter.renderAs = 'htmlSelect'
			cohortFilter.selectOptionsFrom = 'selectCohort'
		}
		new _.Block({
			hostURL: sessionStorage.getItem('hostURL'),
			holder: pane.body,
			genome: obj.genome,
			nobox: true,
			chr: obj.genome.defaultcoord.chr,
			start: obj.genome.defaultcoord.start,
			stop: obj.genome.defaultcoord.stop,
			nativetracks: [obj.genome.tracks.find(i => i.__isgene).name.toLowerCase()],
			tklst: [
				{
					type: 'mds2',
					dslabel: obj.dslabel,
					vcf: {
						numerical_axis: {
							AFtest: {
								groups: [
									{ is_termdb: true, filter: filterRoot },
									{ is_population: true, key: 'gnomAD', allowto_adjust_race: true, adjust_race: true }
								]
							}
						}
					}
				}
			]
		})
	})
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
	if (self.state.nav?.header_mode == 'with_cohortHtmlSelect') {
		// pass the cohort filter information back to calling app
		// do not set the renderAs in here since that is decided by the calling app
		const cohortFilter = getFilterItemByTag(self.state.termfilter.filter, 'cohortFilter')
		if (cohortFilter) termValues.push(JSON.parse(JSON.stringify(cohortFilter)))
	}

	const t1 = self.config.term
	const t1ValKey =
		t1.term.values && Object.keys(t1.term.values).filter(key => t1.term.values[key].label === d.seriesId)[0]
	const t1ValId = t1.term.values && t1ValKey in t1.term.values ? t1ValKey : d.seriesId
	const t2 = self.config.term2
	const t2ValKey =
		t2 && t2.term.values && Object.keys(t2.term.values).filter(key => t2.term.values[key].label === d.dataId)[0]
	const t2ValId = t2 && t2.term.values && t2ValKey in t2.term.values ? t2ValKey : d.dataId

	for (const term of [t1, t2]) {
		if (!term) continue
		const i = term == t1 ? 1 : 2
		const key = term == t1 ? t1ValId : t2ValId
		if (!key) continue
		// const q = term ? term.q : {}
		const q = term.q //self.currServerData.refs.q[i]
		const label = !term || !term.term.values ? key : key in term.term.values ? term.term.values[key].label : key

		if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
			const groupset =
				q.type == 'predefined-groupset' ? term.term.groupsetting.lst[q.predefined_groupset_idx] : q.customset
			const group = groupset.groups.find(g => g.name === key)
			const tvs = { term: term.term, values: group.values, groupset_label: group.name }
			if (term.term.type == 'condition') {
				tvs.bar_by_children = term.q.bar_by_children
				tvs.bar_by_grade = term.q.bar_by_grade
				tvs.value_by_most_recent = term.q.value_by_most_recent
				tvs.value_by_max_grade = term.q.value_by_max_grade
			}
			termValues.push(tvs)
		} else if (term.term.type == 'condition') {
			if (!t2 || t1.term.id != t2.term.id) {
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

			if (term == t1 && t2 && term.term.id == t2.term.id) {
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
			const bins = self.currServerData.refs.bins[i]
			if (!bins || !bins.length) {
				// not associated with numeric bins
				termValues.push({ term: term.term, values: [{ key, label }] })
			} else {
				const range = bins.find(d => d.label == label || d.name == label)
				if (range) termValues.push({ term: term.term, ranges: [range] })
				else if (term == t1) {
					termValues.push({ term: term.term, ranges: [{ value: key }] })
				} else if (term == t2) {
					termValues.push({ term: term.term, ranges: [{ value: key }] })
				} else {
					throw 'should not happen'
				}
			}
		}
	}
	return termValues.map(f => wrapTvs(f))
}
