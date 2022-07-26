import { select } from 'd3-selection'

/*
	dom elements for values table
	holder // main holder
		loading_div // loading message while updating term info
		topInfoStatus_holder // top info about term type and term mode + knots + promopt to select ref group
		values_div // values, bottomSummary and excluded values
			included_values_table // values with samplecount, selectable as ref group
			bottomSummaryStatus_holder // total included and excluded samples
			excluded_values_table // excluded values with samplecount
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
		holder
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')

		const topInfoStatus_holder = holder.append('div').style('display', 'none')
		const values_div = holder.append('div')

		self.dom = {
			holder,
			loading_div: holder
				.append('div')
				.text('Loading..')
				.style('display', 'none'),

			topInfoStatus_holder,

			values_div,
			selectRefgrpPrompt: values_div
				.append('div')
				.text('CLICK A ROW TO SET AS REFERENCE')
				.style('margin', '10px 0px 0px 10px')
				.style('font-size', '.7em')
				.style('display', 'none'),
			included_values_table: values_div.append('table'),
			bottomSummaryStatus_holder: values_div.append('div'),
			excluded_values_table: values_div.append('table')
		}
	}

	self.render = () => {
		const input = self.input
		self.dom.selectRefgrpPrompt.style('display', input.termStatus.allowToSelectRefGrp ? 'block' : 'none')
		// render term status
		renderTermStatus(input.termStatus)
		// make included and excluded tables respectively

		self.dom.included_values_table.selectAll('*').remove()

		renderValuesTable(input.termStatus.sampleCounts, 'included_values_table', input.termStatus.allowToSelectRefGrp)
		renderValuesTable(input.termStatus.excludeCounts, 'excluded_values_table')
	}

	function renderTermStatus(termStatus) {
		// hide holder first
		self.dom.topInfoStatus_holder.style('display', 'none')
		self.dom.bottomSummaryStatus_holder.style('display', 'none')
		if (!termStatus || (termStatus.topInfoStatus.length == 0 && termStatus.bottomSummaryStatus == undefined)) return
		else {
			if (termStatus.topInfoStatus.length) {
				self.dom.topInfoStatus_holder.style('display', 'block').html(termStatus.topInfoStatus.join('<br>'))
			}
			if (termStatus.bottomSummaryStatus) {
				self.dom.bottomSummaryStatus_holder.style('display', 'block').html(termStatus.bottomSummaryStatus)
			}
		}
	}

	function renderValuesTable(data, tableName = 'included_values_table', allowToSelectRefGrp) {
		if (!data || !data.length) {
			if (tableName == 'excluded_values_table') {
				self.dom.excluded_values_table.selectAll('*').remove()
			}
			return
		}
		const l = self.input.orderedLabels
		const sortFxn =
			l && l.length ? (a, b) => l.indexOf(a.label) - l.indexOf(b.label) : (a, b) => b.samplecount - a.samplecount
		const tr_data = data.sort(sortFxn)

		const t = self.input.term
		if (tableName == 'included_values_table') {
			const maxCount = Math.max(...tr_data.map(v => v.samplecount), 0)
			tr_data.forEach(v => (v.bar_width_frac = Number((1 - (maxCount - v.samplecount) / maxCount).toFixed(4))))
		}

		const trs = self.dom[tableName]
			.style('margin', '10px 5px')
			.style('border-spacing', '3px')
			.style('border-collapse', 'collapse')
			.selectAll('tr')
			.data(tr_data, b => b.key + b.label + b.bar_width_frac + (allowToSelectRefGrp ? '1' : '0'))
		/* FIXME upon changing binned numeric term to continuous
		this table won't rerender to disable row selection
		adding allowToSelectRefGrp at the end of data name won't help
		thus having to remove all rows at line 106
		*/

		trs.exit().remove()
		trs.each(trUpdate)
		trs
			.enter()
			.append('tr')
			.each(trEnter)

		// change color of excluded_values_table text
		if (tableName == 'excluded_values_table') {
			self.dom.excluded_values_table.selectAll('td').style('color', '#999')
		}
	}

	function trEnter(item) {
		const tr = select(this)
		const input = this.parentNode.__data__
		const t = input.term
		const maxBarWidth = 150

		tr.style('padding', '0 5px')
			.style('text-align', 'left')
			.style('cursor', input.termStatus.allowToSelectRefGrp ? 'pointer' : 'default')

		// sample count td
		tr.append('td')
			.style('padding', '1px 5px')
			.style('text-align', 'left')
			.style('color', 'black')
			.text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')

		// label td
		tr.append('td')
			.style('padding', '1px 5px')
			.style('text-align', 'left')
			.style('color', 'black')
			.text(item.label)

		// sample count bar td
		const bar_td = tr.append('td').style('padding', '1px 5px')

		// bar_width
		const barWidth = maxBarWidth * item.bar_width_frac
		bar_td
			.append('div')
			.style('margin', '1px 10px')
			.style('width', barWidth + 'px')
			.style('height', '15px')
			.style('background-color', '#ddd')

		addTrBehavior({ input, item, tr, rendered: false })
	}

	function trUpdate(item) {
		select(this.firstChild).text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')
		select(this.firstChild.nextSibling).text(item.label)

		const input = this.parentNode.__data__
		const t = input.term
		let rendered = true
		if ((t.q.mode == 'discrete' || t.q.mode == 'binary') && this.childNodes.length < 4) rendered = false
		addTrBehavior({ input, item, tr: select(this), rendered })
	}

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
			const reference_td = tr
				.append('td')
				.style('padding', '1px 5px')
				.style('text-align', 'left')

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
						ref_text
							.style('display', 'inline-block')
							.style('border', '')
							.text('Set as reference')
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
