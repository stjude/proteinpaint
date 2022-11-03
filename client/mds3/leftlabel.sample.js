import { makelabel } from './leftlabel'
import { tab2box } from '../src/client'
import { displaySampleTable } from './sampletable'
import { fillbar } from '#dom/fillbar'
import { make_densityplot } from '#dom/densityplot'
import { rangequery_rglst } from './tk'

/*
makes the "# samples" sub label on the left.
click label to view summaries about samples that have mutation data in the view range


*/

export function makeSampleLabel(data, tk, block, laby) {
	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.samples) {
		tk.leftlabels.doms.samples = makelabel(tk, block, laby)
	}

	tk.leftlabels.doms.samples
		.text(`${data.sampleTotalNumber} sample${data.sampleTotalNumber > 1 ? 's' : ''}`)
		.on('click', async event => {
			tk.menutip.clear().showunder(event.target)

			await mayShowSummary(tk, block)

			menu_samples(data, tk, block)
		})
}

/*
*******************************************
      this function will be redesigned
*******************************************
should not be based on variant2samples.twLst
but using mds.termdb.vocabApi, show a tree, select a term and display a summary plot
(may still need a default list of terms though)
*/
async function mayShowSummary(tk, block) {
	if (!tk.mds.variant2samples.twLst) {
		// no terms to summarize for
		return
	}

	const wait = tk.menutip.d
		.append('div')
		.text('Loading...')
		.style('margin', '10px')

	if (tk.mds?.termdb?.vocabApi) {
		// just a test!! to demo the vocab barchart api works with mds3 backend
		// when barchart can be integrated, show barchart instead of using getSamples()

		// make up term2 as geneVariant
		const geneTerm = {
			type: 'geneVariant',
			isoform: block.usegm.isoform,
			name: block.usegm.isoform
		}
		rangequery_rglst(tk, block, geneTerm) // creates geneTerm.rglst=[{}]

		const arg = {
			get: 'summary',
			term: tk.mds.variant2samples.twLst[0],
			term2: { term: geneTerm, q: {} }
		}

		//const chartSeriesData = await tk.mds.termdb.vocabApi.getNestedChartSeriesData(arg)
		//console.log('test barchart', chartSeriesData)
	}

	tk.mds
		.getSamples({ isSummary: true })
		.then(async data => {
			wait.html('')
			await showSummary4terms(data, wait, tk, block)
		})
		.catch(e => {
			wait.text(`Error: ${e.message || e}`)
			if (e.stack) console.log(e.stack)
		})
}

/* show summaries over a list of terms
data is array, each ele: {termid, termname, numbycategory}
*/
async function showSummary4terms(data, div, tk, block) {
	const tabs = []
	for (const { termid, termname, numbycategory, density_data } of data) {
		tabs.push({
			label:
				termname +
				(numbycategory
					? '<span style="color:#999;font-size:.8em;float:right;margin-left: 5px;">n=' +
					  numbycategory.length +
					  '</span>'
					: ''),
			callback: async function(div) {
				const features = JSON.parse(sessionStorage.getItem('optionalFeatures') || `{}`)
				if (!features.mds3barapp) {
					if (numbycategory) return showSummary4oneTerm(termid, div, numbycategory, tk, block)
					if (density_data) return showDensity4oneTerm(termid, div, density_data, tk, block)
					throw 'unknown summary data'
				}

				// will use the "barapp" when serverconfig.features.mds3barapp evaluates to true
				const holder = div.append('div')
				/*.style('display', 'inline-grid')
						.style('grid-template-columns', 'auto auto auto')
						.style('grid-row-gap', '3px')
						.style('align-items', 'center')
						.style('justify-items', 'left')*/

				const geneTerm = {
					type: 'geneVariant',
					isoform: block.usegm.isoform
				}
				rangequery_rglst(tk, block, geneTerm)

				try {
					const plot = await import('#plots/plot.app')
					await plot.appInit({
						holder,
						vocabApi: tk.mds.termdb.vocabApi,
						state: {
							plots: [
								{
									chartType: 'barchart',
									term: {
										id: termid
									},
									term2: {
										term: geneTerm,
										q: { mode: 'summary' }
									},
									settings: {
										barchart: {
											unit: 'pct'
										}
									}
								}
							]
						}
					})
				} catch (e) {
					throw e
				}
			}
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

		const percent_div = grid_div.append('div')
		if (total != undefined) {
			// show percent bar
			percent_div
				.on('mouseover', () => {
					cat_div.style('color', 'blue').style('text-decoration', 'underline')
				})
				.on('mouseout', () => {
					cat_div.style('color', '#000').style('text-decoration', 'none')
				})
				.on('click', () => listSamples(category_name))

			fillbar(percent_div, { f: count / total, v1: count, v2: total }, { fillbg: '#ECE5FF', fill: '#9F80FF' })
		}

		{
			const d = grid_div
				.append('div')
				.style('margin-left', '10px')
				.on('mouseover', () => {
					cat_div.style('color', 'blue').style('text-decoration', 'underline')
				})
				.on('mouseout', () => {
					cat_div.style('color', '#000').style('text-decoration', 'none')
				})
				.on('click', () => listSamples(category_name))
			d.append('span').text(count)
			if (total) {
				d.append('span')
					.text('/ ' + total)
					.style('margin-left', '5px')
					.style('font-size', '.8em')
			}
		}
	}

	async function listSamples(category) {
		// for a selected category, list the samples
		tk.menutip.clear()

		//////////////////////////////////////////////
		// temp change to launch subtrack
		//////////////////////////////////////////////
		const tkarg = {
			type: 'mds3',
			dslabel: tk.dslabel,
			filter0: tk.filter0,
			filterObj: {
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: await tk.mds.termdb.vocabApi.getterm(termid),
							// assuming categorical term
							values: [{ key: category }]
						}
					}
				]
			}
		}
		const tk2 = block.block_addtk_template(tkarg)
		block.tk_load(tk2)
		return

		const div = tk.menutip.d.append('div').style('margin', '2px')
		const wait = div.append('div').text('Loading...')
		const samples = await tk.mds.getSamples({ tid2value: { [termid]: category } })
		wait.remove()
		await displaySampleTable(samples, { div, tk, block })
	}
}

function showDensity4oneTerm(termid, div, density_data, tk, block) {
	make_densityplot(div, density_data, () => {})
}

function menu_samples(data, tk, block) {
	// subject to change

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
					block
				})
				wait.remove()
			} catch (e) {
				wait.text(e.message || e)
				console.log(e)
			}
		})
}
