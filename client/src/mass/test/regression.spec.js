const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
dimensions to recombine:

categorical term
  - by category (default, mode=discrete, type=values)
  - groupsetting (mode=discrete, type=custom-groupset)
numeric term
  - continuous (mode=continuous)
  - regular bin (mode=discrete, type=regular-bin)
  - custom bin (mode=discrete, type=custom-bin)
  - binary (mode=binary, type=custom-bin)
  - spline (mode=spline)
condition term
  - by grade (default)
  - by groups
snplst
snplocus

**************************/

const raceGroupsetting = {
	id: 'genetic_race',
	q: {
		type: 'custom-groupset',
		groupsetting: {
			inuse: true,
			customset: {
				groups: [
					{
						name: 'group 123',
						type: 'values',
						values: [{ key: 'European Ancestry' }, { key: 'Multi-Ancestry-Admixed' }]
					},
					{ name: 'group 456', type: 'values', values: [{ key: 'African Ancestry' }, { key: 'Asian Ancestry' }] }
				]
			}
		}
	}
}
const diaggrpGroupsetting = {
	id: 'diaggrp',
	q: {
		type: 'custom-groupset',
		groupsetting: {
			inuse: true,
			customset: {
				groups: [
					{
						name: 'Leukemia',
						type: 'values',
						values: [
							{ key: 'Acute lymphoblastic leukemia' },
							{ key: 'Chronic myeloid leukemia' },
							{ key: 'Other leukemia' },
							{ key: 'Acute myeloid leukemia' }
						]
					},
					{
						name: 'Lymphoma',
						type: 'values',
						values: [{ key: 'Hodgkin lymphoma' }, { key: 'Non-Hodgkin lymphoma' }]
					},
					{
						name: 'Solid',
						type: 'values',
						values: [{ key: 'Central nervous system (CNS)' }, { key: 'Neuroblastoma' }]
					}
				]
			}
		}
	}
}

const pgsRegularBin = {
	id: 'prs_PGS000332',
	q: {
		type: 'regular-bin',
		startinclusive: true,
		bin_size: 0.4,
		first_bin: {
			stop: -1,
			startunbounded: true
		},
		rounding: '.1f'
	},
	refGrp: '-0.2 to <0.2'
}
const pgsCustomBin = {
	id: 'prs_PGS000332',
	q: {
		type: 'custom-bin',
		lst: [
			{
				startunbounded: true,
				stop: -0.5,
				stopinclusive: false,
				label: '<0.5'
			},
			{
				start: -0.5,
				stop: 0,
				stopinclusive: false,
				label: '-0.5 to 0'
			},
			{
				start: 0,
				startinclusive: true,
				stopunbounded: true,
				label: '≥0'
			}
		]
	}
}
const agedxRegularBin = {
	id: 'agedx',
	q: {
		type: 'regular-bin',
		startinclusive: true,
		bin_size: 5,
		first_bin: {
			stop: 5,
			startunbounded: true
		}
	},
	refGrp: '<5'
}
const agedxCustomBin = {
	id: 'agedx',
	q: {
		type: 'custom-bin',
		lst: [
			{
				startunbounded: true,
				stop: 1,
				stopinclusive: false,
				label: 'Infants: <1'
			},
			{
				start: 1,
				stop: 4,
				stopinclusive: false,
				label: 'Toddlers: 1-4'
			},
			{
				start: 4,
				startinclusive: true,
				stopunbounded: true,
				label: '≥4'
			}
		]
	}
}

tape('\n', function(test) {
	test.pass('-***- mass/regression -***-')
	test.end()
})

/**********************************
               linear
***********************************/

