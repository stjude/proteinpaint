import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    Linear: continuous outcome = "agedx", cat. independents = "sex" + "genetic_race"
    Linear: continuous outcome = "agedx", continuous independent = "aaclassic_5"
	Linear: continuous outcome = "agedx", discrete independent = "aaclassic_5"
	Linear: continuous outcome = "agedx", cubic spline independent = "aaclassic_5"
	Logistic: binary outcome = "hrtavg", continuous independent = "agedx"
    Cox: graded outcome = "Arrhythmias", discrete independent = "agedx"

TODO:
	Test (maybe in unit?) beta and PR functions
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

function checkTableRow(table, idx, dataArray) {
	const checkArray = []
	let issuesFound = 0
	table[idx].childNodes.forEach(t => {
		checkArray.push(t.innerText)
	})
	dataArray.forEach(d => {
		if (!checkArray.some(t => t == d)) {
			++issuesFound
		}
	})
	if (issuesFound === 0) return true
	else return false
}

function checkOnlyRowValues(valueNodes, dataArray) {
	const checkArray = []
	let issuesFound = 0
	valueNodes.forEach(t => {
		checkArray.push(t.innerText)
	})
	dataArray.forEach(d => {
		if (!checkArray.some(t => t == d)) {
			++issuesFound
		}
	})
	if (issuesFound === 0) return true
	else return false
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- plots/regression -***-')
	test.end()
})

