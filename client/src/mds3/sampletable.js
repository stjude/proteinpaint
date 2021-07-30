import { fillbar, tab2box, Menu } from '../client'
import { make_densityplot } from '../common/dom/densityplot'
import { init_tabs, update_tabs } from '../common/dom/toggleButtons'
import { get_list_cells, get_table_header, get_table_cell } from '../common/dom/gridutils'

/*
********************** EXPORTED
init_sampletable
********************** INTERNAL
make_singleSampleTable
make_multiSampleTable
make_multiSampleSummaryList
make_summary_panel
make_sunburst_tidlist
make_filter_pill
make_pagination

using variant2samples
mlst can be mixture of data types, doesn't matter
if the total occurrence is 1, will print details for that sample
otherwise, will print summaries for each sample attribute from all samples
arg{}
.mlst[]
	.occurrence // important parameter to determine the display mode
.tk
	.mds.variant2samples.termidlst
.block
.div
.tid2value
 	sample filters by e.g. clicking on a sunburst ring, for tk.mds.variant2samples.get
*/

const cutoff_tableview = 10

export async function init_sampletable(arg) {
	const holder = arg.div.append('div').attr('class', 'sj_sampletable_holder')
	arg.temp_div = arg.div.append('div').text('Loading...')

	const numofcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0) // sum of occurrence of mlst[]
	//terms from sunburst ring
	// Note: in ordered to keep term-values related to sunburst immuatable, these term names are
	// stored as 'tid2value_orig' and not removed from tid2Value when filter changed or removed
	arg.tid2value_orig = new Set()
	if (arg.tid2value) Object.keys(arg.tid2value).forEach(arg.tid2value_orig.add, arg.tid2value_orig)
	try {
		if (numofcases == 1) {
			// one sample
			await make_singleSampleTable(arg, holder)
		} else if (numofcases < cutoff_tableview) {
			// few cases
			await make_multiSampleTable({ arg, holder })
		} else {
			// more cases, show summary
			await make_multiSampleSummaryList(arg, holder)
		}
		arg.temp_div.style('display', 'none')
	} catch (e) {
		arg.temp_div.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function make_singleSampleTable(arg, holder) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg) // data is [samples, total]
	const sampledata = data[0][0] // must have just one sample
	arg.temp_div.style('display', 'block').text('Loading...')

	const grid_div = holder
		.append('div')
		.style('display', 'inline-grid')
		.style('grid-template-columns', 'auto auto')
		.style('gap-row-gap', '1px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	if (sampledata.sample_id) {
		// sample_id is hardcoded
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Sample')
		if (arg.tk.mds.variant2samples.url) {
			const a = cell2.append('a')
			a.attr(
				'href',
				arg.tk.mds.variant2samples.url.base +
					(arg.tk.mds.variant2samples.url.namekey
						? sampledata[arg.tk.mds.variant2samples.url.namekey]
						: sampledata.sample_id)
			)
			a.attr('target', '_blank')
			a.text(sampledata.sample_id)
		} else {
			cell2.text(sampledata.sample_id)
		}
	}

	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		if (!term) throw 'unknown term id: ' + termid
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text(term.name)
		cell2.text(sampledata[termid] || 'N/A')
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations
	if (sampledata.ssm_read_depth) {
		// to support other configurations of ssm read depth
		const sm = sampledata.ssm_read_depth
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.style('height', '35px').text('DNA read depth')
		cell2.style('height', '35px')
		fillbar(cell2, { f: sm.altTumor / sm.totalTumor })
		cell2
			.append('span')
			.text(sm.altTumor + ' / ' + sm.totalTumor)
			.style('margin', '0px 10px')
		cell2
			.append('span')
			.text('ALT / TOTAL IN TUMOR')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
		const d = cell2.append('div') // next row to show normal total
		d.append('span')
			.text(sm.totalNormal || 'N/A')
			.style('margin-right', '10px')
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
	}
	arg.temp_div.style('display', 'none')
}

