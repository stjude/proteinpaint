import { getNormalRoot } from '../common/filter'
import { select } from 'd3-selection'
import { dofetch3 } from '../client'

export class InputValuesTable {
	constructor(opts) {
		this.opts = opts
		this.handler = opts.handler
		setRenderers(this)
		this.setDOM(opts.holder)
	}

	async main() {
		try {
			const input = this.handler.input
			const t = input.term
			if (!t) {
				this.dom.holder.style('display', 'none')
				return
			}
			delete t.error
			this.dom.holder.style('display', 'block')
			this.dom.loading_div.style('display', 'block')
			await this.updateValueCount(input)
			this.mayUpdateModeRefGrp(input, input.section.parent.refGrpByTermId)
			this.dom.loading_div.style('display', 'none')
			this.render()
			if (t.error) throw t.error
		} catch (e) {
			this.dom.loading_div.style('display', 'none')
			throw e
		}
	}

	async updateValueCount(input) {
		const parent = input.section.parent
		const state = parent.state
		const t = input.term

		// query backend for total sample count for each value of categorical or condition terms
		// and included and excluded sample count for numeric term
		try {
			//if (input.term.id == 'sex') throw 'test'
			/*  !!! NOTE: assumes that term.q has already been validated !!! */
			// create a q copy to remove unnecessary parameters
			// from the server request
			const q = JSON.parse(JSON.stringify(t.q))
			/*
				for continuous term, assume it is numeric and that we'd want counts by bins,
				so remove the 'mode: continuous' value as it will prevent bin construction in the backend
			*/
			if (q.mode == 'continuous') delete q.mode
			const lst = [
				'/termdb?getcategories=1',
				'tid=' + t.term.id,
				'term1_q=' + encodeURIComponent(JSON.stringify(q)),
				'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(state.termfilter.filter))),
				'genome=' + state.vocab.genome,
				'dslabel=' + state.vocab.dslabel
			]
			if (q.bar_by_grade) lst.push('bar_by_grade=1')
			if (q.bar_by_children) lst.push('bar_by_children=1')
			if (q.value_by_max_grade) lst.push('value_by_max_grade=1')
			if (q.value_by_most_recent) lst.push('value_by_most_recent=1')
			if (q.value_by_computable_grade) lst.push('value_by_computable_grade=1')
			const url = lst.join('&')
			const data = await dofetch3(url)
			if (data.error) throw data.error
			this.orderedLabels = data.orderedLabels

			// sepeate include and exclude categories based on term.values.uncomputable
			const excluded_values = t.term.values
				? Object.entries(t.term.values)
						.filter(v => v[1].uncomputable)
						.map(v => v[1].label)
				: []
			this.sampleCounts = data.lst.filter(v => !excluded_values.includes(v.label))
			this.excludeCounts = data.lst.filter(v => excluded_values.includes(v.label))

			// get include, excluded and total sample count
			const totalCount = (this.totalCount = { included: 0, excluded: 0, total: 0 })
			this.sampleCounts.forEach(v => (totalCount.included += v.samplecount))
			this.excludeCounts.forEach(v => (totalCount.excluded += v.samplecount))
			totalCount.total = totalCount.included + totalCount.excluded
			// for condition term, subtract included count from totalCount.total to get excluded
			if (t.term.type == 'condition' && totalCount.total) {
				totalCount.excluded = totalCount.total - totalCount.included
			}

			if (t && t.q.mode !== 'continuous' && Object.keys(this.sampleCounts).length < 2) {
				throw `there should be two or more discrete values with samples for variable='${t.term.name}'`
			}

			/* TODO: may need to move validateQ out of a ts.pill */
			if (this.handler.pill && this.handler.pill.validateQ) {
				this.handler.pill.validateQ({
					term: t.term,
					q: t.q,
					sampleCounts: this.sampleCounts
				})
			}
		} catch (e) {
			t.error = e
		}
	}

	mayUpdateModeRefGrp(input, refGrpByTermId) {
		const t = input.term
		if (!t.q.mode) {
			if (t.term.type == 'categorical' || t.term.type == 'condition') t.q.mode = 'discrete'
			else t.q.mode = 'continuous'
		}
		if (t.q.mode == 'continuous') {
			delete t.q.refGrp
			return
		}
		if (!('refGrp' in t.q) && t.id in refGrpByTermId) {
			t.q.refGrp = refGrpByTermId[t.id]
			return
		}
		if (!('refGrp' in t.q) || !this.sampleCounts.find(s => s.key === t.q.refGrp)) {
			// default to the first value or group
			t.q.refGrp = this.sampleCounts[0].key
		}
		refGrpByTermId[t.id] = t.q.refGrp
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
		make_values_table(self.sampleCounts, 'values_table')
		render_summary_div(input, self.dom)

		if (self.excludeCounts.length) {
			make_values_table(self.excludeCounts, 'excluded_table')
		} else {
			dom.excluded_table.selectAll('*').remove()
		}
	}

	function make_values_table(data, tableName = 'values_table') {
		const sortFxn =
			self.orderedLabels && self.orderedLabels.length
				? (a, b) => self.orderedLabels.indexOf(a.label) - self.orderedLabels.indexOf(b.label)
				: (a, b) => b.samplecount - a.samplecount
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
		//d.values_table.selectAll('tr').sort((a,b) => d.sampleCounts[b.key] - d.sampleCounts[a.key])

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
				.style('display', item.key === t.q.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === t.q.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else {
			const reference_td = tr
				.append('td')
				.style('padding', '1px 5px')
				.style('text-align', 'left')

			ref_text = reference_td
				.append('div')
				.style('display', item.key === t.q.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('padding', '2px 10px')
				.style('border', item.key === t.q.refGrp && hover_flag ? '1px solid #bbb' : '')
				.style('border-radius', '10px')
				.style('color', '#999')
				.style('font-size', '.7em')
				.text('REFERENCE')
		}

		if (hover_flag) {
			tr.on('mouseover', () => {
				if (t.q.refGrp !== item.key) {
					tr.style('background', '#fff6dc')
					ref_text
						.style('display', 'inline-block')
						.style('border', '')
						.text('Set as reference')
				} else tr.style('background', 'white')
			})
				.on('mouseout', () => {
					tr.style('background', 'white')
					if (t.q.refGrp !== item.key) ref_text.style('display', 'none')
				})
				.on('click', () => {
					t.q.refGrp = item.key
					self.handler.input.section.parent.refGrpByTermId[t.id] = item.key
					//d.term.q.refGrp = item.key
					ref_text.style('border', '1px solid #bbb').text('REFERENCE')
					make_values_table(self.sampleCounts, 'values_table')
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
		const { included, excluded, total } = self.totalCount

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
				const term_text = 'Use as ' + self.sampleCounts.length + (gs.inuse ? ' groups.' : ' categories.')
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
