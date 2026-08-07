import tape from 'tape'
import { getEstimateMsg } from '../estimateMsg'

/*
Tests:
	getEstimateMsg() - linear, categorical variable
	getEstimateMsg() - linear, negative estimate
	getEstimateMsg() - linear, estimate of 0
	getEstimateMsg() - linear, continuous variable with valueConversion
	getEstimateMsg() - linear, intercept keeps the sign of the estimate
	getEstimateMsg() - linear, intercept with a spline covariate
	getEstimateMsg() - logistic, estimate above 1
	getEstimateMsg() - logistic, estimate below 1
	getEstimateMsg() - logistic, estimate of 1
	getEstimateMsg() - cox, time scale of time, with dataset config
	getEstimateMsg() - cox, time scale of time, without dataset config
	getEstimateMsg() - cox, time scale of age
	getEstimateMsg() - univariate row omits covariates
	getEstimateMsg() - estimate of NA
	getEstimateMsg() - non-positive ratio
	getEstimateMsg() - unrecognized regression type
*/

/*************************
 reusable helper functions
**************************/

// the message is html, strip the tags to assert on the wording,
// and collapse the whitespace left behind by the styled variable pills
function text(msg: string) {
	return msg
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/ ([.,])/g, '$1')
		.trim()
}

function categoricalTw(id: string, name: string, refGrp = 'F') {
	return {
		$id: id,
		id,
		term: { id, name, type: 'categorical', values: { F: { label: 'Female' }, M: { label: 'Male' } } },
		q: { mode: 'discrete' },
		refGrp
	}
}

function continuousTw(id: string, name: string, valueConversion?: any) {
	const tw: any = { $id: id, id, term: { id, name, type: 'float' }, q: { mode: 'continuous' }, refGrp: 'NA' }
	if (valueConversion) tw.term.valueConversion = valueConversion
	return tw
}

function splineTw(id: string, name: string) {
	// a spline variable carries a leftover refGrp of a bin key, which must not be
	// reported as its baseline
	return { $id: id, id, term: { id, name, type: 'float' }, q: { mode: 'spline', knots: [] }, refGrp: '0 to 10' }
}

const linearOutcome = { term: { id: 'ht', name: 'Height', type: 'float' }, q: { mode: 'continuous' } }
const logisticOutcome = {
	term: { id: 'dz', name: 'Disease', type: 'categorical' },
	q: { mode: 'binary' },
	refGrp: 'no',
	nonRefGrp: 'Yes'
}
function coxOutcome(timeScale = 'time') {
	return {
		term: { id: 'os', name: 'Overall survival', type: 'survival' },
		q: { mode: 'cox', timeScale },
		eventLabel: 'Dead'
	}
}

// build the arg of getEstimateMsg(), with defaults that individual tests override
function getArg(overrides: any = {}) {
	const sex = categoricalTw('sex', 'Sex')
	const arg: any = {
		est: 2,
		tw: sex,
		regressionType: 'linear',
		outcomeTw: linearOutcome,
		independentTws: [sex],
		termdbConfig: {},
		getIndependentInput: () => {
			throw 'getIndependentInput() should not be called'
		},
		categoryKey: 'M'
	}
	return Object.assign(arg, overrides)
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/regression/estimateMsg -***-')
	test.end()
})

tape('getEstimateMsg() - linear, categorical variable', test => {
	test.plan(1)
	const sex = categoricalTw('sex', 'Sex')
	const age = continuousTw('age', 'Age')
	const msg = getEstimateMsg(getArg({ tw: sex, independentTws: [sex, age] }))
	test.equal(
		text(msg),
		'Mean Height is 2 units higher in Sex Male compared to Sex Female, adjusting for Age.',
		'should compare the category to the reference group and list the other variable as covariate'
	)
})

tape('getEstimateMsg() - linear, negative estimate', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: -2.5 }))
	test.equal(
		text(msg),
		'Mean Height is 2.5 units lower in Sex Male compared to Sex Female.',
		'should report the absolute value with "lower"'
	)
})

tape('getEstimateMsg() - linear, estimate of 0', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 0 }))
	test.equal(
		text(msg),
		'Mean Height is no different in Sex Male compared to Sex Female.',
		'should say "no different" rather than "0 units higher"'
	)
})

tape('getEstimateMsg() - linear, continuous variable with valueConversion', test => {
	test.plan(1)
	const dose = continuousTw('dose', 'Dose', { fromUnit: 'day', toUnit: 'year' })
	const msg = getEstimateMsg(getArg({ tw: dose, categoryKey: undefined, independentTws: [dose] }))
	test.equal(
		text(msg),
		'Mean Height is 2 units higher for every 1 year increase of Dose.',
		'should name the converted unit of the variable'
	)
})