async function make_multiSampleTable(args) {
	const { arg, holder, size, from, filter_term, update } = args
	if (update) arg.querytype = arg.tk.mds.variant2samples.type_update_samples
	else arg.querytype = arg.tk.mds.variant2samples.type_samples
	arg.totalcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	const default_size = 10
	let current_size = parseInt(size) || default_size
	const default_from = 0
	let current_from = parseInt(from) || default_from
	const pagination = arg.totalcases > cutoff_tableview
	if (pagination) {
		arg.size = current_size
		arg.from = current_from
	}
	holder.selectAll('*').style('opacity', 0.5)
	arg.temp_div.style('display', 'block').text('Loading...')
	const [data, numofcases] = await arg.tk.mds.variant2samples.get(arg)
	arg.numofcases = numofcases
	holder.selectAll('*').remove()
	// for tid2values coming from sunburst ring, create list at top of summary & list tabs
	if (arg.tid2value_orig.size) make_sunburst_tidlist(arg, holder)

	// use booleen flags to determine table columns based on these samples
	const has_sampleid = data.some(i => i.sample_id) // sample_id is hardcoded
	const has_ssm_depth = data.some(i => i.ssm_read_depth)
	const col_count =
		arg.tk.mds.variant2samples.termidlst.length + has_sampleid + (has_ssm_depth ? 2 : 0) - arg.tid2value_orig.size

	// show filter pill
	if (filter_term != undefined) {
		arg.filter_term = filter_term
		const filter_div = holder
			.append('div')
			.style('font-size', '.9em')
			.style('padding', '5px 10px')

		make_filter_pill(arg, filter_div, holder)

		// show sample size
		filter_div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px 10px')
			.style('color', '#bbb')
			.html(`n= ${arg.numofcases} / ${arg.totalcases} Samples`)
	}

	// top text to display sample per page and total sample size (only for pagination)
	const page_header = holder.append('div').style('display', 'none')

	const grid_div = holder
		.append('div')
		.style('margin', '10px')
		.style('font-size', '.9em')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(' + col_count + ', auto)')
		.style('grid-template-rows', 'repeat(' + data.length + ', auto)')
		.style('grid-row-gap', '5px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	if (has_sampleid) {
		get_table_header(grid_div, 'SAMPLE')
	}
	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		if (arg.tid2value_orig.has(term.name.toLowerCase())) continue
		get_table_header(grid_div, term.name)
	}
	if (has_ssm_depth) {
		// to support other configs
		get_table_header(grid_div, 'TUMOR DNA MAF')
		get_table_header(grid_div, 'NORMAL DEPTH')
	}

	// one row per sample
	for (const [i, sample] of data.entries()) {
		if (has_sampleid) {
			const cell = get_table_cell(grid_div, i)
			if (sample.sample_id) {
				if (arg.tk.mds.variant2samples.url) {
					const a = cell.append('a')
					a.attr(
						'href',
						arg.tk.mds.variant2samples.url.base +
							(arg.tk.mds.variant2samples.url.namekey
								? sample[arg.tk.mds.variant2samples.url.namekey]
								: sample.sample_id)
					)
					a.attr('target', '_blank')
					a.text(sample.sample_id)
				} else {
					cell.text(sample.sample_id)
				}
			}
		}
		for (const termid of arg.tk.mds.variant2samples.termidlst) {
			if (arg.tid2value_orig.has(termid.toLowerCase())) continue
			const cell = get_table_cell(grid_div, i)
			cell.text(sample[termid] || 'N/A')
		}
		if (has_ssm_depth) {
			const cell1 = get_table_cell(grid_div, i) // tumor
			const cell2 = get_table_cell(grid_div, i) // normal

			const sm = sample.ssm_read_depth
			if (sm) {
				fillbar(cell1, { f: sm.altTumor / sm.totalTumor })
				cell1
					.style('width', '140px')
					.append('span')
					.text(sm.altTumor + ' / ' + sm.totalTumor)
					.style('margin', '0px 10px')
				cell2.text(sm.totalNormal || 'N/A')
			}
		}
	}

	// pages and option to change samples per size (only for pagination)
	const page_footer = holder.append('div').style('display', 'none')
	if (pagination) make_pagination(arg, [page_header, page_footer, holder])
	arg.temp_div.style('display', 'none')
}

