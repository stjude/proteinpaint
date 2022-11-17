import { makelabel } from './leftlabel'
import { tab2box } from '../src/client'
import { displaySampleTable } from './sampletable'
import { fillbar } from '#dom/fillbar'
import { make_densityplot } from '#dom/densityplot'
import { rangequery_rglst } from './tk'
import { filterInit, getNormalRoot } from '#filter'

/*
makes the "# samples" sub label on the left.
click label to view summaries about samples that have mutation data in the view range


*/

export function makeSampleLabel(data, tk, block, laby) {
	if (!tk.leftlabels.doms.samples) {
		// "Samples" label is missing. create
		tk.leftlabels.doms.samples = makelabel(tk, block, laby)
	}

	if (data.sampleTotalNumber) {
		// current data has samples, activate label
		tk.leftlabels.doms.samples
			.attr('class', 'sja_clbtext2')
			.style('opacity', 1)
			.text(`${data.sampleTotalNumber} sample${data.sampleTotalNumber > 1 ? 's' : ''}`)
			.on('click', async event => {
				tk.menutip.clear().showunder(event.target)

				await mayShowSummary(tk, block)

				const buttonrow = tk.menutip.d.append('div').style('margin', '10px')

				menu_listSamples(buttonrow, data, tk, block)
				// TODO new button "Customize variables", launch tree in submit_lst mode to update tk.mds.variant2samples.twLst
			})
	} else {
		// current data has no sample, disable label
		tk.leftlabels.doms.samples
			.text('No samples')
			.attr('class', '')
			.style('opacity', 0.5)
			.on('click', null)
	}
}

export function makeSampleFilterLabel(data, tk, block, laby) {
	// track has a modifiable sample filter. add a new label to access the filter UI
	if (!tk.leftlabels.doms.filterObj) {
		tk.leftlabels.doms.filterObj = makelabel(tk, block, laby)
	}

	tk.leftlabels.doms.filterObj.text('Filter').on('click', async event => {
		tk.menutip.clear().showunder(event.target)

		// display filter UI

		const arg = {
			holder: tk.menutip.d.append('div').style('margin', '10px'),
			vocab: tk.mds.termdb.vocabApi.state.vocab,
			callback: f => {
				tk.filterObj = f
				tk.uninitialized = true
				tk.load()
			}
		}
		if (block.usegm) {
			/////////////////////////////////////
			//
			// GDC specific logic
			// in gene mode, supply the current gene name as a new parameter
			// for the vocabApi getCategories() query, so it can pull the number of mutated samples for a term
			// this parameter is used by some sneaky gdc-specific logic in termdb.matrix.js getData()
			// should not impact non-gdc datasets
			//
			/////////////////////////////////////
			arg.getCategoriesArguments = ['currentGeneNames=["' + block.usegm.name + '"]']
		}
		filterInit(arg).main(tk.filterObj)
	})
}

async function mayShowSummary(tk, block) {
	if (!tk.mds.variant2samples.twLst) {
		// no terms to summarize for
		return
	}

	const wait = tk.menutip.d
		.append('div')
		.text('Loading...')
		.style('margin', '10px')

	tk.mds
		.getSamples({ isSummary: true })
		.then(async data => {
			wait
				.text('')
				.append('div')
				.style('margin', '10px')
				.style('font-size', '.8em')
				.text('Click a category to create a new track.')
			await showSummary4terms(data, wait.append('div'), tk, block)
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
				if (numbycategory) return showSummary4oneTerm(termid, div, numbycategory, tk, block)
				if (density_data) return showDensity4oneTerm(termid, div, density_data, tk, block)
				throw 'unknown summary data'
			}
		})
	}
	tab2box(div, tabs)
}

/*
show categories and #case for one term
click a category to launch subtrack
numbycategory = []
	each element is array of length 3 representing one category, from a categorical term
	[0] = category name
	[1] = number of cases mutated in current gene
	[2] = total number of cases from this category
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
			.attr('class', 'sja_clbtext2')
			.text(category_name)
			.on('click', () => clickCategory(category_name))

		const percent_div = grid_div.append('div')
		if (total != undefined) {
			// show percent bar
			percent_div.on('click', () => clickCategory(category_name))

			fillbar(percent_div, { f: count / total, v1: count, v2: total }, { fillbg: '#ECE5FF', fill: '#9F80FF' })
		}

		grid_div
			.append('div')
			.style('margin-left', '10px')
			.attr('class', 'sja_clbtext2')
			.on('click', () => clickCategory(category_name))
			.html(count + (total ? ' <span style="font-size:.8em">/ ' + total + '</span>' : ''))
	}

	async function clickCategory(category) {
		// for a selected category, launch subtrack
		tk.menutip.clear()

		const term = await tk.mds.termdb.vocabApi.getterm(termid)

		if (!term.values || Object.keys(term.values).length == 0) {
			/////////////////////////////////////
			//
			// GDC specific logic:
			// a gdc term will have blank .values{}, fill in term.values{} so filter/tvs won't break
			//
			/////////////////////////////////////
			term.values = {}
			for (const c of numbycategory) {
				term.values[c[0]] = { label: c[0], samplecount: c[1] }
			}
		}

		const newTvs = {
			type: 'tvs',
			tvs: { term, values: [{ key: category }] }
		}

		const tkarg = {
			type: 'mds3',
			dslabel: tk.dslabel,
			filter0: tk.filter0,
			showCloseLeftlabel: true,
			filterObj: getNewFilter(tk, newTvs)
		}
		const tk2 = block.block_addtk_template(tkarg)
		block.tk_load(tk2)
	}
}

function getNewFilter(tk, tvs) {
	if (tk.filterObj) {
		// merge new tvs to current filter
		return getNormalRoot({
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [tk.filterObj, tvs]
		})
	}
	// create new filter
	return {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [tvs]
	}
}

// will be nice if the data computing and rendering can both be replaced by violin
function showDensity4oneTerm(termid, div, density_data, tk, block) {
	make_densityplot(div, density_data, async range => {
		// a range is selected
		tk.menutip.clear()
		const term = await tk.mds.termdb.vocabApi.getterm(termid)
		const tvs = {
			type: 'tvs',
			tvs: { term, ranges: [{ start: range.range_start, stop: range.range_end }] }
		}
		const tkarg = {
			type: 'mds3',
			dslabel: tk.dslabel,
			filter0: tk.filter0,
			showCloseLeftlabel: true,
			filterObj: getNewFilter(tk, tvs)
		}
		const tk2 = block.block_addtk_template(tkarg)
		block.tk_load(tk2)
	})
}

function menu_listSamples(buttonrow, data, tk, block) {
	// subject to change

	buttonrow
		.append('div')
		.text(`List ${data.sampleTotalNumber} sample${data.sampleTotalNumber > 1 ? 's' : ''}`)
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

async function unusedCode() {
	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') || `{}`)
	if (!features.mds3barapp) {
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
			vocab: tk.mds.termdb.vocabApi.state.vocab,
			state: {
				plots: [
					{
						chartType: 'summary',
						childType: 'barchart',
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