tape('Linear: continuous outcome = "agedx", cat. independents = "sex" + "genetic_race"', test => {
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
		let table, tableLabel, results, catTerm

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
		results = checkTableRow(table, 1, data.residuals.rows)
		test.equal(results, true, `Should render all residuals data in ${tableLabel}`)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		results = checkTableRow(table, 0, data.coefficients.header)
		test.equal(results, true, `Should render all coefficient headers in ${tableLabel}`)

		results = checkTableRow(table, 1, data.coefficients.intercept)
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		catTerm = 'Sex'
		const checkValues1 = ['Sex\nREF Female', 'Male']
		data.coefficients.terms.sex.categories[1].forEach(d => checkValues1.push(d))
		results = checkTableRow(table, 2, checkValues1, `Term = "${catTerm}"`)
		test.equal(results, true, `Should render all ${catTerm} data in ${tableLabel}`)

		catTerm = 'African Ancestry'
		const checkValues2 = ['Genetically defined race\nREF European Ancestry', catTerm]
		data.coefficients.terms.genetic_race.categories[catTerm].forEach(d => checkValues2.push(d))
		results = checkTableRow(table, 3, checkValues2, `Term = "Genetically defined race, ${catTerm}"`)
		test.equal(results, true, `Should render all ${catTerm} data in ${tableLabel}`)

		catTerm = 'Asian Ancestry'
		const checkValues3 = [catTerm]
		data.coefficients.terms.genetic_race.categories[catTerm].forEach(d => checkValues3.push(d))
		results = checkTableRow(table, 4, checkValues3, `Term = "Genetically defined race, ${catTerm}"`)
		test.equal(results, true, `Should render all ${catTerm} data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		results = checkTableRow(table, 0, data.type3.header, 'Type III Stats header')
		test.equal(results, true, `Should render all header data in ${tableLabel}`)

		results = checkTableRow(table, 1, data.type3.intercept, 'Intercept')
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		catTerm = 'Sex'
		const checkValues4 = [catTerm]
		data.type3.terms.sex.forEach(d => checkValues4.push(d))
		results = checkTableRow(table, 2, checkValues4, `Term = "${catTerm}"`)
		test.equal(results, true, `Should render all ${catTerm} data in ${tableLabel}`)

		catTerm = 'Genetically defined race'
		const checkValues5 = [catTerm]
		data.type3.terms.genetic_race.forEach(d => checkValues5.push(d))
		results = checkTableRow(table, 3, checkValues5, `Term = "${catTerm}"`)
		test.equal(results, true, `Should render all ${catTerm} data in ${tableLabel}`)

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			results = checkTableRow(table, i, [header, data.other.rows[i]], `${header}`)
			test.equal(results, true, `Should render all ${header} data in ${tableLabel}`)
		}

		if (test.__ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Linear: continuous outcome = "agedx", continuous independent = "aaclassic_5"', test => {
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
		test.equal(
			regDom.inputs.selectAll('#sjpp-vp-violinDiv').nodes().length,
			2,
			`Should render violin plot for outcome variable`
		)

		//**** Results ****
		let tableLabel, table, results

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		test.equal(
			table[2].childNodes[1].innerText,
			'(continuous)',
			`Should correctly identify independent term as 'continuous' in ${tableLabel}`
		)

		const values2check = Array.from(table[2].childNodes).slice(3)
		results = checkOnlyRowValues(values2check, data.coefficients.terms.aaclassic_5.fields)
		test.equal(results, true, `Should render all continous 'aaclassic_5' data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		const values2check2 = Array.from(table[2].childNodes).slice(1)
		results = checkOnlyRowValues(values2check2, data.type3.terms.aaclassic_5)
		test.equal(results, true, `Should render all continous 'aaclassic_5' data in ${tableLabel}`)

		if (test.__ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Linear: continuous outcome = "agedx", discrete independent = "aaclassic_5"', test => {
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

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		//**** Results ****
		let tableLabel, table, results

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()

		for (const [i, tr] of table.entries()) {
			//Test all bin values for independent term
			if (i < 2 || i == table.length - 1) continue //Skip header, intercept, and bottom scale rows
			if (i == 2) {
				//Skip the beginning cell spanning the remain rows
				results = checkOnlyRowValues(
					Array.from(tr.childNodes).slice(1),
					data.coefficients.terms.aaclassic_5.categories[tr.childNodes[1].innerText]
				)
				test.equal(results, true, `Should render all ${tr.childNodes[1].innerText} bin data in ${tableLabel}`)
			} else {
				results = checkOnlyRowValues(
					Array.from(tr.childNodes),
					data.coefficients.terms.aaclassic_5.categories[tr.childNodes[0].innerText]
				)
				test.equal(results, true, `Should render all ${tr.childNodes[0].innerText} bin data in ${tableLabel}`)
			}
		}

		//TODO: necessary to check all other values?

		if (test.__ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Linear: continuous outcome = "agedx", cubic spline independent = "aaclassic_5"', test => {
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

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom
		const numOfKnots = regression.Inner.state.config.independent[0].q.knots.length

		//**** Inputs ****
		const knotLines = regDom.inputs.selectAll('#sjpp-vp-violinDiv .sjpp-vp-line').nodes()
		test.equal(knotLines.length, numOfKnots, `Should render 3 lines over the independent variable violin plot`)

		//**** Results ****
		let tableLabel, table, results

		const splinePlot = regDom.results.select('div[name^="Cubic spline plots"] img').node()
		test.ok(splinePlot, `Should render a cubic spline plot`)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()

		test.equal(
			Object.keys(data.coefficients.terms.aaclassic_5.categories).length,
			numOfKnots - 1,
			`Should pass data for ${numOfKnots - 1} spline functions`
		)

		for (const [i, tr] of table.entries()) {
			//Test all splice values for cubic spline term
			if (i < 2 || i == table.length - 1) continue
			if (i == 2) {
				//Skip the beginning cell spanning the remain rows
				results = checkOnlyRowValues(
					Array.from(tr.childNodes).slice(1),
					data.coefficients.terms.aaclassic_5.categories[tr.childNodes[1].innerText]
				)
				test.equal(results, true, `Should render all ${tr.childNodes[1].innerText} data in ${tableLabel}`)
			} else {
				results = checkOnlyRowValues(
					Array.from(tr.childNodes),
					data.coefficients.terms.aaclassic_5.categories[tr.childNodes[0].innerText]
				)
				test.equal(results, true, `Should render all ${tr.childNodes[0].innerText} data in ${tableLabel}`)
			}
		}

		//TODO: necessary to check all other values?

		if (test.__ok) regression.Inner.app.destroy()
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

		if (test.__ok) regression.Inner.app.destroy()
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

		if (test.__ok) regression.Inner.app.destroy()
		test.end()
	}
})
