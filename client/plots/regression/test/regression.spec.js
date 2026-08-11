import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

const raceGroupsetting = {
	id: 'genetic_race',
	q: {
		type: 'custom-groupset',
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
const diaggrpGroupsetting = {
	id: 'diaggrp',
	q: {
		type: 'custom-groupset',
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

const snplst = {
	term: {
		type: 'snplst',
		id: 'snplstTermId',
		snps: [
			{ rsid: 'rs1641548', effectAllele: 'T' },
			{ rsid: 'rs858528', effectAllele: 'T' },
			{ rsid: 'rs1642793', effectAllele: 'C' },
			{ rsid: 'rs1042522' },
			{ rsid: 'rs1642782' },
			{ rsid: 'rs6503048' }
		]
	},
	q: {
		AFcutoff: 5,
		alleleType: 0,
		geneticModel: 0,
		missingGenotype: 0,
		restrictAncestry: {
			name: 'European ancestry',
			tvs: {
				term: {
					id: 'genetic_race',
					type: 'categorical',
					name: 'Genetically defined race'
				},
				values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
			}
		}
	}
}

const snplocus = {
	term: {
		type: 'snplocus',
		id: 'snplocusTermId'
	},
	q: {
		chr: 'chr17',
		start: 7674304,
		stop: 7676849,
		AFcutoff: 5,
		alleleType: 0,
		geneticModel: 0,
		restrictAncestry: {
			name: 'European ancestry',
			tvs: {
				term: {
					id: 'genetic_race',
					type: 'categorical',
					name: 'Genetically defined race'
				},
				values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
			}
		},
		variant_filter: {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [
				/*
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [{ label: 'Bad', key: 'Bad' }],
						term: {
							id: 'QC_sjlife',
							name: 'ABC classification',
							parent_id: null,
							isleaf: true,
							type: 'categorical',
							values: {
								SuperGood: { label: 'SuperGood', key: 'SuperGood' },
								Good: { label: 'Good', key: 'Good' },
								Ambiguous: { label: 'Ambiguous', key: 'Ambiguous' },
								Bad: { label: 'Bad', key: 'Bad' }
							}
						}
					}
				},
				*/
				/*
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [{ label: 'Bad', key: 'Bad' }],
						term: {
							id: 'QC_ccss',
							name: 'XYZ classification',
							parent_id: null,
							isleaf: true,
							type: 'categorical',
							values: {
								SuperGood: { label: 'SuperGood', key: 'SuperGood' },
								Good: { label: 'Good', key: 'Good' },
								Ambiguous: { label: 'Ambiguous', key: 'Ambiguous' },
								Bad: { label: 'Bad', key: 'Bad' }
							}
						}
					}
				},
				*/
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.95, startinclusive: true, stopunbounded: true }],
						term: { id: 'SJcontrol_CR', name: 'ABC control call rate', parent_id: null, isleaf: true, type: 'float' }
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.95, startinclusive: true, stopunbounded: true }],
						term: { id: 'CR', name: 'Call rate, ABC+XYZ', parent_id: null, isleaf: true, type: 'float' }
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.95, startinclusive: true, stopunbounded: true }],
						term: { id: 'CR_sjlife', name: 'ABC call rate', parent_id: null, isleaf: true, type: 'float' }
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.95, startinclusive: true, stopunbounded: true }],
						term: { id: 'CR_ccss', name: 'XYZ call rate', parent_id: null, isleaf: true, type: 'float' }
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.95, startinclusive: true, stopunbounded: true }],
						term: { id: 'gnomAD_CR', name: 'gnmoAD call rate', parent_id: null, isleaf: true, type: 'float' }
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }],
						term: {
							id: 'gnomAD_AF',
							name: 'gnomAD allele frequency',
							parent_id: null,
							isleaf: true,
							type: 'float',
							min: 0,
							max: 1,
							values: {}
						}
					}
				},
				/*
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [{ label: 'yes', key: '1' }],
						term: { id: 'BadBLAT', name: 'Paralog', parent_id: null, isleaf: true, type: 'categorical' }
					}
				},
				*/
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [{ label: 'yes', key: '1' }],
						term: { id: 'Polymer_region', name: 'Polymer region', parent_id: null, isleaf: true, type: 'categorical' }
					}
				}
			]
		}
	}
}

