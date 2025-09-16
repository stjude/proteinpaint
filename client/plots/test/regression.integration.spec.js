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
    Cox: graded outcome = "Arrhythmias", continuous independent = "agedx"
	Cox: survival outcome, continuous independent = "agedx"

TODO:
	Test (maybe in unit?) beta and PR functions
*/

tape('\n', test => {
	test.comment('-***- plots/regression -***-')
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
		test.equal(
			regDom.inputs
				.selectAll('table')
				.nodes()
				.filter(t => t.childNodes.length > 1).length,
			2,
			`Should render two tables for independent variables`
		)

		//**** Results ****
		let table, tableLabel, results, testTerm

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
		const coefHeader = structuredClone(data.coefficients.header)
		coefHeader.splice(3, 2, '95% CI')
		coefHeader[2] = coefHeader[2] + String.fromCharCode(160) + 'ⓘ'
		results = checkTableRow(table, 0, coefHeader)
		test.equal(results, true, `Should render all coefficient headers in ${tableLabel}`)
		const linearHeaders = coefHeader.filter(d => d === 'Beta' + String.fromCharCode(160) + 'ⓘ')
		test.equal(linearHeaders.length, 1, `Should render headers specific to linear regression`)
		const coefIntercept = [data.coefficients.intercept[0], data.coefficients.intercept[1]]
		coefIntercept.push(...getCoefData(data.coefficients.intercept.slice(2)))
		results = checkTableRow(table, 1, coefIntercept)
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		testTerm = 'Sex'
		const checkValues1 = ['Sex\nREF\nFemale', 'Male']
		checkValues1.push(...getCoefData(data.coefficients.terms[tid2$id('sex', regression)].categories[1]))
		results = checkTableRow(table, 2, checkValues1)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		testTerm = 'African Ancestry'
		const checkValues2 = ['Genetically defined race\nREF\nEuropean Ancestry', testTerm]
		checkValues2.push(...getCoefData(data.coefficients.terms[tid2$id('genetic_race', regression)].categories[testTerm]))
		results = checkTableRow(table, 3, checkValues2)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		testTerm = 'Asian Ancestry'
		const checkValues3 = [testTerm]
		checkValues3.push(...getCoefData(data.coefficients.terms[tid2$id('genetic_race', regression)].categories[testTerm]))
		results = checkTableRow(table, 4, checkValues3)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		results = checkTableRow(table, 0, data.type3.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)

		results = checkTableRow(table, 1, data.type3.intercept)
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		testTerm = 'Sex'
		const checkValues4 = [testTerm]
		data.type3.terms[tid2$id('sex', regression)].forEach(d => checkValues4.push(d))
		results = checkTableRow(table, 2, checkValues4)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		testTerm = 'Genetically defined race'
		const checkValues5 = [testTerm]
		data.type3.terms[tid2$id('genetic_race', regression)].forEach(d => checkValues5.push(d))
		results = checkTableRow(table, 3, checkValues5)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			results = checkTableRow(table, i, [header, data.other.rows[i]])
			test.equal(results, true, `Should render all ${header} data in ${tableLabel}`)
		}

		const elem = regDom.inputs.node()
		await detectOne({ selector: '.sjpp-vp-violinDiv', elem })
		test.ok(elem.querySelector('.sjpp-vp-violinDiv'), `Should render violin plot for outcome variable`)

		if (test._ok) regression.Inner.app.destroy()
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
			regDom.inputs.selectAll('.sjpp-vp-violinDiv').nodes().length,
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
		results = checkOnlyRowValues(
			values2check,
			getCoefData(data.coefficients.terms[tid2$id('aaclassic_5', regression)].fields)
		)
		test.equal(results, true, `Should render all continous 'aaclassic_5' data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		const values2check2 = Array.from(table[2].childNodes).slice(1)
		results = checkOnlyRowValues(values2check2, data.type3.terms[tid2$id('aaclassic_5', regression)])
		test.equal(results, true, `Should render all continous 'aaclassic_5' data in ${tableLabel}`)

		if (test._ok) regression.Inner.app.destroy()
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

		const $id = tid2$id('aaclassic_5', regression)

		for (const [i, tr] of table.entries()) {
			//Test all bin values for independent term
			if (i < 2 || i == table.length - 1) continue //Skip header, intercept, and bottom scale rows
			if (i == 2) {
				//Skip the beginning cell spanning the remaining rows
				const checkValues = getCoefData(data.coefficients.terms[$id].categories[tr.childNodes[1].innerText])
				results = checkOnlyRowValues(Array.from(tr.childNodes).slice(1), checkValues)
				test.equal(results, true, `Should render all ${tr.childNodes[1].innerText} bin data in ${tableLabel}`)
			} else {
				const checkValues = getCoefData(data.coefficients.terms[$id].categories[tr.childNodes[0].innerText])
				results = checkOnlyRowValues(Array.from(tr.childNodes), checkValues)
				test.equal(results, true, `Should render all ${tr.childNodes[0].innerText} bin data in ${tableLabel}`)
			}
		}

		//TODO: necessary to check all other values?

		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Linear: continuous outcome = "agedx", cubic spline independent = "aaclassic_5"', test => {
	test.timeoutAfter(9000) // increased to 9 seconds to avoid timeout

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

		const $id = tid2$id('aaclassic_5', regression)

		//**** Inputs ****
		// await detectGte({elem: regDom.inputs.node(), selector: '.sjpp-vp-violinDiv', count: 3})
		const knotLines = regDom.inputs.selectAll('.sjpp-vp-violinDiv .sjpp-vp-line').nodes()
		test.equal(knotLines.length, numOfKnots, `Should render 3 lines over the independent variable violin plot`)

		//**** Results ****
		let tableLabel, table, results

		const splinePlot = regDom.results.select('div[name^="Cubic spline plots"] img').node()
		test.ok(splinePlot, `Should render a cubic spline plot`)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()

		test.equal(
			Object.keys(data.coefficients.terms[$id].categories).length,
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
					getCoefData(data.coefficients.terms[$id].categories[tr.childNodes[1].innerText])
				)
				test.equal(results, true, `Should render all ${tr.childNodes[1].innerText} data in ${tableLabel}`)
			} else {
				results = checkOnlyRowValues(
					Array.from(tr.childNodes),
					getCoefData(data.coefficients.terms[$id].categories[tr.childNodes[0].innerText])
				)
				test.equal(results, true, `Should render all ${tr.childNodes[0].innerText} data in ${tableLabel}`)
			}
		}

		//TODO: necessary to check all other values?

		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Logistic: binary outcome = "hrtavg", continuous independent = "agedx"', test => {
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

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		//**** Results ****
		let tableLabel, table, results, testTerm

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
		tableLabel = 'Deviance residuals table'
		table = regDom.results.selectAll('table[name^="sjpp-residuals-table"] tr').nodes()
		results = checkTableRow(table, 1, data.residuals.rows)
		test.equal(results, true, `Should render all residuals data in ${tableLabel}`)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		const coefHeader = structuredClone(data.coefficients.header)
		coefHeader.splice(3, 2, '95% CI')
		coefHeader[2] = coefHeader[2] + String.fromCharCode(160) + 'ⓘ'
		results = checkTableRow(table, 0, coefHeader)
		test.equal(results, true, `Should render all coefficient headers in ${tableLabel}`)
		const logHeaders = coefHeader.filter(d => d === 'Odds ratio' + String.fromCharCode(160) + 'ⓘ')
		test.equal(logHeaders.length, 1, `Should render headers specific to logistic regression`)

		const coefIntercept = [data.coefficients.intercept[0], data.coefficients.intercept[1]]
		coefIntercept.push(...getCoefData(data.coefficients.intercept.slice(2)))
		results = checkTableRow(table, 1, coefIntercept)
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		testTerm = 'Age (years) at Cancer Diagnosis'
		const checkValues1 = [testTerm, '(continuous)']
		checkValues1.push(...getCoefData(data.coefficients.terms[tid2$id('agedx', regression)].fields))
		results = checkTableRow(table, 2, checkValues1)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		results = checkTableRow(table, 0, data.type3.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)

		results = checkTableRow(table, 1, data.type3.intercept)
		test.equal(results, true, `Should render all intercept data in ${tableLabel}`)

		const checkValues2 = [testTerm]
		data.type3.terms[tid2$id('agedx', regression)].forEach(d => checkValues2.push(d))
		results = checkTableRow(table, 2, checkValues2)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			results = checkTableRow(table, i, [header, data.other.rows[i]])
			test.equal(results, true, `Should render all ${header} data in ${tableLabel}`)
		}

		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Cox: graded outcome = "Arrhythmias", continuous independent = "agedx"', test => {
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

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		//#of events instead of residuals table, no intercept in coefficent, stats test table

		//**** Results ****
		let tableLabel, table, results, testTerm

		//Sample size
		const sampleSizeDiv = regDom.results
			.selectAll('div[name^="Sample size"] span')
			.nodes()
			.filter(d => d.innerText == data.sampleSize)
		test.ok(
			regDom.results.node().querySelector('div[name^="Sample size"]') && sampleSizeDiv,
			`Should render "Sample size: ${data.sampleSize}"`
		)

		//Number of events
		const numOfEventsDiv = regDom.results
			.selectAll('div[name^="Number of events"] span')
			.nodes()
			.filter(d => d.innerText == data.eventCnt)
		test.ok(
			regDom.results.node().querySelector('div[name^="Number of events"]') && numOfEventsDiv,
			`Should render "Number of events: ${data.eventCnt}"`
		)

		test.ok(
			!regDom.results.select('table[name^="sjpp-residuals-table"]').node(),
			`Should not render residuals table in cox regression`
		)

		const $id = tid2$id('agedx', regression)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		const coefHeader = structuredClone(data.coefficients.header)
		coefHeader.splice(2, 2)
		coefHeader.splice(3, 2, '95% CI')
		coefHeader[2] = coefHeader[2] + String.fromCharCode(160) + 'ⓘ'
		results = checkTableRow(table, 0, coefHeader)
		test.equal(results, true, `Should render all coefficient headers in ${tableLabel}`)
		const coxHeaders = coefHeader.filter(d => d === 'HR' + String.fromCharCode(160) + 'ⓘ')
		test.equal(coxHeaders.length, 1, `Should render headers specific to cox regression in ${tableLabel}`)

		testTerm = 'Age (years) at Cancer Diagnosis'
		const checkValues1 = [testTerm, '(continuous)']
		data.coefficients.terms[$id].fields.splice(0, 2)
		checkValues1.push(...getCoefData(data.coefficients.terms[$id].fields))
		results = checkTableRow(table, 1, checkValues1)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		results = checkTableRow(table, 0, data.type3.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)

		const checkValues2 = [testTerm]
		data.type3.terms[$id].forEach(d => checkValues2.push(d))
		results = checkTableRow(table, 1, checkValues2)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Statistical tests
		tableLabel = 'Statistical tests table'
		table = regDom.results.selectAll('div[name^="Statistical tests"] table tr').nodes()
		results = checkTableRow(table, 0, data.tests.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)
		for (const [i, row] of data.tests.rows.entries()) {
			results = checkTableRow(table, i + 1, row)
			test.equal(results, true, `Should render all ${row} data in ${tableLabel}`)
		}

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			results = checkTableRow(table, i, [header, data.other.rows[i]])
			test.equal(results, true, `Should render all ${header} data in ${tableLabel}`)
		}

		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('Cox: survival outcome, continuous independent = "agedx"', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'cox',
					outcome: {
						id: 'os'
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

	async function runTests(regression) {
		const data = await getData(regression)
		const regDom = regression.Inner.dom

		const $id = tid2$id('agedx', regression)

		//#of events instead of residuals table, no intercept in coefficent, stats test table

		//**** Results ****
		let tableLabel, table, results, testTerm

		//Sample size
		const sampleSizeDiv = regDom.results
			.selectAll('div[name^="Sample size"] span')
			.nodes()
			.filter(d => d.innerText == data.sampleSize)
		test.ok(
			regDom.results.node().querySelector('div[name^="Sample size"]') && sampleSizeDiv,
			`Should render "Sample size: ${data.sampleSize}"`
		)

		//Number of events
		const numOfEventsDiv = regDom.results
			.selectAll('div[name^="Number of events"] span')
			.nodes()
			.filter(d => d.innerText == data.eventCnt)
		test.ok(
			regDom.results.node().querySelector('div[name^="Number of events"]') && numOfEventsDiv,
			`Should render "Number of events: ${data.eventCnt}"`
		)

		test.ok(
			!regDom.results.select('table[name^="sjpp-residuals-table"]').node(),
			`Should not render residuals table in cox regression`
		)

		//Coefficients table
		tableLabel = 'coefficients table'
		table = regDom.results.selectAll('div[name^="Coefficients"] table tr').nodes()
		const coefHeader = structuredClone(data.coefficients.header)
		coefHeader.splice(2, 2)
		coefHeader.splice(3, 2, '95% CI')
		coefHeader[2] = coefHeader[2] + String.fromCharCode(160) + 'ⓘ'
		results = checkTableRow(table, 0, coefHeader)
		test.equal(results, true, `Should render all coefficient headers in ${tableLabel}`)
		const coxHeaders = coefHeader.filter(d => d === 'HR' + String.fromCharCode(160) + 'ⓘ')
		test.equal(coxHeaders.length, 1, `Should render headers specific to cox regression in ${tableLabel}`)

		testTerm = 'Age (years) at Cancer Diagnosis'
		const checkValues1 = [testTerm, '(continuous)']
		data.coefficients.terms[$id].fields.splice(0, 2)
		checkValues1.push(...getCoefData(data.coefficients.terms[$id].fields))
		results = checkTableRow(table, 1, checkValues1)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Type III Stats
		tableLabel = 'type3 table'
		table = regDom.results.selectAll('div[name^="Type III statistics"] table tr').nodes()
		results = checkTableRow(table, 0, data.type3.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)

		const checkValues2 = [testTerm]
		data.type3.terms[$id].forEach(d => checkValues2.push(d))
		results = checkTableRow(table, 1, checkValues2)
		test.equal(results, true, `Should render all ${testTerm} data in ${tableLabel}`)

		//Statistical tests
		tableLabel = 'Statistical tests table'
		table = regDom.results.selectAll('div[name^="Statistical tests"] table tr').nodes()
		results = checkTableRow(table, 0, data.tests.header)
		test.equal(results, true, `Should render all header data in ${tableLabel}`)
		for (const [i, row] of data.tests.rows.entries()) {
			results = checkTableRow(table, i + 1, row)
			test.equal(results, true, `Should render all ${row} data in ${tableLabel}`)
		}

		//Other stats
		tableLabel = 'other summary statistics table'
		table = regDom.results.selectAll('div[name^="Other summary statistics"] table tr').nodes()
		for (const [i, header] of data.other.header.entries()) {
			results = checkTableRow(table, i, [header, data.other.rows[i]])
			test.equal(results, true, `Should render all ${header} data in ${tableLabel}`)
		}

		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

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

function getCoefData(in_data) {
	const out_data = structuredClone(in_data)
	// combine 95% CI columns
	out_data.splice(1, 2, `${out_data[1]} – ${out_data[2]}`)
	return out_data
}

function tid2$id(tid, regression) {
	const t = regression.Inner.inputs.independent.inputLst.find(i => i.term.id == tid)
	if (t) return t.term.$id
	throw 'unknown ' + tid
}