tape('getEstimateMsg() - linear, intercept keeps the sign of the estimate', test => {
	test.plan(1)
	const sex = categoricalTw('sex', 'Sex')
	const age = continuousTw('age', 'Age')
	const msg = getEstimateMsg(
		getArg({ est: -3.5, tw: undefined, categoryKey: undefined, isIntercept: true, independentTws: [sex, age] })
	)
	test.equal(
		text(msg),
		'Mean Height is -3.5 units when Sex Female and Age 0.',
		'should report the negative intercept with its sign'
	)
})

tape('getEstimateMsg() - linear, intercept with a spline covariate', test => {
	test.plan(1)
	const spline = splineTw('age', 'Age')
	const msg = getEstimateMsg(
		getArg({ est: 1, tw: undefined, categoryKey: undefined, isIntercept: true, independentTws: [spline] })
	)
	test.equal(
		text(msg),
		'Mean Height is 1 units when Age 0.',
		'should use 0 as the baseline of a spline variable, rather than its leftover refGrp or "undefined"'
	)
})

tape('getEstimateMsg() - logistic, estimate above 1', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 3, regressionType: 'logistic', outcomeTw: logisticOutcome }))
	test.equal(
		text(msg),
		'Odds of Disease Yes is 3 times higher in Sex Male compared to Sex Female.',
		'should report the odds ratio of the non-reference group'
	)
})

tape('getEstimateMsg() - logistic, estimate below 1', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 0.5, regressionType: 'logistic', outcomeTw: logisticOutcome }))
	test.equal(
		text(msg),
		'Odds of Disease Yes is 2 times lower in Sex Male compared to Sex Female.',
		'should invert a ratio below 1'
	)
})

tape('getEstimateMsg() - logistic, estimate of 1', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 1, regressionType: 'logistic', outcomeTw: logisticOutcome }))
	test.equal(
		text(msg),
		'Odds of Disease Yes is no different in Sex Male compared to Sex Female.',
		'should say "no different" rather than "1 times lower"'
	)
})

tape('getEstimateMsg() - cox, time scale of time, with dataset config', test => {
	test.plan(2)
	const msg = getEstimateMsg(
		getArg({
			est: 2,
			regressionType: 'cox',
			outcomeTw: coxOutcome('time'),
			termdbConfig: { timeUnit: 'years', cohortStartTimeMsg: '5 years post cancer diagnosis' }
		})
	)
	test.equal(
		text(msg),
		'Hazard (instantaneous rate) of Overall survival Dead is 2 times higher in Sex Male compared to Sex Female.' +
			' Time is measured in years from 5 years post cancer diagnosis.',
		'should state the time axis in its own sentence, using the dataset config'
	)
	test.false(
		msg.includes('adjusting for'),
		'should not list the time axis as a covariate when there are no other variables'
	)
})

tape('getEstimateMsg() - cox, time scale of time, without dataset config', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 2, regressionType: 'cox', outcomeTw: coxOutcome('time'), termdbConfig: {} }))
	test.equal(
		text(msg),
		'Hazard (instantaneous rate) of Overall survival Dead is 2 times higher in Sex Male compared to Sex Female.',
		'should omit the time sentence when the dataset declares neither timeUnit nor cohortStartTimeMsg'
	)
})

tape('getEstimateMsg() - cox, time scale of age', test => {
	test.plan(1)
	const msg = getEstimateMsg(
		getArg({ est: 2, regressionType: 'cox', outcomeTw: coxOutcome('age'), termdbConfig: { timeUnit: 'years' } })
	)
	test.true(
		text(msg).endsWith('Time is measured as attained age during follow-up.'),
		'should describe the age time scale and ignore timeUnit'
	)
})

tape('getEstimateMsg() - univariate row omits covariates', test => {
	test.plan(1)
	const sex = categoricalTw('sex', 'Sex')
	const age = continuousTw('age', 'Age')
	const msg = getEstimateMsg(getArg({ tw: sex, independentTws: [sex, age], isUnivariate: true }))
	test.equal(
		text(msg),
		'Mean Height is 2 units higher in Sex Male compared to Sex Female.',
		'should not list covariates for a univariate row'
	)
})

tape('getEstimateMsg() - estimate of NA', test => {
	test.plan(1)
	// Number('NA') is NaN
	const msg = getEstimateMsg(getArg({ est: Number('NA') }))
	test.equal(msg, 'The estimate of this variable is not available.', 'should not describe a non-finite estimate')
})

tape('getEstimateMsg() - non-positive ratio', test => {
	test.plan(1)
	const msg = getEstimateMsg(getArg({ est: 0, regressionType: 'logistic', outcomeTw: logisticOutcome }))
	test.equal(
		msg,
		'The estimate of this variable is not available.',
		'should not divide by 0 and report "Infinity times lower"'
	)
})

tape('getEstimateMsg() - unrecognized regression type', test => {
	test.plan(1)
	test.throws(
		() => getEstimateMsg(getArg({ regressionType: 'poisson' })),
		/regression type not recognized/,
		'should throw on an unknown regression type'
	)
})
