import { event as d3event } from 'd3-selection'
import { makelabel } from './leftlabel'
import { tab2box } from '../client'
import { fillbar } from '../../dom/fillbar'
import { displaySampleTable } from './sampletable'

export function makeSampleLabel(data, tk, block, laby) {
	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.samples) {
		tk.leftlabels.doms.samples = makelabel(tk, block, laby)
	}

	tk.leftlabels.doms.samples
		.text(`${data.sampleTotalNumber} case${data.sampleTotalNumber > 1 ? 's' : ''}`)
		.on('click', () => {
			tk.menutip.clear().showunder(d3event.target)

			mayShowSummary(tk, block)

			menu_samples(data, tk, block)
		})
}

function mayShowSummary(tk, block) {
	if (!tk.mds.variant2samples.termidlst) {
		// no terms to summarize for
		return
	}
	// function is not async to display "wait" and not to block showing other menu options
	const wait = tk.menutip.d
		.append('div')
		.text('Loading...')
		.style('margin', '10px')

	tk.mds
		.getSamples({ isSummary: true })
		.then(async data => {
			wait.html('')
			await showSummary4terms(data, wait, tk, block)
		})
		.catch(e => {
			wait.text(`Error: ${e.message || e}`)
		})
}

/* show summaries over a list of terms
data is array, each ele: {termid, termname, numbycategory}
 */
async function showSummary4terms(data, div, tk, block) {
	const tabs = []
	for (const { termid, termname, numbycategory } of data) {
		tabs.push({
			label: `${termname} 
				<span style='color:#999;font-size:.8em;float:right;margin-left: 5px;'>
				n=${numbycategory.length}</span>`,
			callback: div => showSummary4oneTerm(termid, div, numbycategory, tk, block)
		})
	}
	tab2box(div, tabs)
}

/* show categories and #case for one term
click a category to list cases
*/
function showSummary4oneTerm(termid, div, numbycategory, tk, block) {
	const grid_div = div
		.append('div')
		.style('display', 'inline-grid')
		.style('grid-template-columns', 'auto auto auto')
		.style('grid-row-gap', '3px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	for (const [category_name, count, total] of numbycategory) {
		const cat_div = grid_div
			.append('div')
			.style('padding-right', '10px')
			.style('cursor', 'pointer')
			.text(category_name)
			.on('mouseover', () => {
				cat_div.style('color', 'blue').style('text-decoration', 'underline')
			})
			.on('mouseout', () => {
				cat_div.style('color', '#000').style('text-decoration', 'none')
			})
			.on('click', () => listSamples(category_name))

		if (total != undefined) {
			// show percent bar
			const percent_div = grid_div
				.append('div')
				.on('mouseover', () => {
					cat_div.style('color', 'blue').style('text-decoration', 'underline')
				})
				.on('mouseout', () => {
					cat_div.style('color', '#000').style('text-decoration', 'none')
				})
				.on('click', () => listSamples(category_name))

			fillbar(percent_div, { f: count / total, v1: count, v2: total }, { fillbg: '#ECE5FF', fill: '#9F80FF' })
		}

		grid_div
			.append('div')
			.html(count + (total ? ' / ' + total : ''))
			.style('text-align', 'right')
			.style('padding', '2px 10px')
			.style('font-size', '.8em')
			.on('mouseover', () => {
				cat_div.style('color', 'blue').style('text-decoration', 'underline')
			})
			.on('mouseout', () => {
				cat_div.style('color', '#000').style('text-decoration', 'none')
			})
			.on('click', () => listSamples(category_name))
	}

	async function listSamples(category) {
		// for a selected category, list the samples
		tk.menutip.clear()
		const div = tk.menutip.d.append('div').style('margin', '10px')
		const wait = div.append('div').text('Loading...')
		const samples = await tk.mds.getSamples({ tid2value: { [termid]: category } })
		wait.remove()
		await displaySampleTable(samples, { div, tk, block, useRenderTable: true })
	}
}

function menu_samples(data, tk, block) {
	// subject to change

	if (tk.mds.variant2samples.termidlst) {
		// list terms for selecting one and summarize
	}

	tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption')
		.on('click', async () => {
			tk.menutip.clear()
			const wait = tk.menutip.d
				.append('div')
				.text('Loading...')
				.style('margin', '15px')
			try {
				const samples = await tk.mds.getSamples()
				await displaySampleTable(samples, {
					div: tk.menutip.d,
					tk,
					block,
					useRenderTable: true
				})
				wait.remove()
			} catch (e) {
				wait.text(e.message || e)
				console.log(e)
			}
		})
}
