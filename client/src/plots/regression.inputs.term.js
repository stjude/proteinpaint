import { termsettingInit } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { get_bin_label } from '../../shared/termdb.bins'
import { InputValuesTable } from './regression.inputs.values.table'
import { Menu } from '../dom/menu'
import { select } from 'd3-selection'

/*
class instance is an input
*/

export class InputTerm {
	constructor(opts) {
		// opts { section, term, parent }
		this.opts = opts
		this.section = opts.section
		this.term = opts.term // term wrapper {id, term, q}; will be missing for a blank input
		this.parent = opts.parent // the inputs instance
	}

	init(holder) {
		// only run once when a new input variable is added to the user interface via data/enter() in inputs.js

		const termRow = holder.append('div')
		// the row contains two cells: left to show ts pill, right to show interaction
		const pillDiv = termRow.append('span')
		const interactionDiv = termRow.append('span').style('margin-left', '20px')

		this.dom = {
			holder,
			termRow,
			pillDiv,
			interactionDiv,
			err_div: holder
				.append('div')
				.style('display', 'none')
				.style('padding', '5px')
				.style('background-color', 'rgba(255,100,100,0.2)'),
			infoDiv: holder.append('div'),
			tip: new Menu()
		}

		try {
			const { app, config, state, disable_terms } = this.parent

			this.pill = termsettingInit({
				placeholder: this.section.selectPrompt,
				placeholderIcon: this.section.placeholderIcon,
				holder: this.dom.pillDiv,
				vocabApi: app.vocabApi,
				vocab: state.vocab,
				activeCohort: state.activeCohort,
				use_bins_less: true,
				debug: app.opts.debug,
				buttons: this.section.configKey == 'outcome' ? ['replace'] : ['delete'],
				numericEditMenuVersion: this.getMenuVersion(config),
				usecase: { target: 'regression', detail: this.section.configKey, regressionType: config.regressionType },
				disable_terms,
				abbrCutoff: 50,
				callback: term => {
					this.parent.editConfig(this, term)
				}
			})

			if (this.section.configKey == 'outcome') {
				// special treatment for terms selected for outcome
				this.setQ = getQSetter(config.regressionType)
			}

			this.valuesTable = new InputValuesTable({
				holder: this.dom.infoDiv,
				input: this,
				callback: term => {
					this.parent.editConfig(this, term)
				}
			})
		} catch (e) {
			this.displayError([e])
		}
	}

	getMenuVersion(config) {
		// for the numericEditMenuVersion of termsetting constructor option
		if (this.section.configKey == 'outcome') {
			// outcome
			if (config.regressionType == 'logistic') return ['binary']
			if (config.regressionType == 'linear') return ['continuous']
			throw 'unknown regressionType'
		}
		if (this.section.configKey == 'independent') {
			// independent
			return ['continuous', 'discrete']
		}
		throw 'unknown section.configKey: ' + this.section.configKey
	}

	displayError(errors) {
		this.hasError = true
		this.dom.err_div.selectAll('*').remove()
		this.dom.err_div
			.style('display', 'block')
			.selectAll('div')
			.data(Array.isArray(errors) ? errors : [errors])
			.enter()
			.append('div')
			.text(e => e)
		this.parent.handleError()
		console.error(errors)
	}

	async update() {
		/* called in inputs.main()
		when the regression component is notified of a change
		*/

		const tw = this.term // term wrapper

		// clear previous errors
		if (tw) {
			// a term has been selected
			delete tw.error
		}

		this.dom.err_div.style('display', 'none').text('')
		this.hasError = false

		const errors = []
		try {
			if (tw && this.setQ) {
				const { app, state } = this.parent
				await this.setQ[tw.term.type](tw, app.vocabApi, state.termfilter.filter)
			}

			try {
				await this.updateTerm()
			} catch (e) {
				// will allow pill to update to a new term as needed,
				// so that the rendered pill and values table match the error message
				errors.push(e)
			}

			await this.pill.main(this.getPillArgs())
			this.renderInteractionPrompt()
			await this.valuesTable.main()
			const e = (tw && tw.error) || this.pill.error
			if (e) errors.push(e)
			if (errors.length) throw errors
		} catch (errors) {
			this.displayError(errors)
		}
	}

