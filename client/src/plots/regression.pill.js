import { termsettingInit } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { get_bin_label } from '../../shared/termdb.bins'
import { dofetch3 } from '../client'

export function setPillMethods(self) {
	self.addPill = async function(d) {
		const config = self.config

		d.pill = await termsettingInit({
			placeholder: d.section.prompt[config.regressionType],
			placeholderIcon: d.section.placeholderIcon,
			holder: d.dom.pillDiv,
			vocabApi: self.app.vocabApi,
			vocab: self.state.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			//showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			buttons: d.section.configKey == 'term' ? ['replace'] : ['delete'],
			numericEditMenuVersion: getMenuVersion(config, d),
			usecase: { target: 'regression', detail: d.section.configKey, regressionType: config.regressionType },
			disable_terms: self.disable_terms,
			abbrCutoff: 50,
			callback: term => {
				self.editConfig(d, term)
			}
		})

		if (d.section.configKey == 'term') {
			d.setQ = getQSetter(self.config.regressionType)
		}
		d.pill.main()
	}

	self.updatePill = async function(d) {
		try {
			if (d.term) {
				if (d.setQ) await d.setQ[d.term.term.type](d, self)
			}
			const args = Object.assign(
				{
					disable_terms: self.disable_terms,
					exclude_types: d.section.exclude_types[self.config.regressionType],
					usecase: {
						target: 'regression',
						detail: d.section.configKey,
						regressionType: self.config.regressionType
					}
				},
				d.term
			)
			args.filter = self.state.termfilter.filter
			await d.pill.main(args)
		} catch (e) {
			self.hasError = true
			d.dom.err_div.style('display', 'block').text(e)
			//d.dom.loading_div.style('display', 'none')
			self.dom.submitBtn.property('disabled', true)
			console.error(e)
		}
	}

	self.removePill = function(d) {
		delete d.section.items[d.term.id]
		d.dom.pillDiv
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}
}

function getMenuVersion(config, d) {
	// for the numericEditMenuVersion of termsetting constructor option
	if (d.section.configKey == 'term') {
		// outcome
		if (config.regressionType == 'logistic') return ['binary']
		if (config.regressionType == 'linear') return ['continuous']
		throw 'unknown regressionType'
	}
	if (d.section.configKey == 'independent') {
		// independent
		return ['continuous', 'discrete']
	}
	throw 'unknown d.section.configKey: ' + d.section.configKey
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
async function maySetTwoBins(d, self) {
	// if the bins are already binary, do not reset
	if (d.term.q.mode == 'binary' && d.term.q.refGrp) return

	// for numeric terms, add 2 custom bins devided at median value
	const lst = [
		'/termdb?getpercentile=50',
		'tid=' + d.term.id,
		'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(self.state.termfilter.filter))),
		'genome=' + self.state.vocab.genome,
		'dslabel=' + self.state.vocab.dslabel
	]
	const url = lst.join('&')
	const data = await dofetch3(url, {}, self.app.opts.fetchOpts)
	if (data.error) throw data.error
	const median = d.term.type == 'integer' ? Math.round(data.value) : Number(data.value.toFixed(2))
	d.term.q = {
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

	d.term.q.lst.forEach(bin => {
		if (!('label' in bin)) bin.label = get_bin_label(bin, d.term.q)
	})
}

async function maySetTwoGroups(d, self) {
	// if the bins are already binary, do not reset
	const { term, q } = d.term
	if (q.mode == 'binary') return
	q.mode = 'binary'

	// category and condition terms share some logic

	// step 1: check if term has only two computable categories/grades with >0 samples
	// if so, use the two categories as outcome and do not apply groupsetting

	// check the number of samples for computable categories, only use categories with >0 samples

	// TODO run these queries through vocab
	const lst = [
		'/termdb?getcategories=1',
		'tid=' + term.id,
		'term1_q=' + encodeURIComponent(JSON.stringify(q)),
		'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(self.state.termfilter.filter))),
		'genome=' + self.state.vocab.genome,
		'dslabel=' + self.state.vocab.dslabel
	]
	if (term.type == 'condition') lst.push('value_by_max_grade=1')
	const url = lst.join('&')
	const data = await dofetch3(url, {}, self.app.opts.fetchOpts)
	if (data.error) throw data.error
	const category2samplecount = new Map() // k: category/grade (computable), v: number of samples
	const computableCategories = []
	for (const i of data.lst) {
		category2samplecount.set(i.key, i.samplecount, term.values)
		if (term.values && term.values[i.key] && term.values[i.key].uncomputable) continue
		computableCategories.push(i.key)
	}
	if (computableCategories.length < 2) {
		// TODO UI should reject this term and prompt user to select a different one
		throw 'less than 2 categories/grades'
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
		// has a usable custom set
		return
	}

	// step 4: check if the term has predefined groupsetting
	if (t_gs && t_gs.lst) {
		// has predefined groupsetting
		// note!!!! check on d.term.term but not d.term.q

		if (
			q_gs.predefined_groupset_idx >= 0 &&
			t_gs.lst[q_gs.predefined_groupset_idx] &&
			t_gs.lst[q_gs.predefined_groupset_idx].groups.length == 2 &&
			groupsetNoEmptyGroup(t_gs.lst[q_gs.predefined_groupset_idx], category2samplecount)
		) {
			// has a usable predefined groupset
			return
		}

		// step 5: see if any predefined groupset has 2 groups. if so, use that
		const i = t_gs.lst.findIndex(g => g.groups.length == 2)
		if (i != -1 && groupsetNoEmptyGroup(t_gs.lst[i], category2samplecount)) {
			// found a usable groupset
			q_gs.predefined_groupset_idx = i
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

function setContMode(d) {
	if (!d.term.q.type) {
		console.log('may not happen: why is d.term.q not yet set for numeric term at this point')
		// should already be set to default bins
	}
	d.term.q.mode = 'continuous'
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
