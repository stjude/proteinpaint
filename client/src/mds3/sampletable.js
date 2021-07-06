import { select } from 'd3'
import * as common from '../../shared/common'
import { to_textfile, fillbar, tab2box } from '../client'

/*
********************** EXPORTED
init_sampletable
********************** INTERNAL
make_singleSampleTable
make_multiSampleTable
get_list_cells

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
	const holder = arg.div.append('div').attr('class', 'sj_multisample_holder')
	const err_check_div = arg.div
		.append('div')
		.style('color', '#bbb')
		.text('Loading...')

	const numofcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0) // sum of occurrence of mlst[]
	arg.tid2value_orig = Object.keys(arg.tid2value) //terms from sunburst ring
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
		err_check_div.remove()
	} catch (e) {
		err_check_div.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function make_singleSampleTable(arg, holder) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg)
	const sampledata = data[0] // must have just one sample

	const grid_div = holder
		.append('div')
		.style('margin', '20px')
		.style('font-size', '.9em')
		.style('display', 'grid')
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
		cell2.text(sampledata[termid])
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
			.text(sm.totalNormal)
			.style('margin-right', '10px')
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
	}
}

async function make_multiSampleTable(args) {
	const { arg, holder, size, from, total_size, filter_term } = args
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const occurrence = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	arg.numofcases = total_size || occurrence
	const default_size = 10
	let current_size = parseInt(size) || default_size
	const default_from = 0
	let current_from = parseInt(from) || default_from
	const pagination = arg.numofcases > 10
	if (pagination) {
		arg.size = current_size
		arg.from = current_from
	}
	holder.selectAll('*').style('opacity', 0.5)
	holder.append('div').text('Loading...')
	const data = await arg.tk.mds.variant2samples.get(arg)
	holder.selectAll('*').remove()

	// use booleen flags to determine table columns based on these samples
	const has_sampleid = data.some(i => i.sample_id) // sample_id is hardcoded
	const has_ssm_depth = data.some(i => i.ssm_read_depth)
	const col_count = arg.tk.mds.variant2samples.termidlst.length + has_sampleid + (has_ssm_depth ? 2 : 0)

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
			.html(`n= ${arg.numofcases} / ${occurrence} Samples`)
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
		grid_div
			.append('div')
			.style('font-size', '.8em')
			.style('opacity', 0.5)
			.text('SAMPLE')
	}
	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		grid_div
			.append('div')
			.style('opacity', 0.5)
			.style('font-size', '.8em')
			.text(term.name)
	}
	if (has_ssm_depth) {
		// to support other configs
		grid_div
			.append('div')
			.style('opacity', 0.5)
			.style('font-size', '.8em')
			.text('TUMOR DNA MAF')
		grid_div
			.append('div')
			.style('opacity', 0.5)
			.style('font-size', '.8em')
			.text('NORMAL DEPTH')
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
			const cell = get_table_cell(grid_div, i)
			cell.text(sample[termid])
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
				cell2.text(sm.totalNormal)
			}
		}
	}

	// pages and option to change samples per size (only for pagination)
	const page_footer = holder.append('div').style('display', 'none')
	if (pagination) make_pagination(arg, [page_header, page_footer, holder])
}

async function make_multiSampleSummaryList(arg, holder) {
	arg.querytype = arg.tk.mds.variant2samples.type_summary
	const data = await arg.tk.mds.variant2samples.get(arg)

	const summary_tabs = []
	for (const category of data) {
		summary_tabs.push({
			label: `${category.name} <span style='color:#999;font-size:.8em;float:right;margin-left: 5px;'>n=${category.numbycategory.length}</span>`,
			callback: div => make_summary_panel(arg, div, category, main_tabs)
		})
	}

	const main_tabs = [
		{ heading: 'Summary', callback: div => tab2box(div, summary_tabs) },
		{ heading: 'List', callback: div => make_multiSampleTable({ arg, holder: div }) }
	]

	make_horizontal_tabs(holder, main_tabs)
}

function get_list_cells(table) {
	return [
		table
			.append('div')
			.style('width', '100%')
			.style('padding', '5px 20px 5px 0px')
			.style('color', '#bbb')
			.style('border-bottom', 'solid 1px #ededed'),
		table
			.append('div')
			.style('width', '100%')
			.style('border-bottom', 'solid 1px #ededed')
			.style('padding', '5px 20px 5px 0px')
	]
}

function get_table_cell(table, row_id) {
	return table
		.append('div')
		.style('width', '95%')
		.style('height', '100%')
		.style('padding', '2px 5px')
		.style('background-color', row_id % 2 == 0 ? '#eee' : '#fff')
}

function make_horizontal_tabs(holder, tabs) {
	const tab_holder = holder
		.append('div')
		.style('padding', '10px 10px 0 10px')
		.style('border-bottom', 'solid 1px #aaa')

	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const [i, tab] of tabs.entries()) {
		tab.tab = tab_holder
			.append('div')
			.classed('sja_menuoption', !tab.active ? true : false)
			.style('padding', '7px 10px')
			.style('display', 'inline-block')
			.style('border-top', 'solid 1px #ddd')
			.style('border-left', i == 0 ? 'solid 1px #ddd' : '')
			.style('border-right', 'solid 1px #ddd')
			.text(tab.heading)
			.on('click', async () => {
				const last_active_tab = tabs.find(t => t.active == true)
				delete last_active_tab.active
				tab.active = true
				for (const tab_ of tabs) {
					tab_.tab.classed('sja_menuoption', !tab_.active ? true : false)
					tab_.holder.style('display', tab_.active ? 'block' : 'none')
				}
				if (tab.callback) {
					await tab.callback(tab.holder)
					delete tab.callback
				}
			})

		tab.holder = holder
			.append('div')
			.style('padding-top', '10px')
			.style('display', tab.active ? 'block' : 'none')

		if (i == 0 && tab.callback) {
			tab.callback(tab.holder)
			delete tab.callback
		}
	}
}

function update_horizontal_tabs(tabs) {
	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const tab of tabs) {
		tab.tab.classed('sja_menuoption', !tab.active ? true : false)
		tab.holder.style('display', tab.active ? 'block' : 'none')
	}
}

function make_summary_panel(arg, div, category, main_tabs) {
	// occurance info at top of summary
	const occurrence = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	div
		.append('div')
		.style('display', 'block')
		.style('padding', '5px 20px')
		.style('font-size', '.9em')
		.style('color', '#999')
		.html(`${occurrence}<span style='padding-left:10px;'>samples</span>`)

	// summary for active tab
	if (category.numbycategory) {
		const grid_div = div
			.append('div')
			.style('margin', '20px')
			.style('font-size', '.9em')
			.style('display', 'grid')
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
				.on('click', () => makeFilteredList(category_name, count))
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
				.on('click', () => makeFilteredList(category_name, count))
		}

		function makeFilteredList(cat, count) {
			if (arg.tid2value == undefined) arg.tid2value = {}
			else if (arg.filter_term) {
				delete arg.tid2value[arg.filter_term]
				delete arg.filter_term
			}
			arg.tid2value[category.name.toLowerCase()] = cat
			delete main_tabs[0].active
			main_tabs[1].active = true
			update_horizontal_tabs(main_tabs)
			make_multiSampleTable({
				arg,
				holder: main_tabs[1].holder,
				total_size: count,
				filter_term: category.name.toLowerCase()
			})
		}
	}
}

function make_filter_pill(arg, filter_holder, page_holder) {
	console.log(arg)
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
		.html(arg.tid2value[arg.filter_term])

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
			const orig_terms_flag = arg.tid2value_orig.filter(t => t == arg.filter_term).length
			// don't remove original terms from tid2value (terms from sunburst ring)
			if (!orig_terms_flag) {
				if (Object.keys(arg.tid2value).length == 1) delete arg.tid2value
				else delete arg.tid2value[arg.filter_term]
			}
			// delete from arg as well
			delete arg.filter_term
			make_multiSampleTable({ arg, holder: page_holder, size: arg.size, from: arg.from })
		})
}

function make_pagination(arg, page_doms) {
	const [page_header, page_footer, list_holder] = page_doms
	// sample info for pagination
	const pages = Math.ceil(arg.numofcases / arg.size)
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
				total_size: arg.numofcases,
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
	const page_start = current_page < 10 ? 1 : current_page - 5
	const page_truncation = pages > 10 ? true : false
	const page_end = page_truncation && page_start == 1 ? 10 : page_start + 10 < pages ? page_start + 10 : pages

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
	if (page_truncation && page_end < pages) {
		pages_div
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.text('....')
		render_page_button('Last page', pages)
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
						total_size: arg.numofcases,
						filter_term: arg.filter_term
					})
				}
			})
	}
}
