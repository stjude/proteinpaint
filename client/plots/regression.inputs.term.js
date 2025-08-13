import { termsettingInit, get$id } from '#termsetting'
import { get_bin_label } from '#shared/termdb.bins.js'
import { InputValuesTable } from './regression.inputs.values.table'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'
import { mayRunSnplstTask } from '../termsetting/handlers/snplst.sampleSum.ts'
import { get_defaultQ4fillTW } from './regression'
import { isDictionaryType } from '#shared/terms.js'

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

	async init(holder) {
		// only run once when a new input variable is added to the user interface via data/enter() in inputs.js

		const termRow = holder.append('div')
		// the row contains two cells: left to show ts pill, right to show interaction
		const pillDiv = termRow.append('span').style('display', 'inline-block')
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

			// termsetting constructor option
			const arg = {
				placeholder: this.section.selectPrompt,
				placeholderIcon: this.section.placeholderIcon,
				holder: this.dom.pillDiv,
				vocabApi: app.vocabApi,
				noTermPromptOptions: this.opts.noTermPromptOptions,
				activeCohort: state.activeCohort,
				debug: app.opts.debug,
				menuOptions: this.section.configKey == 'outcome' ? '{edit,reuse,replace}' : '{edit,reuse,remove}',
				usecase: { target: 'regression', detail: this.section.configKey, regressionType: config.regressionType },
				disable_terms,
				abbrCutoff: 50,
				genomeObj: this.parent.parent.genomeObj, // required for snplocus
				defaultQ4fillTW: get_defaultQ4fillTW(config.regressionType, this.section.configKey),
				callback: term => {
					this.parent.editConfig(this, term)
				}
			}
			this.furbishTsConstructorArg(arg)
			// use 'await' here because it is safer to assume that
			// termsettingInit() returns a promise, in case the Termsetting
			// class ever has an init() method as detected in rx/index.js
			this.pill = await termsettingInit(arg)

			if (this.section.configKey == 'outcome') {
				// special treatment for terms selected for outcome
				this.setQ = getQSetter4outcome(config.regressionType)
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

	furbishTsConstructorArg(arg) {
		// furbish termsetting constructor argument, based on regression type and if term is outcome/input
		const type = this.parent.config.regressionType
		if (this.section.configKey == 'outcome') {
			// this term is outcome
			if (type == 'logistic') {
				arg.numericEditMenuVersion = ['binary']
				return
			}
			if (type == 'linear') {
				arg.numericEditMenuVersion = ['continuous']
				return
			}
			if (type == 'cox') {
				//arg.showTimeScale = true
				return
			}
			throw 'unknown regressionType'
		}
		if (this.section.configKey == 'independent') {
			// this temr is independent
			// do not allow condition term
			arg.numericEditMenuVersion = ['continuous', 'discrete', 'spline']
			// for geneVariant term, only allow groupsetting
			arg.defaultQ4fillTW['geneVariant'] = { type: 'custom-groupset' }
			arg.geneVariantEditMenuOnlyGrp = true
			return
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

	async main() {
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
				await this.setQ[tw.term.type](tw, app.vocabApi, this.parent.parent.filter, state)
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
			// $id needs to be filled in here for non-dictionary terms
			// TODO: should have a centralized location for filling in
			// $id for non-dictionary terms
			if (tw && !tw.$id) tw.$id = await get$id(this.parent.app.vocabApi.getTwMinCopy(tw))
			const e = (tw && tw.error) || this.pill.error
			if (e) errors.push(e)
			if (errors.length) throw errors
		} catch (errors) {
			this.displayError(errors)
		}
	}

	async updateTerm() {
		/*
		only used in this.main() above
		to derive bins/groups based on q{} setting of this term
		create following attributes:

		input.orderedLabels
		input.termStatus{ sampleCounts, excludeCounts }
		input.term.refGrp
		*/
		const tw = this.term
		if (!tw) return

		if (!tw.q) throw '.term.q missing on this input'

		if (!tw.q.mode && isDictionaryType(tw.term.type)) {
			// fill in q.mode for dictionary terms
			if (
				tw.term.type == 'categorical' ||
				tw.term.type == 'condition' ||
				tw.term.type == 'survival' ||
				tw.term.type == 'samplelst'
			)
				tw.q.mode = 'discrete'
			else tw.q.mode = 'continuous'
		}

		// need to supply tw.q in body, otherwise getCategories() will
		// generate a default .q for the term
		const body = tw.term.type == 'snplst' || tw.term.type == 'snplocus' ? { cacheid: tw.q.cacheid } : { term1_q: tw.q }

		// get term categories
		const data = await this.parent.app.vocabApi.getCategories(tw.term, this.parent.parent.filter, body)
		if (!data) throw `no data for term.id='${tw.term.id}'`
		if (data.error) throw data.error

		mayRunSnplstTask(tw, data)

		this.termStatus = {
			topInfoStatus: [],
			bottomSummaryStatus: undefined,
			sampleCounts: undefined,
			excludeCounts: undefined,
			allowToSelectRefGrp: false
		}

		// update status based on special attr from snplst and snplocus terms
		if (tw.q.numOfSampleWithAnyValidGT) {
			const invalid_snps_count = tw.term.snps.reduce((i, j) => i + (j.invalid ? 1 : 0), 0)
			this.termStatus.topInfoStatus.push(
				`${tw.q.numOfSampleWithAnyValidGT} samples with valid genotypes` +
					(invalid_snps_count > 0 ? ` ${invalid_snps_count} invalid SNP${invalid_snps_count > 1 ? 's' : ''}.` : '')
			)
		}
		if ('geneticModel' in tw.q) {
			this.termStatus.topInfoStatus.push(
				'Genetic model: ' +
					(tw.q.geneticModel == 0
						? 'Additive'
						: tw.q.geneticModel == 1
						? 'Dominant'
						: tw.q.geneticModel == 2
						? 'Recessive'
						: 'By genotype')
			)
		}
		if (tw.q.restrictAncestry) {
			this.termStatus.topInfoStatus.push('Analyzing ' + tw.q.restrictAncestry.name)
			if (tw.q.restrictAncestry.PCcount) {
				this.termStatus.topInfoStatus.push(
					`Adjusting for top ${tw.q.restrictAncestry.PCcount} ancestry principal components`
				)
			}
		}
		if (tw.term.reachedVariantLimit) {
			this.termStatus.topInfoStatus.push(
				`<span class=sja_mcdot style="background:#aaa;font-size:1em">
				&nbsp;&#9888; Restricted to first ${tw.term.snps.length}
				variants of this region.&nbsp;</span> Try zooming in.`
			)
		}

		this.orderedLabels = data.orderedLabels

		if (data.lst) {
			// got sample counts for dictionary terms

			this.summarizeSample(tw, data.lst)

			if (tw.term.type == 'float' || tw.term.type == 'integer') {
				if (tw.q.mode != 'continuous' && tw.q.mode != 'spline') {
					this.termStatus.allowToSelectRefGrp = true
				}
				if (tw.q.scale && tw.q.scale != 1) this.termStatus.topInfoStatus.push(`Scale: Per ${tw.q.scale}`)
				if (tw.q.mode == 'discrete') {
					this.termStatus.topInfoStatus.push(`Discrete variable with ${this.termStatus.sampleCounts.length} bins`)
				}
				if (tw.q.mode == 'spline') {
					this.termStatus.topInfoStatus.push(
						`Cubic spline variable with ${tw.q.knots.length} knots: ${tw.q.knots
							.map(x => Number(x.value))
							.sort((a, b) => a - b)
							.join(', ')}`
					)
				}
			} else if (tw.term.type == 'categorical' || tw.term.type == 'geneVariant' || tw.term.type == 'samplelst') {
				this.termStatus.allowToSelectRefGrp = true
			} else if (tw.term.type == 'condition') {
				if (this.section.configKey == 'outcome' && this.parent.opts.regressionType == 'logistic') {
					// allow selecting refgrp
					this.termStatus.allowToSelectRefGrp = true
				}
				if (this.section.configKey == 'outcome' && this.parent.opts.regressionType == 'cox') {
					if (!['age', 'time'].includes(tw.q.timeScale)) throw 'invalid q.timeScale'
					const tdb = this.parent.app.vocabApi.termdbConfig

					this.termStatus.topInfoStatus.push(`Time axis: ${tw.q.timeScale == 'time' ? tdb.timeUnit : 'age'}`)

					this.termStatus.topInfoStatus.push(
						`<span style="padding-left: 10px;">-start: ${
							tw.q.timeScale == 'time' ? ' ' : 'age at '
						}entry into the cohort (i.e., ${tdb.cohortStartTimeMsg})</span>`
					)

					this.termStatus.topInfoStatus.push(
						`<span style="padding-left: 10px;">-end: ${
							tw.q.timeScale == 'time' ? ' ' : 'age at '
						}event or censoring/death</span>`
					)

					const grades = Object.keys(tw.term.values).map(Number)
					const maxgrade = Math.max(...grades)
					this.termStatus.topInfoStatus.push(
						`<div style="padding-top: 8px;">Event: first occurrence of grade ${
							tw.q.breaks[0] === maxgrade ? tw.q.breaks[0] : `${tw.q.breaks[0]}-${maxgrade}</div>`
						}`
					)
				}
			}
			this.maySet_refGrp(tw)
			if (this.section.configKey == 'outcome') {
				if (this.parent.config.regressionType == 'logistic') {
					// get non-ref group of logistic outcome variable
					// will be used in tooltip messages of coefficients table
					// and in Y axis of cubic spline plot
					tw.nonRefGrp = getLogisticOutcomeNonref(tw)
				} else if (this.parent.config.regressionType == 'cox') {
					// get event label of cox outcome variable
					// will be used in tooltip messages of coefficients table
					tw.eventLabel = getCoxOutcomeEventLabel(tw)
				}
			}
		}
	}

	summarizeSample(tw, datalst) {
		// sepeate include and exclude categories based on term.values.uncomputable
		const excluded_values = new Set()
		if (tw.term.values) {
			for (const i in tw.term.values) {
				if (tw.term.values[i].uncomputable) excluded_values.add(tw.term.values[i].label)
			}
		}
		if (tw.q.mode == 'cox') {
			const toExclude = datalst.find(x => x.key == -1)
			if (toExclude) excluded_values.add(toExclude.label)
		}
		const sampleCounts = (this.termStatus.sampleCounts = datalst.filter(v => !excluded_values.has(v.label)))
		const excludeCounts = (this.termStatus.excludeCounts = datalst.filter(v => excluded_values.has(v.label)))

		// get include, excluded and total sample count
		const totalCount = { included: 0, excluded: 0, total: 0 }
		sampleCounts.forEach(v => (totalCount.included += v.samplecount))
		excludeCounts.forEach(v => (totalCount.excluded += v.samplecount))
		totalCount.total = totalCount.included + totalCount.excluded
		// for condition term, subtract included count from totalCount.total to get excluded
		if (tw.term.type == 'condition' && totalCount.total) {
			totalCount.excluded = totalCount.total - totalCount.included
		}
		// update bottomSummaryStatus
		this.termStatus.bottomSummaryStatus =
			`${totalCount.included} samples included` +
			(totalCount.excluded ? `. ${totalCount.excluded} samples excluded:` : '')
		if (tw && tw.q.mode !== 'continuous' && sampleCounts.length < 2)
			throw `there should be two or more discrete values with samples for variable='${tw.term.name}'`
	}

	maySet_refGrp(tw) {
		if (this.section.configKey == 'outcome' && this.parent.config.regressionType == 'cox') {
			// no need to set refgrp
			return
		}
		if (tw.q.mode == 'continuous') {
			// numeric term in continuous mode, refgrp NA is hardcoded in R
			tw.refGrp = 'NA'
			return
		}
		const sc = this.termStatus.sampleCounts
		if (!('refGrp' in tw) || !sc.find(i => i.key == tw.refGrp)) {
			// refGrp not defined or no longer exists according to sampleCounts[]
			const o = this.orderedLabels
			if (o && o.length) sc.sort((a, b) => o.indexOf(a.key) - o.indexOf(b.key))
			else sc.sort((a, b) => (a.samplecount < b.samplecount ? 1 : -1))
			tw.refGrp = sc[0].key
		}
	}

	getPillArgs() {
		const section = this.section
		const { config, state, disable_terms } = this.parent
		const args = Object.assign(
			{
				activeCohort: state.activeCohort,
				disable_terms,
				usecase: {
					target: 'regression',
					detail: section.configKey,
					regressionType: config.regressionType
				}
			},
			this.term
		)
		args.filter = this.parent.parent.filter
		return args
	}

	remove() {
		this.dom.termRow.transition().duration(500).style('opacity', 0).remove()

		for (const key in this.dom) {
			delete this.dom[key]
		}
	}

	renderInteractionPrompt() {
		// set to hidden in the beginning; redisplay when interaction is enabled
		this.dom.interactionDiv.style('display', 'none')

		// identify situations not eligible for showing prompt
		if (!this.term) return // missing term
		if (this.section.configKey != 'independent') return
		if (this.term.q.mode == 'spline') return // not on a spline term
		if (this.parent.app.vocabApi.termdbConfig.regression?.settings?.disableInteractions) return
		{
			// require minimum of 2 independent terms eligible for interaction
			let count = 0
			for (const input of this.section.inputLst) {
				if (input.term && input.term.q.mode != 'spline') {
					// spline term cannot be used for interaction
					count++
				}
			}
			if (count < 2) return
		}

		const n = this.term.interactions.length
		this.dom.interactionDiv
			.style('display', 'inline')
			.html(n == 0 ? 'Add interactions' : `${n} interaction${n > 1 ? 's' : ''}`)
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
		if (self.parent.config.includeUnivariate) {
			const label = self.parent.dom.univariateCheckboxDiv.select('label').text().trim()
			self.dom.tip.d.append('div').text(`Cannot add interactions. Please uncheck the "${label}" checkbox.`)
			return
		}
		self.dom.tip.d
			.append('div')
			.style('padding', '5px')
			.style('font-size', '0.8em')
			.style('color', 'rgb(153, 153, 153)')
			.html(`Selected variables will each form pairwise interaction with ${this.term.term.name}`)

		self.dom.tip.d
			.append('div')
			.selectAll('div')
			.data(self.parent.config.independent.filter(tw => tw && tw.$id != self.term.$id && tw.q.mode != 'spline'))
			.enter()
			.append('div')
			.style('margin', '5px')
			.each(function (tw) {
				const elem = select(this).append('label')
				const checkbox = elem
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', self.term.interactions.includes(tw.$id))

				elem.append('span').text(' ' + tw.term.name)
			})

		self.dom.tip.d
			.append('button')
			.text('Apply')
			.style('margin', '5px')
			.on('click', () => {
				self.dom.tip.hide()
				self.term.interactions = []
				self.dom.tip.d.selectAll('input').each(function (tw) {
					if (select(this).property('checked')) self.term.interactions.push(tw.$id)
				})
				for (const tw of self.parent.config.independent) {
					const interactions = new Set(tw.interactions)
					self.term.interactions.includes(tw.$id) ? interactions.add(self.term.$id) : interactions.delete(self.term.$id)
					tw.interactions = [...interactions]
				}
				self.parent.editConfig(self, self.term)
			})
	}
}

function getQSetter4outcome(regressionType) {
	// only for outcome term
	return {
		integer: regressionType == 'logistic' ? maySetTwoBins : setContMode,
		float: regressionType == 'logistic' ? maySetTwoBins : setContMode,
		geneExpression: regressionType == 'logistic' ? maySetTwoBins : setContMode, //Added geneExpression, but still breaks, need to fix
		categorical: maySetTwoGroups,
		condition: setQ4tteOutcome,
		survival: setQ4tteOutcome
	}
}

// query backend for median and create custom 2 bins with median and boundry
// for logistic independet numeric terms
async function maySetTwoBins(tw, vocabApi, filter, state) {
	// if the bins are already binary, do not reset
	if (tw.q.mode == 'binary' && tw.q.lst && tw.q.lst.length == 2) {
		tw.q.mode = 'binary'
		return
	}

	const data = await vocabApi.getPercentile(tw.term, [50], state.termfilter)
	if (data.error || !data.values.length || !Number.isFinite(data.values[0]))
		throw 'cannot get median value: ' + (data.error || 'no data')
	const median = tw.term.type == 'integer' ? Math.round(data.values[0]) : Number(data.values[0].toFixed(2))
	tw.q = {
		mode: 'binary',
		type: 'custom-bin',
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

function setQ4tteOutcome(tw, vocabApi, filter, state) {
	// set q for time-to-event outcome (i.e., condition or survival term)
	if (state.config.regressionType == 'logistic') {
		// if refGrp missing, set to be first group, guaranteed to be "No event / Grade 0"
		if (!tw.refGrp) tw.refGrp = tw.q.groups[0].name
	}
	if (state.config.regressionType == 'cox') {
		if (!tw.q.timeScale) tw.q.timeScale = 'time'
	}
}

async function maySetTwoGroups(tw, vocabApi, filter, state) {
	// if the bins are already binary, do not reset
	const { term, q } = tw

	// TODO clean up logic?

	// not condition, currently can only be categorical
	if (q.mode == 'binary') {
		if (q.type == 'values' && Object.keys(term.values).length == 2) return
		if (q.type == 'predefined-groupset') {
			const idx = q.predefined_groupset_idx
			const t_gs = term.groupsetting
			if (t_gs[idx] && Object.keys(t_gs[idx]).length == 2) return
		}
		if (q.type == 'custom-groupset') {
			const gs = q.customset
			if (gs.groups.length == 2) return
		}
	}

	// step 1: check if term has only two computable categories/grades with >0 samples
	// if so, use the two categories as outcome and do not apply groupsetting
	// check the number of samples for computable categories, only use categories with >0 samples
	const data = await vocabApi.getCategories(term, filter)
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
		tw.error = 'less than 2 categories/grades - cannot create separate groups'
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

	// step 2: term has 3 or more categories/grades. must apply groupsetting
	const t_gs = term.groupsetting

	// find if term already has a usable groupsetting
	if (
		q.customset &&
		q.customset.groups &&
		q.customset.groups.length == 2 &&
		groupsetNoEmptyGroup(q.customset, category2samplecount)
	) {
		q.type = 'custom-groupset'
		// has a usable custom set
		return
	}

	// step 3: check if the term has predefined groupsetting
	if (t_gs && t_gs.lst) {
		// has predefined groupsetting
		// note!!!! check on input.term.term but not input.term.q

		if (
			q.predefined_groupset_idx >= 0 &&
			t_gs.lst[q.predefined_groupset_idx] &&
			t_gs.lst[q.predefined_groupset_idx].groups.length == 2 &&
			groupsetNoEmptyGroup(t_gs.lst[q.predefined_groupset_idx], category2samplecount)
		) {
			// has a usable predefined groupset
			q.type = 'predefined-groupset'
			// used for groupsetting if one of the group is filter (group.type) rahter than values,
			// Not in use rightnow, if used in future, uncomment following line
			// if (state.activeCohort != -1) q.groupsetting.activeCohort = state.activeCohort
			return
		}

		// step 4: see if any predefined groupset has 2 groups. if so, use that
		const i = t_gs.lst.findIndex(g => g.groups.length == 2)
		if (i != -1 && groupsetNoEmptyGroup(t_gs.lst[i], category2samplecount)) {
			// found a usable groupset
			q.predefined_groupset_idx = i
			q.type = 'predefined-groupset'
			// used for groupsetting if one of the group is filter (group.type) rahter than values,
			// Not in use rightnow, if used in future, uncomment following line
			// if (state.activeCohort != -1) q.groupsetting.activeCohort = state.activeCohort
			return
		}
	}

	// step 5: last resort. divide values[] array into two groups
	const customset = {
		activeCohort: state.activeCohort,
		groups: [
			{
				name: 'Group 1',
				type: 'values',
				values: []
			},
			{
				name: 'Group 2',
				type: 'values',
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
	q.customset = customset
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
		if (g.type == 'values') {
			for (const i of g.values) total += c2s.get(i.key) || 0
			if (total == 0) return false
		}
	}
	return true
}

function getLogisticOutcomeNonref(outcome) {
	// outcome is the outcome term-wrapper {q{}, refGrp, term{}}
	if (outcome.term.type == 'condition') {
		// condition term does not use q.type
		// from q.groups[], return the str name that's not refgrp
		for (const i of outcome.q.groups) {
			if (i.name != outcome.refGrp) return i.name
		}
		throw 'nonref group not found for logistic outcome'
	}
	// not condition term;
	// depending on q.type, find the non-ref group and return its name
	if (outcome.q.type == 'predefined-groupset') {
		if (!Number.isInteger(outcome.q.predefined_groupset_idx))
			throw 'outcome.q.predefined_groupset_idx not integer when q.type is "predefined-groupset"'
		if (!outcome.term.groupsetting) throw 'outcome.term.groupsetting missing'
		const grpset = outcome.term.groupsetting.lst[outcome.q.predefined_groupset_idx]
		if (!grpset) throw 'groupset not found by outcome.q.predefined_groupset_idx'
		const nonrefgrp = grpset.groups.find(i => i.name != outcome.refGrp)
		if (!nonrefgrp) throw 'non-ref group not found for predefined-groupset'
		return nonrefgrp.name
	}
	if (outcome.q.type == 'custom-groupset') {
		if (!outcome.q.customset) throw 'outcome.q.customset missing'
		const nonrefgrp = outcome.q.customset.groups.find(i => i.name != outcome.refGrp)
		if (!nonrefgrp) throw 'non-ref group not found for custom-groupset'
		return nonrefgrp.name
	}
	if (outcome.q.type == 'values') {
		if (!outcome.term.values) throw 'outcome.term.values{} missing'
		for (const k in outcome.term.values) {
			const v = outcome.term.values[k]
			if (v.label != outcome.refGrp) return v.label
		}
		throw 'unknown nonref group from outcome.term.values'
	}
	if (outcome.q.type == 'custom-bin') {
		const nonrefbin = outcome.q.lst.find(i => i.label != outcome.refGrp)
		if (!nonrefbin) throw 'non-ref bin is not found for custom-bin'
		return nonrefbin.label
	}
	if (outcome.q.type == 'regular-bin') {
		throw 'do not know a way to find computed bin list for type=regular-bin'
	}
	throw 'unknown outcome.q.type'
}

function getCoxOutcomeEventLabel(tw) {
	let eventLabel
	if (!tw.term.values) throw 'tw.term.values missing'
	if (tw.term.type == 'condition') {
		const grades = Object.keys(tw.term.values).map(k => {
			const grade = Number(k)
			if (!Number.isFinite(grade)) throw 'grade is not a number'
			return grade
		})
		const startGrade = tw.q.breaks[0]
		const endGrade = Math.max(...grades)
		eventLabel = `Grades ${startGrade}-${endGrade}`
	} else if (tw.term.type == 'survival') {
		const exitCodes = Object.keys(tw.term.values).map(k => {
			const code = Number(k)
			if (!Number.isFinite(code)) throw 'exit code is not a number'
			return code
		})
		// exit codes can be 0=alive,1=dead; 1=alive,2=dead; etc. (see Surv() in R)
		// so using max exit code value as the exit code of the event
		eventLabel = tw.term.values[Math.max(...exitCodes)].label
	} else {
		throw 'unexpected tw.term.type'
	}
	return eventLabel
}
