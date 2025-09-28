import { select } from 'd3-selection'
import { getDefaultViolinSettings } from './violin.js'
import { appInit } from './plot.app'

/*
	dom elements for values table
	holder // main holder
		loading_div // loading message while updating term info
		top_info_div // top info about scale + knots + promopt to select ref group
		violin_div // violin plot of values (used when .mode=continuous)
		table_div // tabular bar chart of values (used when .mode != continuous)
		bottom_info_div // total included and excluded samples
		excluded_div // excluded values with samplecount
*/

const row_hover_bgcolor = '#fff6dc'

export class InputValuesTable {
	constructor(opts) {
		// opts {holder, input, callback}
		this.opts = opts
		this.input = opts.input
		setRenderers(this)
		this.setDOM(opts.holder)
	}

	main() {
		try {
			const term = this.input.term
			// may allow the values table even if there is a variable error,
			// in case it helps clarify the error message such as having
			// not exactly two samplecount bars available for a binary outcome term

			if (!term || !this.input.termStatus) {
				this.dom.holder.style('display', 'none')
				this.dom.loading_div.style('display', 'none')
				return
			} else if (term) {
				this.dom.holder.style('display', 'block')
				this.dom.loading_div.style('display', 'block')
				this.updateValueCount()
				this.dom.loading_div.style('display', 'none')
				this.render()
				return
			}
		} catch (e) {
			this.dom.loading_div.style('display', 'none')
			throw e
		}
	}

	updateValueCount() {
		const i = this.input
		try {
			/* TODO: may need to move validateQ out of a ts.pill */
			if (i.pill && i.pill.validateQ) {
				i.pill.validateQ({
					term: i.term.term,
					q: i.term.q,
					sampleCounts: i.termStatus.sampleCounts
				})
			}
		} catch (e) {
			i.term.error = e
		}
	}
}