/*************************
each element of testList[] is one combination of below, to work as covariates in a model
set "runthis:true" on one element to just test that one
outcome variables are separately defined

categorical term
  - by category (default, mode=discrete, type=values)
  - groupsetting (mode=discrete, type=custom-groupset)
numeric term
  - continuous (mode=continuous)
  - regular bin (mode=discrete, type=regular-bin)
  - custom bin (mode=discrete, type=custom-bin) (binary is not tested as input variable)
  - spline (mode=spline)
condition term
  - by breaks only, as outcome
snplst
snplocus

**************************/

const testList = [
	{
		name: 'sex race hrtavg', // hrtavg is continuous
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
		name: 'sex raceGroupsetting hrtavg', // groupsetting, continuous
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, raceGroupsetting, { id: 'hrtavg' }]
	},
	{
		name: 'sex*raceGroupsetting hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1', interactions: ['genetic_race'] },
			addInteraction(raceGroupsetting, 'sex'),
			{ id: 'hrtavg' }
		]
	},
	{
		name: 'sex raceGroupsetting*hrtavg',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(raceGroupsetting, 'hrtavg'),
			{ id: 'hrtavg', interactions: ['genetic_race'] }
		]
	},
	{
		name: 'raceGroupsetting*diaggrpGroupsetting',
		headingCount: 5,
		independent: [addInteraction(raceGroupsetting, 'diaggrp'), addInteraction(diaggrpGroupsetting, 'genetic_race')]
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
			addInteraction(pgsRegularBin, 'genetic_race')
		]
	},
	{
		name: 'sex race pgsCustomBin',
		headingCount: 5,
		independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, pgsCustomBin]
	},
	{
		name: 'sex race*pgsCustomBin',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'genetic_race', interactions: ['prs_PGS000332'] },
			addInteraction(pgsCustomBin, 'genetic_race')
		]
	},
	{
		name: 'pgsRegularBin*agedxCustomBin',
		headingCount: 5,
		independent: [addInteraction(pgsRegularBin, 'agedx'), addInteraction(agedxCustomBin, 'prs_PGS000332')]
	},
	{
		name: 'raceGroupsetting*pgsRegularBin',
		headingCount: 5,
		independent: [addInteraction(raceGroupsetting, 'prs_PGS000332'), addInteraction(pgsRegularBin, 'genetic_race')]
	},
	{
		name: 'raceGroupsetting*pgsCustomBin',
		headingCount: 5,
		independent: [addInteraction(pgsCustomBin, 'genetic_race'), addInteraction(raceGroupsetting, 'prs_PGS000332')]
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
		name: 'sex diaggrp agedx hrtavgSpline snplst',
		headingCount: 6,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'diaggrp' },
			{ id: 'agedx' },
			snplst,
			{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } }
		]
	},

	{
		// cannot use diaggrp to interact with snplst, it will timeout
		name: 'sex income*snplst',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'homeinc', interactions: ['snplstTermId'] },
			addInteraction(snplst, 'homeinc')
		]
	},

	{
		name: 'sex hrtavg*snplst',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'hrtavg', interactions: ['snplstTermId'] },
			addInteraction(snplst, 'hrtavg')
		]
	},
	{
		name: 'sex pgsRegularBin*snplst',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(pgsRegularBin, 'snplstTermId'),
			addInteraction(snplst, 'prs_PGS000332')
		]
	},
	{
		name: 'sex pgsCustomBin*snplst',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(pgsCustomBin, 'snplstTermId'),
			addInteraction(snplst, 'prs_PGS000332')
		]
	},
	{
		name: 'sex diaggrpGroupsetting*snplst',
		headingCount: 5,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(diaggrpGroupsetting, 'snplstTermId'),
			addInteraction(snplst, 'diaggrp')
		]
	},

	{
		name: 'sex diaggrp agedx hrtavgSpline snplocus',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'diaggrp' },
			{ id: 'agedx' },
			snplocus,
			{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } }
		]
	},

	{
		name: 'sex income*snplocus',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'homeinc', interactions: ['snplocusTermId'] },
			addInteraction(snplocus, 'homeinc')
		]
	},

	{
		name: 'sex hrtavg*snplocus',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			{ id: 'hrtavg', interactions: ['snplocusTermId'] },
			addInteraction(snplocus, 'hrtavg')
		]
	},
	{
		name: 'sex pgsRegularBin*snplst',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(pgsRegularBin, 'snplocusTermId'),
			addInteraction(snplocus, 'prs_PGS000332')
		]
	},
	{
		name: 'sex pgsCustomBin*snplocus',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(pgsCustomBin, 'snplocusTermId'),
			addInteraction(snplocus, 'prs_PGS000332')
		]
	},
	{
		name: 'sex diaggrpGroupsetting*snplocus',
		headingCount: 0,
		independent: [
			{ id: 'sex', refGrp: '1' },
			addInteraction(diaggrpGroupsetting, 'snplocusTermId'),
			addInteraction(snplocus, 'diaggrp')
		]
	}
]

