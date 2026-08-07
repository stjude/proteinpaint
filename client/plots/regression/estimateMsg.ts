import { roundValue } from '#shared/roundValue.js'

/*
builds the tooltip message that explains the estimate value of a coefficient row,
of the coefficients table of a regression result

the message is built in parts:
	1. outcome variable, e.g. "Mean [Height] is 2 units higher"
	2. independent variable of the row, e.g. "in [Sex][Male] compared to [Sex][Female]"
	3. covariates, i.e. all other independent variables of the model
	4. time axis, for cox regression only

this module is free of the plot instance, so that it can be unit tested;
callers supply the model context via EstimateMsgArg
*/

/** refGrp value that is not applicable, hardcoded for R */
export const refGrp_NA = 'NA'

export type EstimateMsgArg = {
	/** estimate value of the row: beta value for linear, odds ratio for logistic,
	and hazard ratio for cox. is NaN when R returns "NA" */
	est: number
	/** term-wrapper of the variable of this row; is missing on the intercept row */
	tw?: any
	/** term-wrapper of the 2nd variable, when this row is an interaction */
	tw2?: any
	/** category key of tw, when tw has categories */
	categoryKey?: string
	/** category key of tw2, when tw2 has categories */
	categoryKey2?: string
	/** true when this row is the intercept */
	isIntercept?: boolean
	/** true when this row is from the univariate analysis, which has no covariates */
	isUnivariate?: boolean
	/** 'linear', 'logistic' or 'cox' */
	regressionType: string
	/** term-wrapper of the outcome variable */
	outcomeTw: any
	/** term-wrappers of all independent variables of the model */
	independentTws: any[]
	/** for timeUnit and cohortStartTimeMsg of a cox regression */
	termdbConfig: any
	/** returns the Input instance of an independent variable, by tw.$id or snpid */
	getIndependentInput: (tid: string) => any
}