function setRenderers(self) {
	self.setDOM = holder => {
		self.dom = {
			holder: holder
				.style('margin', '10px')
				.style('font-size', '.8em')
				.style('text-align', 'left')
				.style('color', '#999'),

			loading_div: holder.append('div').text('Loading..').style('display', 'none'),

			top_info_div: holder.append('div').style('padding-bottom', '5px'),

			violin_div: holder.append('div').style('color', 'black').style('padding-top', '5px'),

			table_div: holder
				.append('table')
				.style('margin', '5px 0px 15px 0px')
				.style('border-collapse', 'collapse')
				.style('color', 'black'),

			bottom_info_div: holder.append('div'),

			excluded_div: holder
				.append('table')
				.style('display', 'none')
				.style('margin', '5px 10px')
				.style('border-collapse', 'collapse')
		}
	}

	self.render = async () => {
		const input = self.input

		// render top info
		renderTopInfo(input)

		// render included values
		await renderValuesTable(input)

		// render bottom info
		renderBottomInfo(input)

		// render excluded values
		renderExcludedValues(input)
	}

	function renderTopInfo(input) {
		if (input.termStatus.topInfoStatus?.length) {
			self.dom.top_info_div.style('display', 'block').html(input.termStatus.topInfoStatus.join('<br>'))
		} else {
			self.dom.top_info_div.style('display', 'none')
		}
	}

	async function renderValuesTable(input) {
		if (input.term.q.mode == 'continuous' || input.term.q.mode == 'spline') {
			// continuous or spline mode
			// render values as violin plot
			self.dom.violin_div.style('display', 'block')
			self.dom.table_div.style('display', 'none')
			if (self.plotAppApi) {
				// violin plot already created, refresh the plot
				const action = {
					type: 'app_refresh',
					state: {
						termfilter: {
							filter: self.input.parent.parent.filter
						}
					},
					subactions: [
						{
							type: 'plot_edit',
							id: self.violinApi.id,
							config: {
								term: input.term
							}
						}
					]
				}
				self.plotAppApi.dispatch(action)
			} else {
				// violin plot does not exist, create the plot
				const opts = {
					holder: self.dom.violin_div,
					vocabApi: self.input.parent.app.vocabApi,
					state: {
						vocab: {
							genome: self.input.parent.app.vocabApi.genome,
							dslabel: self.input.parent.app.vocabApi.dslabel
						},
						termfilter: {
							filter: self.input.parent.parent.filter
						},
						plots: [
							{
								chartType: 'violin',
								term: input.term,
								settings: {
									violin: getDefaultViolinSettings(null, {
										svgw: 350,
										axisHeight: 25,
										rightMargin: 10,
										datasymbol: 'rug',
										radius: 8,
										plotThickness: 80
									})
								}
							}
						]
					},
					// global options for plotAppApi
					// opts.violin will apply to all violin plots within the plotApp
					// rx will pass options by component type, which are not tracked in state
					// examples are callbacks, event listeners, etc
					violin: {
						mode: 'minimal'
					}
				}
				self.plotAppApi = await appInit(opts)
				const plotId = self.plotAppApi.getState().plots[0].id
				self.violinApi = self.plotAppApi.getComponents(`plots.${plotId}`)
			}
		} else {
			// mode is neither continuous nor spline
			// render values as a tabular bar chart
			self.dom.violin_div.style('display', 'none')
			const data = input.termStatus.sampleCounts
			if (!data || !data.length) {
				self.dom.table_div.style('display', 'none')
				return
			}
			self.dom.table_div.style('display', 'block')
			const l = self.input.orderedLabels
			const sortFxn =
				l && l.length ? (a, b) => l.indexOf(a.label) - l.indexOf(b.label) : (a, b) => b.samplecount - a.samplecount
			const tr_data = data.sort(sortFxn)

			const maxCount = Math.max(...tr_data.map(v => v.samplecount), 0)
			tr_data.forEach(v => (v.bar_width_frac = Number((1 - (maxCount - v.samplecount) / maxCount).toFixed(4))))

			self.dom.table_div.selectAll('tr').remove()
			const trs = self.dom.table_div.selectAll('tr').data(tr_data, b => b.key)

			//trs.exit().remove()
			//trs.each(trUpdate)
			trs.enter().append('tr').each(trEnter)
		}
	}

	function renderBottomInfo(input) {
		if (input.termStatus.bottomSummaryStatus) {
			self.dom.bottom_info_div.style('display', 'block').html(input.termStatus.bottomSummaryStatus)
		} else {
			self.dom.bottom_info_div.style('display', 'none')
		}
	}

	function renderExcludedValues(input) {
		const data = input.termStatus.excludeCounts
		if (!data || !data.length) {
			self.dom.excluded_div.style('display', 'none')
			return
		}
		self.dom.excluded_div.style('display', 'block').selectAll('tr').remove()
		const trs = self.dom.excluded_div.selectAll('tr').data(data, b => b.key)

		//trs.exit().remove()
		//trs.each(trUpdate)
		trs.enter().append('tr').each(trEnter)

		self.dom.excluded_div.selectAll('td').style('color', '#999')
	}

	function trEnter(item) {
		const tr = select(this)
		const input = this.parentNode.__data__
		const t = input.term
		const maxBarWidth = 150

		tr.style('text-align', 'left').style('cursor', input.termStatus.allowToSelectRefGrp ? 'pointer' : 'default')

		const tdSpacing = '1px 10px 1px 0px'
		// sample count td
		tr.append('td')
			.style('padding', tdSpacing)
			.style('text-align', 'left')
			.style('color', 'black')
			.text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')

		// label td
		tr.append('td').style('padding', tdSpacing).style('text-align', 'left').style('color', 'black').text(item.label)

		// sample count bar td
		const bar_td = tr.append('td').style('padding', tdSpacing)

		// bar_width
		const barWidth = maxBarWidth * item.bar_width_frac
		bar_td
			.append('div')
			.style('margin', tdSpacing)
			.style('width', barWidth + 'px')
			.style('height', '15px')
			.style('background-color', '#ddd')

		addTrBehavior({ input, item, tr, rendered: false })
	}

	/*
	// TODO: to use this function, need to add code that will take into account the order of the rows
	function trUpdate(item) {
		select(this.firstChild).text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')
		select(this.firstChild.nextSibling).text(item.label)

		const input = this.parentNode.__data__
		const t = input.term
		let rendered = true
		if ((t.q.mode == 'discrete' || t.q.mode == 'binary') && this.childNodes.length < 4) rendered = false
		addTrBehavior({ input, item, tr: select(this), rendered })
	}
	*/

	function addTrBehavior({ input, item, tr, rendered }) {
		// don't add tr effects for excluded values
		if (!item.bar_width_frac) return

		const t = input.term
		const hover_flag = input.termStatus.allowToSelectRefGrp
		let ref_text

		if (rendered) {
			tr.style('background', 'white')
			ref_text = select(tr.node().lastChild)
				.select('div')
				.style('display', item.key === t.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === t.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else if (input.term.q.mode != 'cutoff') {
			const reference_td = tr.append('td').style('padding', '1px 5px').style('text-align', 'left')

			ref_text = reference_td
				.append('div')
				.style('display', item.key === t.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('padding', '2px 10px')
				.style('border', item.key === t.refGrp && hover_flag ? '1px solid #bbb' : '')
				.style('border-radius', '10px')
				.style('color', '#999')
				.style('font-size', '.7em')
				.text('REFERENCE')

			if (hover_flag) {
				tr.on('mouseover', () => {
					if (t.refGrp !== item.key) {
						tr.style('background', row_hover_bgcolor)
						ref_text.style('display', 'inline-block').style('border', '').text('Set as reference')
					} else tr.style('background', 'white')
				})
					.on('mouseout', () => {
						tr.style('background', 'white')
						if (t.refGrp !== item.key) ref_text.style('display', 'none')
					})
					.on('click', () => {
						t.refGrp = item.key
						ref_text.style('border', '1px solid #bbb').text('REFERENCE')
						// below will save to state, ui code should react to it
						self.opts.callback(t)
					})
			}
		}
	}
}