////////////////////////// tests start

tape('\n', function (test) {
	test.comment('-***- mass/regression -***-')
	test.end()
})

/* each item from the list contains a set of independent variables
append them to an outcome to make a model and run analysis
the test will check the number of headings in result 
the test will pass if there's no runtime error (client, server, R)
*/

const activeTests = testList.filter(t => t.runthis)

for (const item of activeTests.length ? activeTests : testList) {
	tape('(LINEAR) EF ~ ' + item.name, test => {
		test.timeoutAfter(50000)
		runpp(
			{
				regressionType: 'linear',
				outcome: { id: 'LV_Ejection_Fraction_3D' },
				independent: item.independent
			},
			async reg => {
				reg.on('postRender.test', null)
				test.equal(findResultHeadings(reg), item.headingCount, 'result has ' + item.headingCount + ' headings')
				mayDestroyDom(test, reg)
				test.end()
			},
			test
		)
	})
	tape('(LOGISTIC) EF ~ ' + item.name, test => {
		test.timeoutAfter(50000)
		runpp(
			{
				regressionType: 'logistic',
				outcome: { id: 'LV_Ejection_Fraction_3D' },
				independent: item.independent
			},
			async reg => {
				reg.on('postRender.test', null)
				test.equal(findResultHeadings(reg), item.headingCount, 'result has ' + item.headingCount + ' headings')
				mayDestroyDom(test, reg)
				test.end()
			},
			test
		)
	})
	tape('(LOGISTIC) Arrhythmias ~ ' + item.name, test => {
		test.timeoutAfter(50000)
		runpp(
			{
				regressionType: 'logistic',
				outcome: { id: 'Arrhythmias' },
				independent: item.independent
			},
			async reg => {
				reg.on('postRender.test', null)
				test.equal(findResultHeadings(reg), item.headingCount, 'result has ' + item.headingCount + ' headings')
				mayDestroyDom(test, reg)
				test.end()
			},
			test
		)
	})
	tape('(COX) Arrhythmias ~ ' + item.name, test => {
		test.timeoutAfter(50000)
		runpp(
			{
				regressionType: 'cox',
				outcome: { id: 'Arrhythmias' },
				independent: item.independent
			},
			async reg => {
				reg.on('postRender.test', null)
				test.equal(findResultHeadings(reg), item.headingCount, 'result has ' + item.headingCount + ' headings')
				mayDestroyDom(test, reg)
				test.end()
			},
			test
		)
	})
}

///////////////////////// helper

function runpp(plot, runtest, test) {
	plot.chartType = 'regression'
	helpers.getRunPp('mass', {
		nav: {
			activeTab: 1
		},
		state: {
			genome: 'hg38',
			dslabel: 'SJLife'
		},
		debug: 1
	})({
		state: { plots: [plot] },
		app: {
			callbacks: {
				'postInit.test': (app, error = null) => {
					if (!error) return
					test.fail('app.init() error: ' + JSON.stringify(error))
					test.end()
				}
			}
		},
		regression: {
			callbacks: {
				'postRender.test': runtest
			}
		}
	})
}

function findResultHeadings(reg) {
	if (reg.Inner.results.dom.err_div.style('display') == 'block') {
		// error is shown; return -1 as heading count so the test will always fail
		return -1
	}

	// headings are created as <span>name</span>
	const spans = reg.Inner.results.dom.oneSetResultDiv.selectAll('span').nodes()
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

function addInteraction(tw, interId) {
	const a = JSON.parse(JSON.stringify(tw))
	a.interactions = [interId]
	return a
}

function mayDestroyDom(test, component) {
	if (!test._ok) return
	if (component.Inner.app) component.Inner.app.destroy()
	else component.destroy()
}