	async updateTerm() {
		/*
		only used in handler.update() above
		to derive bins/groups based on q{} setting of this term
		create following attributes:

		input.orderedLabels
		input.totalCount
		input.sampleCounts
		input.excludeCounts
		input.term.refGrp
		*/
		const tw = this.term
		if (!tw) return

		if (!tw.q) throw '.term.q missing on this input'

		if (!tw.q.mode) {
			if (tw.term.type == 'categorical' || tw.term.type == 'condition') tw.q.mode = 'discrete'
			else tw.q.mode = 'continuous'
		}

		const q = JSON.parse(JSON.stringify(tw.q))
		/*
			for continuous term, assume it is numeric and that we'd want counts by bins,
			so remove the 'mode: continuous' value as it will prevent bin construction in the backend
		*/
		if (q.mode == 'continuous') delete q.mode

		const data = await this.parent.app.vocabApi.getCategories(tw, this.parent.state.termfilter.filter, [
			'term1_q=' + encodeURIComponent(JSON.stringify(q))
		])
		if (data.error) throw data.error
		this.orderedLabels = data.orderedLabels

		// sepeate include and exclude categories based on term.values.uncomputable
		const excluded_values = tw.term.values
			? Object.entries(tw.term.values)
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
		if (tw.term.type == 'condition' && totalCount.total) {
			totalCount.excluded = totalCount.total - totalCount.included
		}

		if (tw && tw.q.mode !== 'continuous' && this.sampleCounts.length < 2)
			throw `there should be two or more discrete values with samples for variable='${tw.term.name}'`

		if (!tw.q.mode) throw 'q.mode missing'

		// set term.refGrp
		if (tw.q.mode == 'continuous') {
			tw.refGrp = 'NA' // hardcoded in R
		} else if (!('refGrp' in tw) || !this.sampleCounts.find(i => i.key == tw.refGrp)) {
			// refGrp not defined or no longer exists according to sampleCounts[]
			const o = this.orderedLabels
			if (o.length) this.sampleCounts.sort((a, b) => o.indexOf(a.key) - o.indexOf(b.key))
			else this.sampleCounts.sort((a, b) => (a.samplecount < b.samplecount ? 1 : -1))
			tw.refGrp = this.sampleCounts[0].key
		}
	}

	getPillArgs() {
		const section = this.section
		const { config, state, disable_terms } = this.parent
		const args = Object.assign(
			{
				disable_terms,
				exclude_types: section.exclude_types,
				usecase: {
					target: 'regression',
					detail: section.configKey,
					regressionType: config.regressionType
				}
			},
			this.term
		)
		args.filter = state.termfilter.filter
		return args
	}

	remove() {
		this.dom.termRow
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()

		for (const key in this.dom) {
			delete this.dom[key]
		}
	}

	renderInteractionPrompt() {
		if (!this.term || this.section.configKey != 'independent' || this.section.inputs.filter(i => i.term).length < 2) {
			this.dom.interactionDiv.style('display', 'none')
			return
		}

		const n = this.term.interactions.length
		this.dom.interactionDiv
			.style('display', 'inline')
			.html(n == 0 ? '+ Interaction' : `${n} Interaction${n > 1 ? 's' : ''}`)
			.style('padding', '5px')
			.style('background-color', n == 0 ? null : '#ececec')
			.style('border-radius', n == 0 ? null : '6px')
			.style('color', n == 0 ? 'rgb(153, 153, 153)' : '#000')
			.style('font-size', n == 0 ? '0.8em' : '')
			.style('cursor', 'pointer')
			.on('click', () => this.renderInteractionOptions())
	}

