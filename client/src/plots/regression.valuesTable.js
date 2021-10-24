import { getNormalRoot } from '../common/filter'
import { select } from 'd3-selection'
import { dofetch3 } from '../client'

export function setValuesTableMethods(self) {
	self.addValuesTable = d => {
		d.dom.loading_div = d.dom.infoDiv.append('div').text('Loading..')
		d.dom.top_info_div = d.dom.infoDiv.append('div')
		;(d.dom.term_info_div = d.dom.top_info_div.append('div').style('display', 'inline-block')),
			(d.dom.ref_click_prompt = d.dom.top_info_div.append('div').style('display', 'inline-block'))

		d.dom.term_values_div = d.dom.infoDiv.append('div')
		d.dom.values_table = d.dom.term_values_div.append('table')
		d.dom.term_summmary_div = d.dom.term_values_div.append('div')
		d.dom.excluded_table = d.dom.term_values_div.append('table')
	}

	self.updateValuesTable = async d => {
		if (!d.term) {
			d.dom.infoDiv.style('display', 'none')
			return
		}

		d.dom.infoDiv
			.style('display', 'block')
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')
		try {
			await updateValueCount(d)
			if (!self.error && !d.pill.hasError()) await updateTermInfoDiv(d)
		} catch (e) {
			console.log(26, e)
			self.hasError = true
			d.dom.err_div.style('display', 'block').text(e)
			d.dom.loading_div.style('display', 'none')
			self.dom.submitBtn.property('disabled', true)
			console.error(e)
		}
	}

	function updateRefGrp(d) {
		if (d.section.configKey != 'term') return
		if (!d.term || self.config.regressionType != 'logistic') return
		if (!('refGrp' in d.term.q) && d.term.q.lst) {
			d.term.q.refGrp = d.term.q.lst[0].label
			self.refGrpByTermId[d.term.id] = d.term.q.lst[0].label
		}
	}

	async function updateValueCount(d) {
		// query backend for total sample count for each value of categorical or condition terms
		// and included and excluded sample count for numeric term
		try {
			/*  !!! NOTE: assumes that term.q has already been validated !!! */
			// create a q copy to remove unnecessary parameters
			// from the server request
			const q = JSON.parse(JSON.stringify(d.term.q))
			delete q.values
			delete q.totalCount
			/*
				for continuous term, assume it is numeric and that we'd want counts by bins,
				so remove the 'mode: continuous' value as it will prevent bin construction in the backend
			*/
			if (q.mode == 'continuous') delete q.mode
			const lst = [
				'/termdb?getcategories=1',
				'tid=' + d.term.id,
				'term1_q=' + encodeURIComponent(JSON.stringify(q)),
				'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(self.state.termfilter.filter))),
				'genome=' + self.state.vocab.genome,
				'dslabel=' + self.state.vocab.dslabel
			]
			if (q.bar_by_grade) lst.push('bar_by_grade=1')
			if (q.bar_by_children) lst.push('bar_by_children=1')
			if (q.value_by_max_grade) lst.push('value_by_max_grade=1')
			if (q.value_by_most_recent) lst.push('value_by_most_recent=1')
			if (q.value_by_computable_grade) lst.push('value_by_computable_grade=1')
			const url = lst.join('&')
			const data = await dofetch3(url)
			if (data.error) throw data.error
			d.orderedLabels = data.orderedLabels

			// sepeate include and exclude categories based on term.values.uncomputable
			const excluded_values = d.term.term.values
				? Object.entries(d.term.term.values)
						.filter(v => v[1].uncomputable)
						.map(v => v[1].label)
				: []
			d.sampleCounts = data.lst.filter(v => !excluded_values.includes(v.label))
			d.excludeCounts = data.lst.filter(v => excluded_values.includes(v.label))

			// get include, excluded and total sample count
			const totalCount = (d.term.q.totalCount = { included: 0, excluded: 0, total: 0 })
			d.sampleCounts.forEach(v => (totalCount.included = totalCount.included + v.samplecount))
			d.excludeCounts.forEach(v => (totalCount.excluded = totalCount.excluded + v.samplecount))
			totalCount.total = totalCount.included + totalCount.excluded

			// store total count from numerical/categorical term as global variable totalSampleCount
			if (self.totalSampleCount == undefined && d.term.term.type != 'condition')
				self.totalSampleCount = totalCount.total
			// for condition term, subtract included count from totalSampleCount to get excluded
			if (d.term.term.type == 'condition' && self.totalSampleCount) {
				totalCount.excluded = self.totalSampleCount - totalCount.included
			}

			if (d.term.q.mode !== 'continuous' && Object.keys(d.sampleCounts).length < 2) {
				throw `there should be two or more discrete values with samples for variable='${d.term.term.name}'`
			}

			/* TODO: may need to move validateQ out of a ts.pill */
			if (d.pill && d.pill.validateQ) {
				d.pill.validateQ({
					term: d.term.term,
					q: d.term.q,
					sampleCounts: d.sampleCounts
				})
			}
		} catch (e) {
			throw e
		}
	}

	function updateTermInfoDiv(d) {
		setActiveValues(d)
		const q = (d.term && d.term.q) || {}
		if (!q.totalCount) q.totalCount = { included: 0, excluded: 0, total: 0 }
		if (d.section.configKey == 'independent') {
			if (d.term.term.type == 'float' || d.term.term.type == 'integer') {
				make_values_table(d)
				d.dom.term_info_div.html(
					`Use as ${q.mode || 'continuous'} variable.` + (q.scale ? `Scale: Per ${q.scale}` : '')
				)
				d.dom.term_summmary_div.html(
					`${q.totalCount.included} sample included.` +
						(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded.` : '')
				)
			} else if (d.term.term.type == 'categorical' || d.term.term.type == 'condition') {
				const gs = q.groupsetting || {}
				// d.values is already set by self.setActiveValues() above
				const term_text = 'Use as ' + d.sampleCounts.length + (gs.inuse ? ' groups.' : ' categories.')
				make_values_table(d)
				const summary_text =
					` ${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
				d.dom.term_info_div.html(term_text)
				d.dom.ref_click_prompt
					.style('padding', '5px 10px')
					.style('color', '#999')
					.style('text-transform', 'uppercase')
					.style('font-size', '.7em')
					.text('Click to set a row as reference.')
				d.dom.term_summmary_div.text(summary_text)
			}
		} else if (d.section.configKey == 'term') {
			make_values_table(d)
			d.dom.term_summmary_div.text(
				`${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
			)
			// QUICK FIX: hide top_info_div rightnow for linear regression,
			// for logistic regression, it needs to be changed as required
			d.dom.top_info_div.style('display', 'none')
		}
		if (d.excludeCounts.length) {
			make_values_table(d, true)
		} else {
			d.dom.excluded_table.selectAll('*').remove()
		}
		// hide loading.. text for categories after table is rendered
		d.dom.loading_div.style('display', 'none')
	}

	function make_values_table(d, excluded) {
		const sortFxn =
			d.orderedLabels && d.orderedLabels.length
				? (a, b) => d.orderedLabels.indexOf(a.label) - d.orderedLabels.indexOf(b.label)
				: (a, b) => b.samplecount - a.samplecount
		const tr_data = excluded ? d.excludeCounts.sort(sortFxn) : d.sampleCounts.sort(sortFxn)

		if (!excluded) {
			const maxCount = Math.max(...tr_data.map(v => v.samplecount), 0)
			tr_data.forEach(v => (v.bar_width_frac = Number((1 - (maxCount - v.samplecount) / maxCount).toFixed(4))))
			if (
				(d.term.term.type !== 'integer' && d.term.term.type !== 'float') ||
				d.term.q.mode == 'discrete' ||
				d.term.q.mode == 'binary'
			) {
				if (!('refGrp' in d) && d.term.q && 'refGrp' in d.term.q) d.refGrp = d.term.q.refGrp

				if (!('refGrp' in d) || !tr_data.find(c => c.key === d.refGrp)) {
					if (d.term.id in self.refGrpByTermId && tr_data.find(c => c.key === self.refGrpByTermId[d.term.id])) {
						d.refGrp = self.refGrpByTermId[d.term.id]
					} else {
						d.refGrp = tr_data[0].key
						self.refGrpByTermId[d.term.id] = tr_data[0].key
					}
				} else if (!(d.term.id in self.refGrpByTermId)) {
					// remember the refGrp by term.id
					self.refGrpByTermId[d.term.id] = d.refGrp
				}
			}
		}

		const table = excluded ? d.dom.excluded_table : d.dom.values_table
		const isContinuousTerm =
			d.term && d.term.q.mode == 'continuous' && (d.term.term.type == 'float' || d.term.term.type == 'integer')

		const trs = table
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
		if (excluded) d.dom.excluded_table.selectAll('td').style('color', '#999')
	}

	function trEnter(item) {
		const tr = select(this)
		const d = this.parentNode.__data__
		const maxBarWidth = 150

		tr.style('padding', '0 5px')
			.style('text-align', 'left')
			.style('cursor', d.term.term.type === 'integer' || d.term.term.type === 'float' ? 'default' : 'pointer')

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

		addTrBehavior({ d, item, tr, rendered: false })
	}

	function trUpdate(item) {
		const pillData = this.parentNode.__data__
		select(this.firstChild).text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')
		select(this.firstChild.nextSibling).text(item.label)
		let rendered = true
		if ((pillData.term.q.mode == 'discrete' || pillData.term.q.mode == 'binary') && this.childNodes.length < 4)
			rendered = false
		addTrBehavior({ d: pillData, item, tr: select(this), rendered })
	}

	function addTrBehavior(args) {
		const { d, item, tr, rendered } = args
		// don't add tr effects for excluded values
		if (!item.bar_width_frac) return

		const hover_flag =
			(d.term.term.type !== 'integer' && d.term.term.type !== 'float') ||
			d.term.q.mode == 'discrete' ||
			d.term.q.mode == 'binary'
		let ref_text

		if (rendered) {
			tr.style('background', 'white')
			ref_text = select(tr.node().lastChild)
				.select('div')
				.style('display', item.key === d.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === d.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else {
			const reference_td = tr
				.append('td')
				.style('padding', '1px 5px')
				.style('text-align', 'left')

			ref_text = reference_td
				.append('div')
				.style('display', item.key === d.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('padding', '2px 10px')
				.style('border', item.key === d.refGrp && hover_flag ? '1px solid #bbb' : '')
				.style('border-radius', '10px')
				.style('color', '#999')
				.style('font-size', '.7em')
				.text('REFERENCE')
		}

		if (hover_flag) {
			tr.on('mouseover', () => {
				if (d.refGrp !== item.key) {
					tr.style('background', '#fff6dc')
					ref_text
						.style('display', 'inline-block')
						.style('border', '')
						.text('Set as reference')
				} else tr.style('background', 'white')
			})
				.on('mouseout', () => {
					tr.style('background', 'white')
					if (d.refGrp !== item.key) ref_text.style('display', 'none')
				})
				.on('click', () => {
					d.refGrp = item.key
					self.refGrpByTermId[d.term.id] = item.key
					//d.term.q.refGrp = item.key
					ref_text.style('border', '1px solid #bbb').text('REFERENCE')
					make_values_table(d)
				})
		} else {
			tr.on('mouseover', null)
				.on('mouseout', null)
				.on('click', null)
		}
	}
}

function setActiveValues(d) {
	const gs = d.term.q.groupsetting || {}
	const i = gs.inuse && gs.predefined_groupset_idx
	d.values = gs.inuse
		? i !== undefined
			? d.term.term.groupsetting.lst[i].groups
			: gs.customset && gs.customset.groups
		: d.term.term.values
	d.label_key = gs.inuse ? 'name' : 'label'
}
