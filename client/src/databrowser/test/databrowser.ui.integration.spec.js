import tape from 'tape'
import * as d3s from 'd3-selection'
import { init_databrowserUI } from '../databrowser.ui'
import { detectGte } from '../../../test/test.helpers'
import { runproteinpaint } from '../../../test/front.helpers.js'

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

tape('\n', function (test) {
	test.comment('-***- databrowser UI -***-')
	test.end()
})

tape('Render Databrowser UI from runpp()', async test => {
	test.timeoutAfter(300)
	const holder = getHolder().node()

	await runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		tkui: 'databrowser'
	})

	const headers = ['Data Dictionary']
	const sectionFound = await detectGte({
		elem: holder,
		selector: '.sjpp-databrowser-section-header'
	})
	const headersFound = sectionFound.filter(elem => headers.some(h => h == elem.innerText))
	test.equal(headersFound.length, sectionFound.length, `Should render all sections`)

	if (test._ok) holder.remove()
	test.end()
})

tape('Click submit with no data', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	init_databrowserUI(holder)

	const submitBtn = [...holder.node().querySelectorAll('.sjpp-ui-submitBtn')].find(
		elem => elem.innerText == 'Create Data Browser'
	)
	submitBtn.dispatchEvent(new Event('click'))
	test.equal(holder.selectAll('.sja_errorbar').size(), 1, "should display 'no data' error")

	if (test._ok) holder.remove()
	test.end()
})

tape.skip('Render Databrowser from copy/paste data', async test => {
	/**Works with npm start && npm run test:integration --workspace=client but fails in the browser
	 * Will fix with mutations UI branch
	 */
	test.timeoutAfter(3000)
	const holder = getHolder()

	const tsv = [
		`variable\ttype\tcategories`,
		`A1a\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A1b\tcategorical\t{ "0": { "label": "No" }, "1": { "label": "Yes" } }`,
		`A2a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`,
		`B1a\tcategorical\t{ "0": {"label": "Not treated" }, "1": { "label": "Treated" } }`
	]
		.join('\n')
		.trim()

	init_databrowserUI(holder)

	const pasteBtn = [...holder.node().querySelectorAll('.sj-toggle-button')].find(elem => elem.innerText == 'Paste Data')
	pasteBtn.dispatchEvent(new Event('click'))

	const textArea = d3s.select('textarea')._groups[0][0]
	textArea.value = tsv
	textArea.dispatchEvent(new Event('keyup'))

	const submitBtn = [...holder.node().querySelectorAll('.sjpp-ui-submitBtn')].find(
		elem => elem.innerText == 'Create Data Browser'
	)

	const foundPills = await detectGte({
		elem: holder.node(),
		selector: '.ts_pill',
		count: 4,
		trigger() {
			submitBtn.dispatchEvent(new Event('click'))
		}
	})

	test.equal(foundPills.length, 4, 'Should render four pills')

	if (test._ok) holder.remove()
	test.end()
})