	renderInteractionOptions() {
		const self = this
		self.dom.tip.clear().showunder(self.dom.interactionDiv.node())
		self.dom.tip.d
			.append('div')
			.style('padding', '5px')
			.style('font-size', '0.8em')
			.style('color', 'rgb(153, 153, 153)')
			.html(`Selected variables will each form pairwise interaction with ${this.term.term.name}`)

		self.dom.tip.d
			.append('div')
			.selectAll('div')
			.data(self.parent.config.independent.filter(tw => tw && tw.id !== self.term.id))
			.enter()
			.append('div')
			.style('margin', '5px')
			.each(function(tw) {
				const elem = select(this).append('label')
				const checkbox = elem
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', self.term.interactions.includes(tw.id))

				elem.append('span').text(' ' + tw.term.name)
			})

		self.dom.tip.d
			.append('button')
			.text('Apply')
			.style('margin', '5px')
			.on('click', () => {
				self.dom.tip.hide()
				self.term.interactions = []
				self.dom.tip.d.selectAll('input').each(function(tw) {
					if (select(this).property('checked')) self.term.interactions.push(tw.id)
				})
				for (const tw of self.parent.config.independent) {
					const i = tw.interactions.indexOf(self.term.id)
					if (self.term.interactions.includes(tw.id)) {
						if (i == -1) tw.interactions.push(self.term.id)
					} else if (i != -1) {
						tw.interactions.splice(i, 1)
					}
				}
				self.parent.editConfig(self, self.term)
			})
	}
}

function getQSetter(regressionType) {
	return {
		integer: regressionType == 'logistic' ? maySetTwoBins : setContMode,
		float: regressionType == 'logistic' ? maySetTwoBins : setContMode,
		categorical: maySetTwoGroups,
		condition: maySetTwoGroups
	}
}

// query backend for median and create custom 2 bins with median and boundry
// for logistic independet numeric terms
async function maySetTwoBins(tw, vocabApi, filter) {
	// if the bins are already binary, do not reset
	if (tw.q.mode == 'binary' && tw.q.lst && tw.q.lst.length == 2) {
		tw.q.mode = 'binary'
		return
	}

	const data = await vocabApi.getPercentile(tw.id, 50, filter)
	if (data.error || !Number.isFinite(data.value)) throw 'cannot get median value: ' + (data.error || 'no data')
	const median = tw.term.type == 'integer' ? Math.round(data.value) : Number(data.value.toFixed(2))
	tw.q = {
		mode: 'binary',
		type: 'custom',
		lst: [
			{
				startunbounded: true,
				stopinclusive: true,
				stop: median
			},
			{
				stopunbounded: true,
				startinclusive: false,
				start: median
			}
		]
	}

	tw.q.lst.forEach(bin => {
		bin.label = get_bin_label(bin, tw.q)
	})

	tw.refGrp = tw.q.lst[0].label
}