async function make_multiSampleSummaryList(arg, holder, update) {
	if (update) {
		arg.querytype = arg.tk.mds.variant2samples.type_update_summary
		// remove size to get all samples if switching between list and summary view
		delete arg.size
	} else arg.querytype = arg.tk.mds.variant2samples.type_summary
	arg.temp_div.style('display', 'block').text('Loading...')
	const data = await arg.tk.mds.variant2samples.get(arg)
	holder.selectAll('*').remove()

	// for tid2values coming from sunburst ring, create list at top of summary & list tabs
	if (arg.tid2value_orig.size) {
		make_sunburst_tidlist(arg, holder)
	}

	const summary_tabs = []
	for (const category of data) {
		// if tid2values are coming from sunburst ring, don't create summary tab for those terms
		if (arg.tid2value_orig.has(category.name.toLowerCase())) continue
		// if for numeric_term if samplecont is 0,
		// means no sample have value for that term, skip that term in summary
		if (category.density_data && !category.density_data.samplecount) continue
		summary_tabs.push({
			label: `${category.name} ${
				category.numbycategory
					? `<span style='color:#999;font-size:.8em;float:right;margin-left: 5px;'>n=${category.numbycategory.length}</span>`
					: ``
			}`,
			callback: div => make_summary_panel(arg, div, category, main_tabs)
		})
	}

	// TODO: check if # occurance should be displayed in summary tab
	// const occurrence = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	// const summary_label = `Summary <span style='background:#a6a6a6;color:white;font-size:.8em;float:right;margin:2px 5px;padding: 0px 6px; border-radius: 6px;'>${occurrence}</span>`
	const main_tabs = [
		{ label: 'Summary', callback: div => tab2box(div, summary_tabs) },
		{ label: 'List', callback: div => make_multiSampleTable({ arg, holder: div, filter_term: arg.filter_term }) }
	]

	init_tabs(holder, main_tabs)
	init_dictionary_ui(main_tabs, holder, arg)
	arg.temp_div.style('display', 'none')
}

function init_dictionary_ui(main_tabs, summary_holder, arg) {
	const holder = main_tabs.holder
	const term_btn = holder
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_filter_tag_btn')
		.style('margin-left', '20px')
		.style('border-radius', '6px')
		.style('padding', '6px 10px')
		.style('cursor', 'pointer')
		.text('+ Add fields')
		.on('click', async () => {
			const active_tab = main_tabs.find(t => t.active)
			const tip = new Menu({ padding: '5px', parent_menu: term_btn })
			const termdb = await import('../termdb/app')
			tip.clear().showunder(term_btn.node())
			termdb.appInit(null, {
				holder: tip.d,
				state: {
					dslabel: arg.tk.dslabel,
					genome: arg.block.genome.name,
					nav: {
						header_mode: 'search_only'
					},
					tree: {
						expandedTermIds: ['case']
					}
				},
				tree: {
					click_term: term => {
						tip.hide()
						if (arg.tk.mds.termdb.getTermById(term.id) == undefined) {
							// new query type of 'update_summary' with new term
							arg.tk.mds.variant2samples.new_term = term.id
							arg.tk.mds.variant2samples.termidlst.push(term.id)
							arg.tk.mds.termdb.terms.push(term)
							if (active_tab.label == 'Summary') make_multiSampleSummaryList(arg, summary_holder, true)
							if (active_tab.label == 'List') make_multiSampleTable({ arg, holder: active_tab.holder, update: true })
							delete arg.tk.mds.variant2samples.new_term
						}
					},
					disable_terms: arg.tk.mds.variant2samples.termidlst
				}
			})
		})
}