const testList = [
	{
		name: 'sex race hrtavg',
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, { id: 'hrtavg' }]
	},
	{
		name: 'sex*race hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1', interactions: ['genetic_race'] },
			{ id: 'genetic_race', interactions: ['sex'] },
			{ id: 'hrtavg' }
		]
	},
	{
		name: 'sex race*hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'genetic_race', interactions: ['hrtavg'] },
			{ id: 'hrtavg', interactions: ['genetic_race'] }
		]
	},
	{
		name: 'sex hrtavg*agedx',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'hrtavg', interactions: ['agedx'] },
			{ id: 'agedx', interactions: ['hrtavg'] }
		]
	},
	{
		name: 'sex raceGroupsetting hrtavg',
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, raceGroupsetting, { id: 'hrtavg' }]
	},
	{
		name: 'sex*raceGroupsetting hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1', interactions: ['genetic_race'] },
			(() => {
				const a = JSON.parse(JSON.stringify(raceGroupsetting))
				a.interactions = ['sex']
				return a
			})(),
			{ id: 'hrtavg' }
		]
	},
	{
		name: 'sex raceGroupsetting*hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			(() => {
				const a = JSON.parse(JSON.stringify(raceGroupsetting))
				a.interactions = ['hrtavg']
				return a
			})(),
			{ id: 'hrtavg', interactions: ['genetic_race'] }
		]
	},
	{
		name: 'raceGroupsetting*diaggrpGroupsetting',
		headingCount: 5,
		independent: [
			(() => {
				const a = JSON.parse(JSON.stringify(raceGroupsetting))
				a.interactions = ['diaggrp']
				return a
			})(),
			(() => {
				const a = JSON.parse(JSON.stringify(diaggrpGroupsetting))
				a.interactions = ['genetic_race']
				return a
			})()
		]
	},
	{
		name: 'sex race pgsRegularBin',
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, pgsRegularBin]
	},
	{
		name: 'sex race*pgsRegularBin',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'genetic_race', interactions: ['prs_PGS000332'] },
			(() => {
				const a = JSON.parse(JSON.stringify(pgsRegularBin))
				a.interactions = ['genetic_race']
				return a
			})()
		]
	},
	{
		test: 'sex race pgsCustomBin',
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, pgsCustomBin]
	},
	{
		name: 'sex race*pgsCustomBin',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'genetic_race', interactions: ['prs_PGS000332'] },
			(() => {
				const a = JSON.parse(JSON.stringify(pgsCustomBin))
				a.interactions = ['genetic_race']
				return a
			})()
		]
	},
	{
		name: 'pgsRegularBin*agedxCustomBin',
		headingCount: 5,
		independent: [
			(() => {
				const a = JSON.parse(JSON.stringify(pgsRegularBin))
				a.interactions = ['agedx']
				return a
			})(),
			(() => {
				const a = JSON.parse(JSON.stringify(agedxCustomBin))
				a.interactions = ['prs_PGS000332']
				return a
			})()
		]
	},
	{
		name: 'sex hrtavgSpline',
		headingCount: 6,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } }
		]
	},
	{
		name: 'sex hrtavgSpline ageSpline',
		headingCount: 6,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } },
			{ id: 'agedx', q: { mode: 'spline', knots: [{ value: 0.5 }, { value: 3.5 }, { value: 10.5 }] } }
		]
	},
	{
		name: 'sex race*agedxCustomBin hrtavgSpline',
		headingCount: 6,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'genetic_race', interactions: ['agedx'] },
			(() => {
				const a = JSON.parse(JSON.stringify(agedxCustomBin))
				a.interactions = ['genetic_race']
				return a
			})(),
			{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } }
		]
	}
]

for (const item of testList) {
	tape('(LINEAR) EF ~ ' + item.name, function(test) {
		test.timeoutAfter(10000)
		runpp(
			{
				regressionType: 'linear',
				outcome: { id: 'LV_Ejection_Fraction_3D' },
				independent: item.independent
			},
			app => {
				app.on('postRender.test', null)
				test.equal(findResultHeadings(app), item.headingCount, 'result has ' + item.headingCount + ' headings')
				test.end()
			}
		)
	})
	tape('(LOGISTIC) EF ~ ' + item.name, function(test) {
		test.timeoutAfter(10000)
		runpp(
			{
				regressionType: 'logistic',
				outcome: { id: 'LV_Ejection_Fraction_3D' },
				independent: item.independent
			},
			app => {
				app.on('postRender.test', null)
				test.equal(findResultHeadings(app), item.headingCount, 'result has ' + item.headingCount + ' headings')
				test.end()
			}
		)
	})
	tape('(LOGISTIC) Arrhythmias ~ ' + item.name, function(test) {
		test.timeoutAfter(10000)
		runpp(
			{
				regressionType: 'logistic',
				outcome: { id: 'Arrhythmias' },
				independent: item.independent
			},
			app => {
				app.on('postRender.test', null)
				test.equal(findResultHeadings(app), item.headingCount, 'result has ' + item.headingCount + ' headings')
				test.end()
			}
		)
	})
	tape('(COX) Arrhythmias ~ ' + item.name, function(test) {
		test.timeoutAfter(10000)
		runpp(
			{
				regressionType: 'cox',
				outcome: { id: 'Arrhythmias' },
				independent: item.independent
			},
			app => {
				app.on('postRender.test', null)
				test.equal(findResultHeadings(app), item.headingCount, 'result has ' + item.headingCount + ' headings')
				test.end()
			}
		)
	})
}

///////////////////////// helper

function runpp(plot, runtest) {
	plot.chartType = 'regression'
	helpers.getRunPp('mass', {
		state: {
			genome: 'hg38',
			dslabel: 'SJLife'
		},
		debug: 1
	})({
		state: { plots: [plot] },
		regression: {
			callbacks: {
				'postRender.test': runtest
			}
		}
	})
}

function findResultHeadings(app) {
	// headings are created as <span>name</span>
	const spans = app.Inner.results.dom.oneSetResultDiv.selectAll('span').nodes()
	let foundNumber = 0

	// skip warnings to keep the count stable
	//foundNumber += spans.find(i => i.innerText == 'Warnings') ? 1 : 0

	foundNumber += spans.find(i => i.innerText == 'Sample size:') ? 1 : 0

	// linear
	foundNumber += spans.find(i => i.innerText == 'Residuals') ? 1 : 0
	// logistic
	foundNumber += spans.find(i => i.innerText == 'Deviance residuals') ? 1 : 0

	foundNumber += spans.find(i => i.innerText == 'Cubic spline plots') ? 1 : 0

	foundNumber += spans.find(i => i.innerText == 'Coefficients') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Type III statistics') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Statistical tests') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Other summary statistics') ? 1 : 0

	return foundNumber
}