async function maySetTwoGroups(tw, vocabApi, filter) {
	// if the bins are already binary, do not reset
	const { term, q } = tw
	if (q.mode == 'binary') {
		if (q.type == 'values' && Object.keys(term.values).length == 2) return
		if (q.type == 'predefined-groupset') {
			const idx = q.groupsetting.predefined_groupset_idx
			const t_gs = term.groupsetting
			if (t_gs[idx] && Object.keys(t_gs[idx]).length == 2) return
		}
		if (q.type == 'custom-groupset') {
			const gs = q.groupsetting.customset
			if (gs.groups.length == 2) return
		}
	} else {
		q.mode = 'binary'
	}

	// category and condition terms share some logic

	// step 1: check if term has only two computable categories/grades with >0 samples
	// if so, use the two categories as outcome and do not apply groupsetting

	// check the number of samples for computable categories, only use categories with >0 samples

	// q should not have groupsetting enabled, as we only want to get number of cases for categories/grades
	// TODO detect if groupsetting is enabled, then turn it off??
	const lst = ['term1_q=' + encodeURIComponent(JSON.stringify(q))]
	const data = await vocabApi.getCategories(term, filter, lst)
	if (data.error) throw 'cannot get categories: ' + data.error
	const category2samplecount = new Map() // k: category/grade, v: number of samples
	const computableCategories = [] // list of computable keys
	for (const i of data.lst) {
		category2samplecount.set(i.key, i.samplecount)
		if (term.values && term.values[i.key] && term.values[i.key].uncomputable) continue
		computableCategories.push(i.key)
	}
	if (computableCategories.length < 2) {
		// TODO UI should reject this term and prompt user to select a different one
		q.type = 'values'
		input.term.error = 'less than 2 categories/grades - cannot create separate groups'
		return
	}
	if (computableCategories.length == 2) {
		q.type = 'values'
		// will use the categories from term.values{} and do not apply groupsetting
		// if the two grades happen to be "normal" and "disease" then it will make sense
		// but if the two grades are both diseaes then may not make sense
		// e.g. secondary breast cancer has just 3 and 4
		return
	}

	const t_gs = term.groupsetting
	const q_gs = q.groupsetting
	// step 2: term has 3 or more categories/grades. must apply groupsetting
	// force to turn on groupsetting
	q_gs.inuse = true

	// step 3: find if term already has a usable groupsetting
	if (
		q_gs.customset &&
		q_gs.customset.groups &&
		q_gs.customset.groups.length == 2 &&
		groupsetNoEmptyGroup(q_gs.customset, category2samplecount)
	) {
		q.type = 'custom-groupset'
		// has a usable custom set
		return
	}

	// step 4: check if the term has predefined groupsetting
	if (t_gs && t_gs.lst) {
		// has predefined groupsetting
		// note!!!! check on input.term.term but not input.term.q

		if (
			q_gs.predefined_groupset_idx >= 0 &&
			t_gs.lst[q_gs.predefined_groupset_idx] &&
			t_gs.lst[q_gs.predefined_groupset_idx].groups.length == 2 &&
			groupsetNoEmptyGroup(t_gs.lst[q_gs.predefined_groupset_idx], category2samplecount)
		) {
			// has a usable predefined groupset
			q.type = 'predefined-groupset'
			return
		}

		// step 5: see if any predefined groupset has 2 groups. if so, use that
		const i = t_gs.lst.findIndex(g => g.groups.length == 2)
		if (i != -1 && groupsetNoEmptyGroup(t_gs.lst[i], category2samplecount)) {
			// found a usable groupset
			q_gs.predefined_groupset_idx = i
			q.type = 'predefined-groupset'
			return
		}
	}

	// step 6: last resort. divide values[] array into two groups
	const customset = {
		groups: [
			{
				name: 'Group 1',
				values: []
			},
			{
				name: 'Group 2',
				values: []
			}
		]
	}
	// TODO use category2samplecount to evenlly divide samples
	const group_i_cutoff = Math.round(computableCategories.length / 2)
	for (const [i, v] of computableCategories.entries()) {
		if (i < group_i_cutoff) customset.groups[0].values.push({ key: v })
		else customset.groups[1].values.push({ key: v })
	}
	q_gs.customset = customset
	q.type = 'custom-groupset'
}

function setContMode(tw) {
	if (!tw.q.type) {
		console.log('may not happen: why is input.term.q not yet set for numeric term at this point')
		// should already be set to default bins
	}
	tw.q.mode = 'continuous'
}

function groupsetNoEmptyGroup(gs, c2s) {
	// return true if a groupset does not have empty group
	for (const g of gs.groups) {
		let total = 0
		for (const i of g.values) total += c2s.get(i.key) || 0
		if (total == 0) return false
	}
	return true
}
