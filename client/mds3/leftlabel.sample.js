import { makelabel } from './leftlabel'
import { Tabs, fillbar, renderTable, violinRenderer } from '#dom'
import { displaySampleTable } from './sampletable'
import { filterInit, getNormalRoot } from '../filter/filter'
import { getFilterName } from './filterName'

/*
makeSampleLabel()
	makes the "# samples" sub label on the left.
	click label to view summaries about samples that have mutation data in the view range

makeSampleFilterLabel()
createSubTk()
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
			.attr('data-testid', 'sjpp_mds3tk_samples_label')
			.on('click', async event => {
				tk.menutip.clear().showunder(event.target)

				await mayShowSummary(tk, block)

				const buttonrow = tk.menutip.d.append('div').style('margin', '10px')

				menu_listSamples(buttonrow, data, tk, block)
				// TODO new button "Customize variables", launch tree in submit_lst mode to update tk.mds.variant2samples.twLst
			})
	} else {
		// current data has no sample, disable label
		tk.leftlabels.doms.samples.text('No samples').attr('class', '').style('opacity', 0.5).on('click', null)
	}
}

export function makeSampleFilterLabel(data, tk, block, laby) {
	// track has a modifiable sample filter. add a new label to access the filter UI
	if (!tk.leftlabels.doms.filterObj) {
		tk.leftlabels.doms.filterObj = makelabel(tk, block, laby)
	}

	tk.leftlabels.doms.filterObj.text(getFilterName(tk.filterObj)).on('click', async event => {
		tk.menutip.clear().showunder(event.target)

		// display filter UI

		const arg = {
			holder: tk.menutip.d.append('div').style('margin', '10px'),
			vocabApi: tk.mds.termdb.vocabApi,
			callback: f => {
				tk.filterObj = f
				tk.load()
			}
		}
		mayAddGetCategoryArgs(arg, block)
		filterInit(arg).main(tk.filterObj)
	})
}

function mayAddGetCategoryArgs(arg, block) {
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
		arg.getCategoriesArguments = { currentGeneNames: [block.usegm.name] }
		// TODO {name: block.usegm.name, isoform, q:{allowedDt}}
	} else {
		/////////////////////////////////////
		//
		// GDC specific logic
		// in genomic mode, pass rglst for pulling cases mutated in this region, handled in the same way as currentGeneNames
		//
		/////////////////////////////////////
		arg.getCategoriesArguments = { rglst: structuredClone(block.rglst) }
	}
}

async function mayShowSummary(tk, block) {
	if (!tk.mds.variant2samples.twLst) {
		// no terms to summarize for
		return
	}

	const div = tk.menutip.d.append('div').style('margin', '10px')

	const wait = div.append('div').text('Loading...')

	try {
		const { summary } = await tk.mds.getSamples({ isSummary: true })
		tk.leftlabels.__samples_data = summary // for testing
		wait.remove()
		await showSummary4terms(summary, div.append('div').attr('class', 'sja_mds3samplesummarydiv'), tk, block)
	} catch (e) {
		wait.text(`Error: ${e.message || e}`)
		if (e.stack) console.log(e.stack)
	}
}

/* show summaries over a list of terms
data is array, each ele: {termid, numbycategory}
*/
async function showSummary4terms(data, div, tk, block) {
	const tabs = []
	for (const { termid, numbycategory } of data) {
		tabs.push({
			label:
				tk.mds.variant2samples.twLst.find(i => i.term.id == termid).term.name +
				(numbycategory
					? `<span style="font-size:.8em;float:right;margin-left: 5px;">n=${numbycategory.length}</span>`
					: ''),
			keydownCallback: function (event) {
				setTimeout(() => {
					const tr = this.contentHolder.select('tbody').select('tr').node()
					if (!tr) return
					// to support keyboard navigation, automatically highlight the first table row
					// after this tab/button is clicked, use setTimeout() to ensure the table has
					// finished rendering
					//
					// TODO: support violin plot range selection, which does not use table rows,
					//       should use start-stop input there
					//
					tr.focus()
				}, 100)
			}
		})
	}

	new Tabs({
		holder: div,
		tabsPosition: 'vertical',
		linePosition: 'right',
		tabs
	}).main()

	for (const [i, d] of data.entries()) {
		const holder = tabs[i].contentHolder.style('padding-left', '20px')
		if (d.numbycategory) {
			holder
				.append('div')
				.text('Click a category to create new track.')
				.style('margin-bottom', '10px')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			showSummary4oneTerm(d.termid, holder, d.numbycategory, tk, block)
			continue
		}
		if (d.density_data) {
			if (!Number.isFinite(d.density_data.minvalue) || !Number.isFinite(d.density_data.maxvalue)) {
				holder.append('div').text('No data')
				continue
			}

			holder
				.append('div')
				.text('Select a range to create new track.')
				.style('margin-bottom', '10px')
				.style('font-size', '.8em')
				.style('opacity', 0.5)
			showDensity4oneTerm(d.termid, holder, d, tk, block)
			continue
		}
		throw 'unknown summary data'
	}
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
	const tw = tk.mds.variant2samples.twLst.find(i => i.term.id == termid)
	if (!tw) throw 'showSummary4oneTerm(): tw not found from variant2samples.twLst'

	const rows = []
	for (const [category_key, count, total] of numbycategory) {
		// in future tw may be in groupsetting mode
		const row = [
			{ value: tw.term.values?.[category_key]?.label || category_key },
			{ html: total == undefined ? '' : fillbar(null, { f: count / total, v1: count, v2: total }) },
			{ html: count + (total ? ' <span style="font-size:.8em">/ ' + total + '</span>' : '') }
		]
		rows.push(row)
	}
	renderTable({
		div,
		rows,
		columns: [
			{
				nowrap: true // to force all category values to show in one line without wrap. otherwise they wrap and column width appears fixed
			},
			{},
			{}
		],
		showHeader: false,
		singleMode: true,
		noRadioBtn: true,
		noButtonCallback: i => {
			clickCategory(numbycategory[i][0])
		}
	})

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

		const tvs = {
			type: 'tvs',
			tvs: { term, values: [{ key: category }] }
		}
		createSubTk(tk, block, tvs)
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
async function showDensity4oneTerm(termid, div, data, tk, block) {
	const term = await tk.mds.termdb.vocabApi.getterm(termid)
	const callback = async range => {
		// a range is selected
		tk.menutip.clear()
		const tvs = {
			type: 'tvs',
			tvs: { term, ranges: [{ start: range.range_start, stop: range.range_end }] }
		}
		createSubTk(tk, block, tvs)
	}
	const scaleFactor = term.valueConversion ? term.valueConversion.scaleFactor : 1
	const vr = new violinRenderer(div, data.density_data, 400, 100, 10, 20, callback, scaleFactor)
	vr.render()
}

function createSubTk(tk, block, tvs) {
	// pass properties from main tk to subtk
	const tkarg = {
		type: 'mds3',
		dslabel: tk.dslabel,
		filter0: tk.filter0,
		showCloseLeftlabel: true,
		filterObj: getNewFilter(tk, tvs),
		allow2selectSamples: tk.allow2selectSamples,
		onClose: tk.onClose,
		hardcodeCnvOnly: tk.hardcodeCnvOnly,
		token: tk.token // for testing
	}
	if (tk.cnv?.presetMax) tkarg.cnv = { presetMax: tk.cnv.presetMax } // preset value is present, pass to subtk
	if (tk.legend.mclass?.hiddenvalues?.size) {
		tkarg.legend = { mclass: { hiddenvalues: new Set() } }
		for (const v of tk.legend.mclass.hiddenvalues) tkarg.legend.mclass.hiddenvalues.add(v)
	}
	const tk2 = block.block_addtk_template(tkarg)
	block.tk_load(tk2)
}

function menu_listSamples(buttonrow, data, tk, block) {
	// subject to change

	buttonrow
		.append('div')
		.text(`List ${data.sampleTotalNumber} sample${data.sampleTotalNumber > 1 ? 's' : ''}`)
		.attr('class', 'sja_menuoption sja_mds3_slb_sampletablebtn')
		.on('click', async () => {
			tk.menutip.clear()
			const wait = tk.menutip.d.append('div').text('Loading...').style('margin', '15px')
			try {
				const { samples } = await tk.mds.getSamples()
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