async function make_summary_panel(arg, div, category, main_tabs) {
	// summary for active tab
	if (category.numbycategory) {
		const grid_div = div
			.append('div')
			.style('margin', '20px')
			.style('font-size', '.9em')
			.style('display', 'inline-grid')
			.style('grid-template-columns', 'auto auto')
			.style('grid-row-gap', '3px')
			.style('align-items', 'center')
			.style('justify-items', 'left')

		for (const [category_name, count] of category.numbycategory) {
			grid_div
				.append('div')
				.html(`<a>${count}</a>`)
				.style('text-align', 'right')
				.style('padding-right', '10px')
				.on('mouseover', () => {
					cat_div.style('color', 'blue').style('text-decoration', 'underline')
				})
				.on('mouseout', () => {
					cat_div.style('color', '#000').style('text-decoration', 'none')
				})
				.on('click', () => makeFilteredList(category_name))
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
				.on('click', () => makeFilteredList(category_name))
		}

		function makeFilteredList(cat) {
			if (arg.tid2value == undefined) arg.tid2value = {}
			else if (arg.filter_term) {
				delete arg.tid2value[arg.filter_term]
				delete arg.filter_term
			}
			arg.tid2value[category.name] = cat
			delete main_tabs[0].active
			main_tabs[1].active = true
			update_tabs(main_tabs)
			make_multiSampleTable({
				arg,
				holder: main_tabs[1].holder,
				filter_term: category.name
			})
		}
	} else if (category.density_data) {
		const callback = range => {
			if (!range.range_start && !range.range_end) return
			else {
				if (arg.tid2value == undefined) arg.tid2value = {}
				else if (arg.filter_term) {
					delete arg.tid2value[arg.filter_term]
					delete arg.filter_term
				}
				arg.tid2value[category.name] = [
					{ op: '>=', range: Math.round(range.range_start) },
					{ op: '<=', range: Math.round(range.range_end) }
				]
				delete main_tabs[0].active
				main_tabs[1].active = true
				update_tabs(main_tabs)
				make_multiSampleTable({
					arg,
					holder: main_tabs[1].holder,
					filter_term: category.name
				})
			}
		}
		make_densityplot(div, category.density_data, callback)
	}
}

function make_sunburst_tidlist(arg, holder) {
	const grid_div = holder
		.append('div')
		.style('display', 'inline-grid')
		.style('grid-template-columns', '100px auto')
		.style('gap-row-gap', '1px')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('justrify-content', 'start')

	for (const termid of arg.tid2value_orig) {
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text(termid)
		cell2
			.style('width', 'auto')
			.style('justify-self', 'stretch')
			.text(arg.tid2value[termid])
	}
}

function make_filter_pill(arg, filter_holder, page_holder) {
	if (arg.tid2value[arg.filter_term] == undefined) return
	// term
	filter_holder
		.append('div')
		.attr('class', 'term_name_btn sja_filter_tag_btn')
		.style('display', 'inline-block')
		.style('border-radius', '6px 0 0 6px')
		.style('padding', '6px 6px 3px 6px')
		.style('text-transform', 'capitalize')
		.style('cursor', 'default')
		.html(arg.filter_term)

	// is button
	filter_holder
		.append('div')
		.attr('class', 'negate_btn')
		.style('cursor', 'default')
		.style('display', 'inline-block')
		.style('padding', '6px 6px 3px 6px')
		.style('background', '#a2c4c9')
		.html('IS')

	// value
	filter_holder
		.append('div')
		.attr('class', 'value_btn sja_filter_tag_btn')
		.style('display', 'inline-block')
		.style('padding', '6px 6px 3px 6px')
		.style('font-style', 'italic')
		.style('cursor', 'default')
		.html(get_value(arg.tid2value[arg.filter_term]))

	// remove button
	filter_holder
		.append('div')
		.attr('class', 'value_btn sja_filter_tag_btn')
		.style('display', 'inline-block')
		.style('padding', '6px 6px 3px 6px')
		.style('margin-left', '1px')
		.style('border-radius', '0 6px 6px 0')
		.style('cursor', 'pointer')
		.html('x')
		.on('click', () => {
			// don't remove original terms from tid2value (terms from sunburst ring)
			if (!arg.tid2value_orig.has(arg.filter_term)) {
				if (Object.keys(arg.tid2value).length == 1) delete arg.tid2value
				else delete arg.tid2value[arg.filter_term]
			}
			// delete from arg as well
			delete arg.filter_term
			make_multiSampleTable({ arg, holder: page_holder, size: arg.size, from: arg.from })
		})

	function get_value(values) {
		if (typeof values == 'string') return values
		else {
			const vals = values.map(a => a.range)
			const num_value = Math.min(...vals) + ' <= x <= ' + Math.max(...vals)
			return num_value
		}
	}
}

