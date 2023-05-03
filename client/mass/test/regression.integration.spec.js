import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    Linear: continuous outcome = "agedx", cat. independent = "sex" + "genetic_race"
    Linear: continuous outcome = "agedx", continuous independent = "aaclassic_5"
	Linear: continuous outcome = "agedx", discrete independent = "aaclassic_5"
	Linear: continuous outcome = "agedx", cubic spline. independent = "aaclassic_5"
	Logistic: binary outcome = "hrtavg", continuous independent = "agedx"
    Cox: graded outcome = "Arrhythmias", discrete independent = "agedx"
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hide_search',
			activeTab: 1
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

async function getData(regression) {
	const data = await regression.Inner.app.Inner.api.vocabApi.getRegressionData(getDataRequestOpts(regression))

	function getDataRequestOpts(regression) {
		const c = regression.Inner.config
		const opts = {
			regressionType: c.regressionType,
			outcome: c.outcome,
			independent: c.independent
		}
		opts.filter = regression.Inner.inputs.parent.filter

		return opts
	}

	return data.resultLst[0].data
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- plots/regression -***-')
	test.end()
})

//values to test: beta, PR

tape('Linear: continuous outcome = "agedx", cat. independent = "sex" + "genetic_race"', test => {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: {
						id: 'agedx'
					},
					independent: [{ id: 'sex' }, { id: 'genetic_race' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		//**** Inputs ****
		test.ok(regDom.inputs.node().querySelector('#sjpp-vp-violinDiv'), `Should render violin plot for outcome variable`)
		test.equal(
			regDom.inputs
				.selectAll('table')
				.nodes()
				.filter(t => t.childNodes.length > 1).length,
			2,
			`Should render two tables for independent variables`
		)

		//**** Results ****
		let table, tableLabel, catTerm

		//Sample size
		const sampleSizeDiv = regDom.results
			.selectAll('div[name^="Sample size"] span')
			.nodes()
			.filter(d => d.innerText == data.sampleSize)
		test.ok(
			regDom.results.node().querySelector('div[name^="Sample size"]') && sampleSizeDiv,
			`Should render "Sample size: ${data.sampleSize}"`
		)

		//Residual table
		tableLabel = 'residuals table'
		table = regDom.results.selectAll('table[name^="sjpp-residuals-table"] tr').nodes()
		checkTableRow(1, data.residuals.rows, 'residuals results')

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		checkTableRow(0, data.coefficients.header, 'Coefficients header')
		checkTableRow(1, data.coefficients.intercept, 'Intercept')

		catTerm = 'Sex'
		const checkValues1 = ['Sex\nREF Female', 'Male']
		data.coefficients.terms.sex.categories[1].forEach(d => checkValues1.push(d))
		checkTableRow(2, checkValues1, `Term = "${catTerm}"`)

		catTerm = 'African Ancestry'
		const checkValues2 = ['Genetically defined race\nREF European Ancestry', catTerm]
		data.coefficients.terms.genetic_race.categories[catTerm].forEach(d => checkValues2.push(d))
		checkTableRow(3, checkValues2, `Term = "Genetically defined race, ${catTerm}"`)

		catTerm = 'Asian Ancestry'
		const checkValues3 = [catTerm]
		data.coefficients.terms.genetic_race.categories[catTerm].forEach(d => checkValues3.push(d))
		checkTableRow(4, checkValues3, `Term = "Genetically defined race, ${catTerm}"`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		checkTableRow(0, data.type3.header, 'Type III Stats header')
		checkTableRow(1, data.type3.intercept, 'Intercept')

		catTerm = 'Sex'
		const checkValues4 = [catTerm]
		data.type3.terms.sex.forEach(d => checkValues4.push(d))
		checkTableRow(2, checkValues4, `Term = "${catTerm}"`)

		catTerm = 'Genetically defined race'
		const checkValues5 = [catTerm]
		data.type3.terms.genetic_race.forEach(d => checkValues5.push(d))
		checkTableRow(3, checkValues5, `Term = "${catTerm}"`)

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			checkTableRow(i, [header, data.other.rows[i]], `${header}`)
		}

		function checkTableRow(idx, dataArray, label) {
			const checkArray = []
			let issueFound = false
			table[idx].childNodes.forEach(t => {
				checkArray.push(t.innerText)
			})
			dataArray.forEach(d => {
				if (!checkArray.some(t => t == d)) {
					issueFound = true
					test.fail(`${label} value = ${d} not rendered`)
				}
			})
			test.equal(issueFound, false, `Correctly rendered all ${label} data in ${tableLabel}`)
		}

		test.end()
	}
})

tape.only('Linear: continuous outcome = "agedx", continuous independent = "aaclassic_5"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: {
						id: 'agedx'
					},
					independent: [{ id: 'aaclassic_5', q: { mode: 'continuous' } }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		//**** Inputs ****
		test.ok(regDom.inputs.node().querySelector('#sjpp-vp-violinDiv'), `Should render violin plot for outcome variable`)

		test.end()
	}
})

tape.skip('Linear: continuous outcome = "agedx", discrete independent = "aaclassic_5"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: {
						id: 'agedx'
					},
					independent: [{ id: 'aaclassic_5', q: { mode: 'discrete' } }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})

tape.skip('Linear: continuous outcome = "agedx", cubic spline. independent = "aaclassic_5"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					outcome: {
						id: 'agedx',
						isAtomic: true
					},
					independent: [
						{ id: 'aaclassic_5', q: { mode: 'spline', knots: [{ value: 2000 }, { value: 12000 }, { value: 24000 }] } }
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

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})

tape.skip('Logistic: binary outcome = "hrtavg", continuous independent = "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					outcome: {
						id: 'hrtavg',
						isAtomic: true
					},
					independent: [{ id: 'agedx' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})

tape.skip('Cox: graded outcome = "Arrhythmias", discrete independent = "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'cox',
					outcome: {
						id: 'Arrhythmias'
					},
					independent: [{ id: 'agedx' }]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regression) {
		console.log(regression.Inner)

		test.end()
	}
})
