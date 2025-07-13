import tape from 'tape'
import * as d3s from 'd3-selection'
import { detectOne, detectZero, whenVisible } from '../../test/test.helpers'

/**************
 test sections

Cohort MAF ui, male
Cohort MAF ui, female

***************/

// query twice with two non-overlapping cohorts. count sets of case submitter ids from each time
const maleCohort = {
	op: 'and',
	content: [
		{ op: 'in', content: { field: 'cases.primary_site', value: 'brain' } },
		{ op: 'in', content: { field: 'cases.demographic.gender', value: 'male' } }
	]
}
const femaleCohort = {
	op: 'and',
	content: [
		{ op: 'in', content: { field: 'cases.primary_site', value: 'brain' } },
		{ op: 'in', content: { field: 'cases.demographic.gender', value: 'female' } }
	]
}

const maleCases = new Set()

tape('\n', function (test) {
	test.comment('-***- GDC cohort MAF UI -***-')
	test.end()
})

tape('Cohort MAF ui, male', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		filter0: maleCohort,
		launchGdcMaf: 1,
		callbacks: { postRender }
	})

	async function postRender(api) {
		const table = await detectOne({ elem: holder, selector: '[data-testid="sja_mafFileTable"]' })
		test.pass('sja_mafFileTable is found')

		// collect <a> elements which is an ordered list of case submitter id, and file size. skip file size and only collect case uuid
		let skip = false
		for (const a of d3s.select(table).selectAll('a').nodes()) {
			if (skip) {
				skip = false
				continue
			}
			maleCases.add(a.innerHTML)
			skip = true
		}
		test.ok(maleCases.size > 100, 'more than 100 male cases, e.g. ' + [...maleCases][0])

		if (test._ok) {
			holder.remove()
		}
		test.end()
	}
})

tape('Cohort MAF ui, female', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		filter0: femaleCohort,
		launchGdcMaf: 1,
		callbacks: { postRender }
	})

	async function postRender(api) {
		const table = await detectOne({ elem: holder, selector: '[data-testid="sja_mafFileTable"]' })
		let skip = false
		let femaleCount = 0
		let alsoInMale = 0
		let acase
		for (const a of d3s.select(table).selectAll('a').nodes()) {
			if (skip) {
				skip = false
				continue
			}
			acase = a.innerHTML // for display
			femaleCount++
			if (maleCases.has(a.innerHTML)) alsoInMale++
			skip = true
		}
		test.ok(femaleCount > 100, 'more than 100 female cases, e.g. ' + acase)
		test.equal(alsoInMale, 0, 'no overlap with male cases')

		if (test._ok) {
			holder.remove()
		}
		test.end()
	}
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}
