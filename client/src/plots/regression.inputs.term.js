import { termsettingInit } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { get_bin_label } from '../../shared/termdb.bins'
import { InputValuesTable } from './regression.inputs.values.table'

/*
class instance is the handler object of an input
*/

export class InputTerm {
	constructor(opts) {
		this.opts = opts
		this.input = opts.input

		this.dom = {
			holder: opts.holder,
			pillDiv: opts.holder.append('div'),
			err_div: opts.holder
				.append('div')
				.style('display', 'none')
				.style('padding', '5px')
				.style('background-color', 'rgba(255,100,100,0.2)'),
			infoDiv: opts.holder.append('div')
		}

		this.init()
	}

	init() {
		try {
			// reference shortcuts from this.input
			const section = this.input.section
			const { app, config, state, disable_terms, editConfig } = section.parent

			this.pill = termsettingInit({
				placeholder: section.selectPrompt,
				placeholderIcon: section.placeholderIcon,
				holder: this.dom.pillDiv,
				vocabApi: app.vocabApi,
				vocab: state.vocab,
				activeCohort: state.activeCohort,
				use_bins_less: true,
				debug: app.opts.debug,
				buttons: section.configKey == 'outcome' ? ['replace'] : ['delete'],
				numericEditMenuVersion: getMenuVersion(config, this.input),
				usecase: { target: 'regression', detail: section.configKey, regressionType: config.regressionType },
				disable_terms,
				abbrCutoff: 50,
				callback: term => {
					editConfig(this.input, term)
				}
			})

			if (section.configKey == 'outcome') {
				// special treatment for terms selected for outcome
				this.setQ = getQSetter(config.regressionType)
			}

			this.valuesTable = new InputValuesTable({
				holder: this.dom.infoDiv,
				handler: this
			})
		} catch (e) {
			this.displayError(e)
			this.input.section.parent.hasError = true
		}
	}

	displayError(e) {
		this.hasError = true
		this.dom.err_div.style('display', 'block').text(e)
		this.input.section.parent.dom.submitBtn.property('disabled', true)
		console.error(e)
	}

	async update() {
		/* called in inputs.main()
		when the regression component is notified of a change
		*/

		const t = this.input.term

		// clear previous errors
		if (t) delete t.error
		this.dom.err_div.style('display', 'none').text('')
		this.hasError = false

		try {
			if (t && this.setQ) {
				await this.setQ[t.term.type](this.input)
			}
			await this.pill.main(this.getPillArgs())
			await this.valuesTable.main()
			if (t && t.error) this.displayError(t.error)
			else if (this.pill.error) this.displayError(this.pill.error)
		} catch (e) {
			this.displayError(e)
		}
	}

	async setRefGroup() {
		/* called in inputs.editConfig()
		before committing data of this term to state
		to derive bins/groups based on q{} setting of this term
		and also set refGrp
		*/
		const t = this.input.term
		const parent = this.input.section.parent // should be fine as "parent" is not a reserved keyword

		if (!t || !t.q) throw '.term.q missing on this input'

		if (!t.q.mode) {
			if (t.term.type == 'categorical' || t.term.type == 'condition') t.q.mode = 'discrete'
			else t.q.mode = 'continuous'
		}

		const q = JSON.parse(JSON.stringify(t.q))
		/*
			for continuous term, assume it is numeric and that we'd want counts by bins,
			so remove the 'mode: continuous' value as it will prevent bin construction in the backend
		*/
		if (q.mode == 'continuous') delete q.mode

		const data = await parent.app.vocabApi.getCategories(t, parent.state.termfilter.filter, [
			'term1_q=' + encodeURIComponent(JSON.stringify(q))
		])
		if (data.error) throw data.error
		this.input.orderedLabels = data.orderedLabels

		// sepeate include and exclude categories based on term.values.uncomputable
		const excluded_values = t.term.values
			? Object.entries(t.term.values)
					.filter(v => v[1].uncomputable)
					.map(v => v[1].label)
			: []
		this.input.sampleCounts = data.lst.filter(v => !excluded_values.includes(v.label))
		this.input.excludeCounts = data.lst.filter(v => excluded_values.includes(v.label))

		// get include, excluded and total sample count
		const totalCount = (this.totalCount = { included: 0, excluded: 0, total: 0 })
		this.input.sampleCounts.forEach(v => (totalCount.included += v.samplecount))
		this.input.excludeCounts.forEach(v => (totalCount.excluded += v.samplecount))
		totalCount.total = totalCount.included + totalCount.excluded
		// for condition term, subtract included count from totalCount.total to get excluded
		if (t.term.type == 'condition' && totalCount.total) {
			totalCount.excluded = totalCount.total - totalCount.included
		}

		if (t && t.q.mode !== 'continuous' && this.input.sampleCounts.length < 2)
			throw `there should be two or more discrete values with samples for variable='${t.term.name}'`

		if (!t.q.mode) throw 'q.mode missing'

		// set term.refGrp
		if (t.q.mode == 'continuous') {
			t.refGrp = 'NA' // hardcoded in R
		} else {
			t.refGrp = this.input.sampleCounts[0].key
		}
	}

	getPillArgs() {
		const section = this.input.section
		const { config, state, disable_terms } = section.parent
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
			this.input.term
		)
		args.filter = state.termfilter.filter
		return args
	}

	remove(input) {
		this.dom.pillDiv
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()

		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

function getMenuVersion(config, input) {
	// for the numericEditMenuVersion of termsetting constructor option
	if (input.section.configKey == 'outcome') {
		// outcome
		if (config.regressionType == 'logistic') return ['binary']
		if (config.regressionType == 'linear') return ['continuous']
		throw 'unknown regressionType'
	}
	if (input.section.configKey == 'independent') {
		// independent
		return ['continuous', 'discrete']
	}
	throw 'unknown input.section.configKey: ' + input.section.configKey
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
async function maySetTwoBins(input) {
	const { app, state } = input.section.parent
	const t = input.term
	// if the bins are already binary, do not reset
	if (t.q.mode == 'binary' && t.q.lst && t.q.lst.length == 2) {
		t.q.mode = 'binary'
		// NOTE: refGrp may be reset as needed in regression.values.table.js
		// if (!t.q.lst.find(bin => bin.label === t.refGrp)) t.refGrp = t.q.lst[0].label
		return
	}

	const data = await app.vocabApi.getPercentile(t.id, 50, state.termfilter.filter)
	if (data.error || !Number.isFinite(data.value)) throw 'cannot get median value: ' + (data.error || 'no data')
	const median = input.term.type == 'integer' ? Math.round(data.value) : Number(data.value.toFixed(2))
	t.q = {
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

	t.q.lst.forEach(bin => {
		bin.label = get_bin_label(bin, input.term.q)
	})

	input.refGrp = t.q.lst[0].label
}

async function maySetTwoGroups(input) {
	const { app, state } = input.section.parent

	// if the bins are already binary, do not reset
	const { term, q } = input.term
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
	const data = await app.vocabApi.getCategories(term, state.termfilter.filter, lst)
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

function setContMode(input) {
	if (!input.term.q.type) {
		console.log('may not happen: why is input.term.q not yet set for numeric term at this point')
		// should already be set to default bins
	}
	input.term.q.mode = 'continuous'
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
