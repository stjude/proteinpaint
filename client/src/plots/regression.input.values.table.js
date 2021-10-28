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
			if (!this.handler.input.term) {
				this.dom.holder.style('display', 'none')
				return
			}

			this.dom.holder.style('display', 'block')
			// hide loading.. text for categories after table is rendered
			this.dom.loading_div.style('display', 'block')
			await this.updateValueCount(this.handler.input)
			this.dom.loading_div.style('display', 'none')
			// FIXME: this condition seems unnecessary,
			// pill should have thrown before this is called
			if (!this.handler.error && !this.handler.pill.hasError()) {
				await this.render()
			}
		} catch (e) {
			this.dom.loading_div.style('display', 'none')
			throw e
		}
	}

	async updateValueCount(input) {
		const parent = input.section.parent
		const state = parent.state

		// query backend for total sample count for each value of categorical or condition terms
		// and included and excluded sample count for numeric term
		try {
			//if (input.term.id == 'sex') throw 'test'
			/*  !!! NOTE: assumes that term.q has already been validated !!! */
			// create a q copy to remove unnecessary parameters
			// from the server request
			const t = input.term
			const q = JSON.parse(JSON.stringify(t.q))
			delete q.values
			delete q.totalCount
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
			const totalCount = (t.q.totalCount = { included: 0, excluded: 0, total: 0 })
			this.sampleCounts.forEach(v => (totalCount.included = totalCount.included + v.samplecount))
			this.excludeCounts.forEach(v => (totalCount.excluded = totalCount.excluded + v.samplecount))
			totalCount.total = totalCount.included + totalCount.excluded

			// store total count from numerical/categorical term as global variable totalSampleCount
			if (parent.totalSampleCount == undefined && t.term.type != 'condition') parent.totalSampleCount = totalCount.total
			// for condition term, subtract included count from totalSampleCount to get excluded
			if (t.term.type == 'condition' && parent.totalSampleCount) {
				totalCount.excluded = parent.totalSampleCount - totalCount.included
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
			throw e
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
		//setActiveValues(t) // see function for FIXME
		updateRefGrp(self.handler)
		make_values_table(self.sampleCounts, 'values_table')
		render_summary_div(input, self.dom)

		if (self.excludeCounts.length) {
			make_values_table(self.excludeCounts, 'excluded_table')
		} else {
			dom.excluded_table.selectAll('*').remove()
		}
	}

	function setActiveValues(t) {
		/*
			FIXME: delete this function? 
			[self|input].values, .label_key are not used in the code? 
		*/

		const gs = t.q.groupsetting || {}
		const i = gs.inuse && gs.predefined_groupset_idx
		self.values = gs.inuse
			? i !== undefined
				? t.term.groupsetting.lst[i].groups
				: gs.customset && gs.customset.groups
			: t.term.values

		/* 
		FIXME: should use the following logic
		input.values = t.q.type == 'predefined-groupset'
			? t.term.groupsetting.lst[i]
			: t.q.type == 'custom-groupset'
			? gs.customset && gs.customset.groups
			: t.term.values
		*/
		self.label_key = t.q.type.endsWith('groupset') ? 'name' : 'label'
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
			if ((t.term.type !== 'integer' && t.term.type !== 'float') || t.q.mode == 'discrete' || t.q.mode == 'binary') {
				const parent = self.handler.input.section.parent

				if (!('refGrp' in self) && t.q && 'refGrp' in t.q) self.refGrp = t.q.refGrp

				if (!('refGrp' in self) || !tr_data.find(c => c.key === self.refGrp)) {
					if (t.id in parent.refGrpByTermId && tr_data.find(c => c.key === parent.refGrpByTermId[t.id])) {
						self.refGrp = parent.refGrpByTermId[t.id]
					} else {
						self.refGrp = tr_data[0].key
						parent.refGrpByTermId[t.id] = tr_data[0].key
					}
				} else if (!(t.id in parent.refGrpByTermId)) {
					// remember the refGrp by term.id
					parent.refGrpByTermId[t.id] = self.refGrp
				}
			}
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
				.style('display', item.key === self.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === self.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else {
			const reference_td = tr
				.append('td')
				.style('padding', '1px 5px')
				.style('text-align', 'left')

			ref_text = reference_td
				.append('div')
				.style('display', item.key === self.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('padding', '2px 10px')
				.style('border', item.key === self.refGrp && hover_flag ? '1px solid #bbb' : '')
				.style('border-radius', '10px')
				.style('color', '#999')
				.style('font-size', '.7em')
				.text('REFERENCE')
		}

		if (hover_flag) {
			tr.on('mouseover', () => {
				if (self.refGrp !== item.key) {
					tr.style('background', '#fff6dc')
					ref_text
						.style('display', 'inline-block')
						.style('border', '')
						.text('Set as reference')
				} else tr.style('background', 'white')
			})
				.on('mouseout', () => {
					tr.style('background', 'white')
					if (self.refGrp !== item.key) ref_text.style('display', 'none')
				})
				.on('click', () => {
					self.refGrp = item.key
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
		if (!q.totalCount) q.totalCount = { included: 0, excluded: 0, total: 0 }

		if (input.section.configKey == 'term') {
			dom.term_summmary_div.text(
				`${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
			)
			// QUICK FIX: hide top_info_div rightnow for linear regression,
			// for logistic regression, it needs to be changed as required
			dom.top_info_div.style('display', 'none')
		} else if (input.section.configKey == 'independent') {
			if (t.term.type == 'float' || t.term.type == 'integer') {
				dom.term_info_div.html(`Use as ${q.mode || 'continuous'} variable.` + (q.scale ? `Scale: Per ${q.scale}` : ''))
				dom.term_summmary_div.html(
					`${q.totalCount.included} sample included.` +
						(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded.` : '')
				)
			} else if (t.term.type == 'categorical' || t.term.type == 'condition') {
				const gs = q.groupsetting || {}
				// self.values is already set by parent.setActiveValues() above
				const term_text = 'Use as ' + self.sampleCounts.length + (gs.inuse ? ' groups.' : ' categories.')
				const summary_text =
					` ${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
				dom.term_info_div.html(term_text)
				dom.ref_click_prompt
					.style('padding', '5px 10px')
					.style('color', '#999')
					.style('text-transform', 'uppercase')
					.style('font-size', '.7em')
					.text('Click to set a row as reference.')
				dom.term_summmary_div.text(summary_text)
			}
		} else {
			throw `uknown input.section.configKey='${input.section.configKey}'`
		}
	}
}

/*** is this not used ***/
function updateRefGrp(handler) {
	const section = handler.input.section
	if (section.configKey != 'term') return
	const t = handler.input.term
	if (!t || section.parent.config.regressionType != 'logistic') return
	if (!('refGrp' in t.q) && t.q.lst) {
		t.q.refGrp = t.q.lst[0].label
		section.parent.refGrpByTermId[t.id] = t.q.lst[0].label
	}
}