export function getEstimateMsg(arg: EstimateMsgArg): string {
	const {
		est,
		tw,
		tw2,
		categoryKey,
		categoryKey2,
		isIntercept,
		isUnivariate,
		outcomeTw,
		independentTws,
		termdbConfig,
		getIndependentInput
	} = arg
	const regtype = arg.regressionType
	const category = tw?.term?.values && tw.term.values[categoryKey!] ? tw.term.values[categoryKey!].label : categoryKey
	const category2 =
		tw2?.term?.values && tw2.term.values[categoryKey2!] ? tw2.term.values[categoryKey2!].label : categoryKey2
	const refGrp = tw?.term?.values && tw.term.values[tw.refGrp] ? tw.term.values[tw.refGrp].label : tw?.refGrp
	const refGrp2 = tw2?.term?.values && tw2.term.values[tw2.refGrp] ? tw2.term.values[tw2.refGrp].label : tw2?.refGrp

	/* the estimate is a difference for linear, and a ratio (odds/hazard) for logistic and cox.
	a non-finite estimate (e.g. "NA" returned by R for an aliased coefficient) cannot be
	described, and neither can a non-positive ratio, which would divide by 0 below */
	if (!Number.isFinite(est) || (regtype != 'linear' && est <= 0)) {
		return 'The estimate of this variable is not available.'
	}

	/** part 1: outcome variable **/
	let msg
	if (regtype == 'linear') {
		msg = tw2 ? getInteractionMsg() : `Mean ${styleVariable(outcomeTw)} is`
		if (isIntercept) {
			// report the signed estimate, as the intercept can be negative
			const baselines = getBaselines(independentTws)
			return `${msg} ${est} ${unitsOf(outcomeTw)} when ${joinVariables(baselines)}.`
		}
		msg += est == 0 ? ' no different ' : ` ${Math.abs(est)} ${unitsOf(outcomeTw)} ${est < 0 ? 'lower' : 'higher'} `
	} else if (regtype == 'logistic') {
		msg = tw2 ? getInteractionMsg() : `Odds of ${styleVariable(outcomeTw, outcomeTw.nonRefGrp)} is`
		if (isIntercept) {
			const baselines = getBaselines(independentTws)
			return `${msg} ${est} when ${joinVariables(baselines)}.`
		}
		msg += getRatioMsg()
	} else if (regtype == 'cox') {
		msg = tw2
			? getInteractionMsg()
			: `Hazard (instantaneous rate) of ${styleVariable(outcomeTw, outcomeTw.eventLabel)} is`
		msg += getRatioMsg()
	} else {
		throw 'regression type not recognized'
	}

	/** part 2: independent variable **/
	const interactions: string[] = []
	const interactionsBaselines: string[] = []
	if (tw.interactions?.length && !tw2) {
		// variable is part of an interaction, but the current row
		// is not an interaction row
		for (const tid of tw.interactions) {
			const t = getIndependentInput(tid).term
			if (t.term.snps) {
				// snplst or snplocus term
				// need to get term ids of individuals snps
				for (const snp of t.term.snps) interactions.push(snp.snpid)
			} else {
				interactions.push(tid)
			}
		}
		if (!interactions.length) throw 'interactions[] is empty'
		const interactingTws = independentTws.filter(t => interactions.includes(t.$id || t.id))
		interactionsBaselines.push(...getBaselines(interactingTws))
	}
	if (category) {
		// categorical variable
		msg += `in ${joinVariables([styleVariable(tw, category), ...interactionsBaselines])} compared to ${joinVariables([
			styleVariable(tw, refGrp),
			...interactionsBaselines
		])}`
	} else if (tw.q.mode == 'continuous') {
		// continuous variable
		msg += `for every ${oneUnitOf(tw)} increase of ${styleVariable(tw)}`
		if (interactionsBaselines.length) msg += ` when ${joinVariables(interactionsBaselines)}`
	} else if (tw.q.geneticModel === 0) {
		// genetic variable, additive model
		msg += `for every additional ${tw.effectAllele} allele of ${styleVariable(tw)}`
		if (interactionsBaselines.length) msg += ` when ${joinVariables(interactionsBaselines)}`
	} else if (tw.q.geneticModel == 1 || tw.q.geneticModel == 2) {
		// genetic variable, dominant or recessive model
		const gts = Object.keys(tw.gt2count)
		const testGts = gts.filter(gt => {
			if (tw.q.geneticModel == 1) {
				// dominant model
				return gt.includes(tw.effectAllele)
			} else {
				// recessive model
				return gt
					.replace(/[^a-zA-Z]/g, '')
					.split('')
					.every(c => c == tw.effectAllele)
			}
		})
		const refGts = gts.filter(gt => !testGts.includes(gt))
		msg += `in ${joinVariables([
			styleVariable(tw, testGts.join(', ')),
			...interactionsBaselines
		])} compared to ${joinVariables([styleVariable(tw, refGts.join(', ')), ...interactionsBaselines])}`
	}

	/** part 3: adjusting for covariates **/
	// get term ids of current variable and any interacting variables
	const tids = [tw.$id || tw.id]
	if (tw.interactions?.length) {
		if (tw2) tids.push(tw2.$id || tw2.id)
		else tids.push(...interactions)
	}
	// get covariates (i.e., all other variables)
	const covariates = independentTws.filter(t => !tids.includes(t.$id || t.id)).map(t => styleVariable(t))
	// build message for covariates
	if (covariates.length && !isUnivariate) msg += `, adjusting for ${joinVariables(covariates)}`
	msg += '.'

	/** part 4: time axis of cox regression **/
	/* in cox regression, time is the axis of the baseline hazard and not an adjusted
	covariate, so it is stated in its own sentence. the unit of the time axis and the
	start of follow-up are declared by the dataset (see termdb.timeUnit and
	termdb.cohortStartTimeMsg), as they differ between cohorts */
	if (regtype == 'cox') {
		if (outcomeTw.q.timeScale == 'age') {
			msg += ' Time is measured as attained age during follow-up.'
		} else {
			const unit = termdbConfig?.timeUnit ? ` in ${termdbConfig.timeUnit}` : ''
			const start = termdbConfig?.cohortStartTimeMsg ? ` from ${termdbConfig.cohortStartTimeMsg}` : ''
			// stay quiet when the dataset declares neither, rather than printing filler
			if (unit || start) msg += ` Time is measured${unit}${start}.`
		}
	}
	return msg

	/** helper functions **/
	/* a numeric term with valueConversion{} is analyzed by its converted unit
	(see makeRinput() in server/src/routes/termdb.regression.ts), so the estimate is per that
	unit, e.g. per year rather than per day. the two below name the unit of such a variable,
	and fall back to the generic "unit" wording for terms without a declared unit */
	function oneUnitOf(tw) {
		const u = tw?.term?.valueConversion?.toUnit
		return u ? `1 ${u}` : 'one unit'
	}
	function unitsOf(tw) {
		const u = tw?.term?.valueConversion?.toUnit
		return u ? `${u}s` : 'units'
	}

	// describe an odds/hazard ratio, which is 1 when there is no association
	function getRatioMsg() {
		if (est == 1) return ' no different '
		return est > 1 ? ` ${est} times higher ` : ` ${roundValue(1 / est, 3)} times lower `
	}

	// function to style a variable (and its category)
	function styleVariable(tw, category?) {
		const spans = [
			`<span class="term_name_btn sja_filter_tag_btn" style="padding: 3px 6px; margin: 2.5px 0px; border-radius: ${
				category ? '6px 0px 0px 6px' : '6px'
			};">${tw.term.name.length < 40 ? tw.term.name : tw.term.name.substring(0, 35) + ' ...'}</span>`
		]
		if (category) {
			spans.push(
				`<span class="ts_summary_btn sja_filter_tag_btn" style="padding: 3px 6px; margin: 2.5px 0px; border-radius: 0px 6px 6px 0px; font-style: italic;">${category}</span>`
			)
		}
		return `<div style="display: inline; white-space: nowrap; font-size: 0.9em">${spans.join('')}</div>`
	}

	// function to get message for interaction term
	function getInteractionMsg() {
		let msg =
			regtype == 'linear'
				? `The difference in mean ${styleVariable(outcomeTw)}`
				: regtype == 'logistic'
				? `The difference in odds of ${styleVariable(outcomeTw, outcomeTw.nonRefGrp)}`
				: `The difference in hazard (instantaneous rate) of ${styleVariable(outcomeTw, outcomeTw.eventLabel)}`

		if (category2) {
			// categorical variable
			msg += ` between ${styleVariable(tw2, category2)} and ${styleVariable(tw2, refGrp2)} is`
		} else if (tw2.q.mode == 'continuous') {
			// continuous variable
			msg += ` for every ${oneUnitOf(tw2)} increase of ${styleVariable(tw2)} is`
		} else if (tw2.q.geneticModel === 0) {
			// genetic variable, additive model
			msg += ` for every additional ${tw2.effectAllele} allele of ${styleVariable(tw2)} is`
		} else if (tw2.q.geneticModel == 1 || tw2.q.geneticModel == 2) {
			// genetic variable, dominant or recessive model
			const gts = Object.keys(tw2.gt2count)
			const testGts = gts.filter(gt => {
				if (tw2.q.geneticModel == 1) {
					// dominant model
					return gt.includes(tw2.effectAllele)
				} else {
					// recessive model
					return gt
						.replace(/[^a-zA-Z]/g, '')
						.split('')
						.every(c => c == tw2.effectAllele)
				}
			})
			const refGts = gts.filter(gt => !testGts.includes(gt))
			msg += ` between ${styleVariable(tw2, testGts.join(', '))} and ${styleVariable(tw2, refGts.join(', '))} is`
		}

		return msg
	}

	/* function to get the baseline level of each variable
		- categorical variable: refGrp
		- continuous or cubic spline variable: 0
		- genetic variable:
			- additive model: 0 effect alleles
			- dominant model: homozygous for non-effect allele
			- recessive model: homozygous for non-effect allele or heterozygous
			- by genotype: same as categorical variable
	*/
	function getBaselines(tws) {
		const baselines = tws.map(tw => {
			if (tw.q.mode != 'spline' && 'refGrp' in tw && tw.refGrp != refGrp_NA) {
				// has refGrp, must be categorical variable
				// a spline variable can carry a leftover refGrp, thus is excluded here
				const refGrp = tw?.term?.values && tw.term.values[tw.refGrp] ? tw.term.values[tw.refGrp].label : tw?.refGrp
				return styleVariable(tw, refGrp)
			} else if (tw.q.mode == 'continuous' || tw.q.mode == 'spline') {
				/* continuous variable, or cubic spline variable, as every spline
				function of a variable is 0 when the variable is 0
				(see cubic_spline() in R/src/regression.utils.R) */
				return styleVariable(tw, '0')
			} else if (tw.q.geneticModel === 0) {
				// genetic variable, additive model
				return styleVariable(tw, `No ${tw.effectAllele} alleles`)
			} else if (tw.q.geneticModel == 1 || tw.q.geneticModel == 2) {
				// genetic variable, dominant or recessive model
				const gts = Object.keys(tw.gt2count)
				const refGts = gts.filter(gt => {
					if (tw.q.geneticModel == 1) {
						// dominant model
						return !gt.includes(tw.effectAllele)
					} else {
						// recessive model
						return !gt
							.replace(/[^a-zA-Z]/g, '')
							.split('')
							.every(c => c == tw.effectAllele)
					}
				})
				return styleVariable(tw, refGts.join(', '))
			}
		})
		// drop any variable with an undetermined baseline, rather than printing "undefined"
		return baselines.filter(Boolean)
	}

	function joinVariables(variables) {
		if (!variables.length) return ''
		else if (variables.length == 1) return variables[0]
		else if (variables.length == 2) return variables.join(' and ')
		else return `${variables.slice(0, -1).join(', ')}, and ${variables.slice(-1)}`
	}
}
