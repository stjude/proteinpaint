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

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		genome: 'hg38',
		dslabel: 'SJLife'
	},
	debug: 1
})
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

const pgsRegularbin = {
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
const pgsCustombin = {
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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/regression -***-')
	test.end()
})

tape('(LINEAR) EF ~ sex race hrtavg', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, { id: 'hrtavg' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
		// can delete the dom of this app if test passes
		//app.Inner.app.Inner.dom.holder.remove()
	}
})

tape('(LINEAR) EF ~ sex raceGroupsetting hrtavg', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [{ id: 'sex', refGrp: '1' }, raceGroupsetting, { id: 'hrtavg' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
		// can delete the dom of this app if test passes
		//app.Inner.app.Inner.dom.holder.remove()
	}
})

tape('(LINEAR) EF ~ sex race pgsRegularbin', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, pgsRegularbin]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
	}
})

tape('(LINEAR) EF ~ sex race pgsCustombin', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [{ id: 'sex', refGrp: '1' }, { id: 'genetic_race' }, pgsCustombin]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
	}
})

tape('(LINEAR) EF ~ sex*race hrtavg', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [
						{ id: 'sex', refGrp: '1', interactions: ['genetic_race'] },
						{ id: 'genetic_race', interactions: ['sex'] },
						{ id: 'hrtavg' }
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
	}
})

tape('(LINEAR) EF ~ sex race hrtavgSpline', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [
						{ id: 'sex', refGrp: '1' },
						{ id: 'genetic_race' },
						{ id: 'hrtavg', q: { mode: 'spline', knots: [{ value: 4 }, { value: 18 }, { value: 200 }] } }
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 6, 'result has 6 headings')
		test.end()
	}
})

tape('(LOGISTIC) EF ~ sex race hrtavg', function(test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					outcome: { id: 'LV_Ejection_Fraction_3D' },
					independent: [{ id: 'sex' }, { id: 'genetic_race' }, { id: 'hrtavg' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
	}
})

tape('(LOGISTIC) Arrhythmias ~ sex', function(test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					outcome: { id: 'Arrhythmias' },
					independent: [{ id: 'sex' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	function runTests(app) {
		app.on('postRender.test', null)
		test.equal(findResultHeadings(app), 5, 'result has 5 headings')
		test.end()
	}
})

function findResultHeadings(app) {
	// headings are created as <span>name</span>
	const spans = app.Inner.results.dom.oneSetResultDiv.selectAll('span').nodes()
	let foundNumber = 0

	foundNumber += spans.find(i => i.innerText == 'Warnings') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Sample size:') ? 1 : 0

	// linear
	foundNumber += spans.find(i => i.innerText == 'Residuals') ? 1 : 0
	// logistic
	foundNumber += spans.find(i => i.innerText == 'Deviance residuals') ? 1 : 0

	foundNumber += spans.find(i => i.innerText == 'Cubic spline plots') ? 1 : 0

	foundNumber += spans.find(i => i.innerText == 'Coefficients') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Type III statistics') ? 1 : 0
	foundNumber += spans.find(i => i.innerText == 'Other summary statistics') ? 1 : 0

	return foundNumber
}