function make_pagination(arg, page_doms) {
	const [page_header, page_footer, list_holder] = page_doms
	// sample info for pagination
	const no_trunc_limit = 10 // max page without truncating page buttons
	const max_page_buttons = 10 // max pages buttons to be rendered
	const total_pages = Math.ceil(arg.numofcases / arg.size)
	const count_start = arg.from + 1
	const count_end = arg.from + arg.size < arg.numofcases ? arg.from + arg.size : arg.numofcases

	page_header
		.style('display', 'block')
		.style('padding', '5px 10px')
		.style('font-size', '.9em')
		.style('color', '#999')
		.html(`<p> Showing <b>${count_start} - ${count_end} </b> of <b>${arg.numofcases}</b> Samples`)

	page_footer.style('display', 'flex').style('justify-content', 'space-between')

	const entries_div = page_footer
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '20px 15px 15px 15px')
		.style('color', '#999')
		.style('font-size', '.9em')
	entries_div
		.append('span')
		.style('padding-right', '10px')
		.text('Showing')

	const entries_options = ['10', '20', '50', '100']
	const entries_select = entries_div
		.append('select')
		.style('border', 'solid 1px #ddd')
		.attr('title', 'Enteries per page')
		.on('change', () => {
			const new_size = entries_select.property('value')
			make_multiSampleTable({
				arg,
				holder: list_holder,
				size: new_size,
				filter_term: arg.filter_term
			})
		})

	for (const ent of entries_options) {
		entries_select
			.append('option')
			.text(ent)
			.property('value', ent)
			.property('selected', arg.size == ent)
	}

	entries_div
		.append('span')
		.style('padding-left', '10px')
		.text('entries')

	const pages_div = page_footer
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '15px')
		.style('font-size', '.9em')
		.style('text-align', 'end')
	const current_page = arg.from == 0 ? 1 : Math.ceil(arg.from / arg.size) + 1
	const page_start = current_page < no_trunc_limit ? 1 : current_page - 5 // for large pagination, show current_page and 5 pages before current_page
	const page_truncation = total_pages > no_trunc_limit ? true : false
	const page_end =
		page_truncation && page_start == 1
			? max_page_buttons // if truncation and current_page is 1st page, show pages 1 to 10
			: page_start + max_page_buttons < total_pages
			? page_start + max_page_buttons // if truncation and current_page is not 1 show 10 pages including current_page
			: total_pages // if no trucation or current_page is less than 10 pages from end, show last few pages

	// first page button, only visible when large sample size and first page button not displayed
	if (page_truncation && page_start != 1) {
		render_page_button('First page', 0)
		pages_div
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.text('....')
	}

	for (let i = page_start; i <= page_end; i++) {
		render_page_button(i, i)
	}

	// last page button, only visible when large sample size and last page button not displayed
	if (page_truncation && page_end < total_pages) {
		pages_div
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.text('....')
		render_page_button('Last page', total_pages)
	}

	function render_page_button(text, page_i) {
		pages_div
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.classed('sja_menuoption', page_i != current_page ? true : false)
			.style('border', 'solid 1px #ddd')
			.html(text)
			.on('click', () => {
				if (page_i == current_page) return
				else {
					const new_from = page_i == 0 ? 0 : (page_i - 1) * arg.size
					make_multiSampleTable({
						arg,
						holder: list_holder,
						size: arg.size,
						from: new_from,
						filter_term: arg.filter_term
					})
				}
			})
	}
}
