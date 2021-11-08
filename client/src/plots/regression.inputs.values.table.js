import { select } from 'd3-selection'

// this sub component is currently hardcoded for varClass=term and accesses input.term without checking varClass
// later may be generally applicable to any varClass?

export class InputValuesTable {
	constructor(opts) {
		this.opts = opts
		this.handler = opts.handler
		setRenderers(this)
		this.setDOM(opts.holder)
	}

	main() {
		try {
			const input = this.handler.input
			const variable = input[input.varClass]
			if (!variable) {
				this.dom.holder.style('display', 'none')
				return
			}
			delete variable.error
			this.dom.holder.style('display', 'block')
			this.dom.loading_div.style('display', 'block')
			this.updateValueCount(input)
			this.dom.loading_div.style('display', 'none')
			this.render()
			if (variable.error) throw variable.error
		} catch (e) {
			this.dom.loading_div.style('display', 'none')
			throw e
		}
	}

	updateValueCount(input) {
		// TODO may detect condition varClass=term
		const t = input.term

		try {
			/* TODO: may need to move validateQ out of a ts.pill */
			if (this.handler.pill && this.handler.pill.validateQ) {
				this.handler.pill.validateQ({
					term: t.term,
					q: t.q,
					sampleCounts: input.sampleCounts
				})
			}
		} catch (e) {
			t.error = e
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

		const top_info_div = holder.append('div')
		const values_div = holder.append('div')

		self.dom = {
			holder,
			loading_div: holder.append('div').text('Loading..'),

			top_info_div,
			term_info_div: top_info_div.append('div').style('display', 'inline-block'),
			ref_click_prompt: top_info_div.append('div').style('display', 'inline-block'),

			values_div,
			values_table: values_div.append('table'),
			term_summmary_div: values_div.append('div'),
			excluded_table: values_div.append('table')
		}
	}

	self.render = () => {
		const dom = self.dom
		const input = self.handler.input
		const t = input.term
		make_values_table(self.handler.input.sampleCounts, 'values_table')
		render_summary_div(input, self.dom)

		if (self.handler.input.excludeCounts.length) {
			make_values_table(self.handler.input.excludeCounts, 'excluded_table')
		} else {
			dom.excluded_table.selectAll('*').remove()
		}
	}

	function make_values_table(data, tableName = 'values_table') {
		const l = self.handler.input.orderedLabels
		const sortFxn =
			l && l.length ? (a, b) => l.indexOf(a.label) - l.indexOf(b.label) : (a, b) => b.samplecount - a.samplecount
		const tr_data = data.sort(sortFxn)

		const t = self.handler.input.term
		if (tableName == 'values_table') {
			const maxCount = Math.max(...tr_data.map(v => v.samplecount), 0)
			tr_data.forEach(v => (v.bar_width_frac = Number((1 - (maxCount - v.samplecount) / maxCount).toFixed(4))))
		}

		const isContinuousTerm = t && t.q.mode == 'continuous' && (t.term.type == 'float' || t.term.type == 'integer')

		const trs = self.dom[tableName]
			.style('margin', '10px 5px')
			.style('border-spacing', '3px')
			.style('border-collapse', 'collapse')
			.selectAll('tr')
			.data(tr_data, isContinuousTerm ? (b, i) => i : b => b.key + b.label + b.bar_width_frac)

		trs.exit().remove()
		trs.each(trUpdate)
		trs
			.enter()
			.append('tr')
			.each(trEnter)

		// change color of excluded_table text
		if (tableName == 'excluded_table') {
			self.dom.excluded_table.selectAll('td').style('color', '#999')
		}
	}

	function trEnter(item) {
		const tr = select(this)
		const input = this.parentNode.__data__
		const t = input.term
		const maxBarWidth = 150

		tr.style('padding', '0 5px')
			.style('text-align', 'left')
			.style('cursor', t.term.type === 'integer' || t.term.type === 'float' ? 'default' : 'pointer')

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

	function addTrBehavior(args) {
		const { input, item, tr, rendered } = args
		// don't add tr effects for excluded values
		if (!item.bar_width_frac) return

		const t = input.term
		const hover_flag =
			(t.term.type !== 'integer' && t.term.type !== 'float') || t.q.mode == 'discrete' || t.q.mode == 'binary'
		let ref_text

		if (rendered) {
			tr.style('background', 'white')
			ref_text = select(tr.node().lastChild)
				.select('div')
				.style('display', item.key === t.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === t.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else {
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
		}

		if (hover_flag) {
			tr.on('mouseover', () => {
				if (t.refGrp !== item.key) {
					tr.style('background', '#fff6dc')
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
					make_values_table(self.handler.input.sampleCounts, 'values_table')
				})
		} else {
			tr.on('mouseover', null)
				.on('mouseout', null)
				.on('click', null)
		}
	}

	function render_summary_div(input, dom) {
		const t = input.term
		const q = (t && t.q) || {}
		const { included, excluded, total } = self.handler.input.totalCount

		if (input.section.configKey == 'outcome') {
			dom.term_summmary_div.text(`${included} sample included.` + (excluded ? ` ${excluded} samples excluded:` : ''))
			// QUICK FIX: hide top_info_div rightnow for linear regression,
			// for logistic regression, it needs to be changed as required
			dom.top_info_div.style('display', 'none')
		} else if (input.section.configKey == 'independent') {
			if (t.term.type == 'float' || t.term.type == 'integer') {
				dom.term_info_div.html(`Use as ${q.mode || 'continuous'} variable.` + (q.scale ? `Scale: Per ${q.scale}` : ''))
				dom.term_summmary_div.html(`${included} sample included.` + (excluded ? ` ${excluded} samples excluded.` : ''))
			} else if (t.term.type == 'categorical' || t.term.type == 'condition') {
				const gs = q.groupsetting || {}
				// self.values is already set by parent.setActiveValues() above
				const term_text = 'Use as ' + self.handler.input.sampleCounts.length + (gs.inuse ? ' groups.' : ' categories.')
				const summary_text = ` ${included} sample included.` + (excluded ? ` ${excluded} samples excluded:` : '')
				dom.term_info_div.html(term_text)
				dom.term_summmary_div.text(summary_text)
				dom.ref_click_prompt
					.style('padding', '5px 10px')
					.style('color', '#999')
					.style('text-transform', 'uppercase')
					.style('font-size', '.7em')
					.text('Click to set a row as reference.')
			}
		} else {
			throw `uknown input.section.configKey='${input.section.configKey}'`
		}
	}
}
