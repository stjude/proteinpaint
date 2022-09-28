/* multiple variants, each with occurrence
one row for each variant
click a button from a row to show the sample summary/detail table for that variant
show a summary table across samples of all variants
*/
function table_snvindel_multivariant({ mlst, tk, block, div, disable_variant2samples }, grid) {
	/* flags to indicate if to show these columns in the grid
	column 1: mutation
	column 2: position
	... optional columns
	*/

	const fixedColumnCount =
		1 + // consequence
		1 + // mutation
		1 // sampleDivHeader
	const showOccurrence = mlst.find(i => i.occurrence != undefined)
	let showNumericmodeValue
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	if (currentMode.type == 'numeric' && currentMode.byAttribute != 'occurrence') {
		showNumericmodeValue = true
	}
	// Calculate number of columns specific to each sample group
	let numOfMetaDataCols = 0
	if (tk.mds.variant2samples) {
		numOfMetaDataCols += tk.mds.variant2samples.termidlst ? tk.mds.variant2samples.termidlst.length : 0
		numOfMetaDataCols += tk.mds.variant2samples.sampleHasSsmReadDepth ? 1 : 0
		numOfMetaDataCols += tk.mds.variant2samples.sampleHasSsmTotalNormal ? 1 : 0
	}

	grid
		.style(
			'grid-template-columns',
			`'repeat(${fixedColumnCount +
				(showOccurrence ? 1 : 0) +
				(showNumericmodeValue ? 1 : 0) +
				numOfMetaDataCols}, auto)'`
		)
		.style('text-overflow', 'ellipsis')
		.style('overflow', 'scroll')
		.style('max-width', '100%') // Fix for grid overflowing tooltip

	// header
	grid
		.append('div')
		.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		.style('opacity', 0.3)
	grid
		.append('div')
		.text(mlst.find(i => i.ref && i.alt) ? 'Mutation' : 'Position')
		.style('opacity', 0.3)
		.style('grid-column-start', '2')
	let startCol = 2 // Determines the start col for positioning later
	if (showOccurrence) {
		startCol = ++startCol
		grid
			.append('div')
			.style('opacity', 0.3)
			.text('Occurrence')
			.style('grid-column-start', startCol)
	}
	if (showNumericmodeValue) {
		startCol = ++startCol
		grid
			.append('div')
			.style('opacity', 0.3)
			.text(currentMode.label)
			.style('grid-column-start', startCol)
	}

	// placeholder for showing column headers of sample table, keep blank if there's no content
	// const sampleDivHeader = grid.append('div')

	// one row for each variant
	const ssmid2div = new Map() // k: m.ssm_id, v: <div>
	// for each variant, make a placeholder <div> and append to list

	for (const m of mlst) {
		// column 1
		print_mname(grid.append('div').style('grid-column-start', '1'), m)
		// column 2
		print_snv(grid.append('div').style('grid-column-start', '2'), m, tk)
		let dataStartCol = 2
		if (showOccurrence) {
			dataStartCol = ++dataStartCol
			grid
				.append('div')
				.text(m.occurrence)
				.style('grid-column-start', dataStartCol)
				.style('text-align', 'center')
		}

		if (showNumericmodeValue) {
			dataStartCol = ++dataStartCol
			grid
				.append('div')
				.text(m.__value_missing ? 'NA' : m.__value_use)
				.style('grid-column-start', dataStartCol)
				.style('text-align', 'center')
		}
		// create placeholder for showing available samples of this variant
		ssmid2div.set(m.ssm_id, grid.append('div').style('display', 'grid'))
	}
	// return { header: sampleDivHeader, ssmid2div, startCol, grid }
	return { ssmid2div, startCol }
}

function partFromLeftLabel() {
	if (data.sampleSummaries) {
		for (const strat of data.sampleSummaries) {
			if (!tk.leftlabels.doms[strat.label]) {
				tk.leftlabels.doms[strat.label] = makelabel(tk, block, laby)
			}
			const showcount = strat.items.reduce((i, j) => i + (j.mclasses ? 1 : 0), 0)
			tk.leftlabels.doms[strat.label]
				.text(showcount + ' ' + strat.label + (showcount > 1 ? 's' : ''))
				.on('click', event => {
					tk.tktip.clear().showunder(event.target)
					stratifymenu_samplesummary(strat, tk, block)
				})
			laby += labyspace + block.labelfontsize
		}
	}

	if (data.sampleSummaries2) {
		for (const l of data.sampleSummaries2) {
			if (!tk.leftlabels.doms[l.label1]) tk.leftlabels.doms[l.label1] = makelabel(tk, block, laby)
			tk.leftlabels.doms[l.label1]
				.text(l.count + ' ' + l.label1 + (l.count > 1 ? 's' : ''))
				.on('click', async event => {
					const wait = tk.tktip
						.clear()
						.showunder(event.target)
						.d.append('div')
						.text('Loading...')
					try {
						const config = tk.mds.sampleSummaries2.lst.find(i => i.label1 == l.label1)
						if (!config) throw 'not found: ' + l.label1
						const data = await tk.mds.sampleSummaries2.get(config)
						if (data.error) throw data.error
						wait.remove()
						stratifymenu_samplesummary(data.strat, tk, block)
					} catch (e) {
						wait.text('Error: ' + (e.message || e))
					}
				})
			laby += labyspace + block.labelfontsize
		}
	}
}
function stratifymenu_samplesummary(strat, tk, block) {
	// strat is one of .sampleSummaries[] from server
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div')
	{
		const catcount =
			(tk.samplefiltertemp[strat.label] ? tk.samplefiltertemp[strat.label].length : 0) +
			strat.items.reduce((i, j) => i + 1 + (j.label2 ? j.label2.length : 0), 0)
		if (catcount > 20) {
			scrolldiv
				.style('overflow-y', 'scroll')
				.style('height', '400px')
				.style('resize', 'vertical')
		}
	}
	const table = scrolldiv.append('table')
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	// 1 - checkbox
	tr.append('td')
	// 2 - category label
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text(strat.label.toUpperCase())
	const hascohortsize = strat.items[0].cohortsize != undefined
	if (hascohortsize) {
		// 3 - percent bar, for those variants shown
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('%SHOWN')
	}
	{
		// 4 - samples, for those variants shown
		const td = tr.append('td')
		if (!hascohortsize) {
			// no percent column, print label for this column
			td.append('div')
				.style('position', 'absolute')
				.style('top', '0px')
				.text('SHOWN')
		}
	}
	// 5 - shown mclass
	tr.append('td')
	/*
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('MUTATIONS')
		*/
	/*
	let hashidden = false
	for (const i of strat.items) {
		if (i.hiddenmclasses) {
			hashidden = true
		}
		if (i.label2) {
			for (const j of i.label2) {
				if (j.hiddenmclasses) {
					hashidden = true
				}
			}
		}
	}
	if (hashidden) {
		// 6 - hidden samples
		// 7 - hidden mclass
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('HIDDEN')
	}
	*/
	for (const item of strat.items) {
		fillrow(item)
		if (item.label2) {
			for (const i of item.label2) {
				fillrow(i, true)
			}
		}
	}

	// hidden categories
	if (tk.samplefiltertemp && tk.samplefiltertemp[strat.label]) {
		for (const label of tk.samplefiltertemp[strat.label]) {
			fillrow({ label })
		}
	}

	const row = tk.tktip.d.append('div').style('margin-top', '15px')
	row
		.append('button')
		.text('Submit')
		.style('margin-right', '5px')
		.on('click', () => {
			const lst = table.node().getElementsByTagName('input')
			const unchecked = []
			for (const i of lst) {
				if (!i.checked) unchecked.push(i.getAttribute('category'))
			}
			if (unchecked.length == lst.length) return window.alert('Please check at least one option.')
			tk.samplefiltertemp[strat.label] = unchecked.length ? unchecked : undefined
			tk.tktip.hide()
			tk.uninitialized = true
			tk.load()
		})
	row
		.append('span')
		.text('Check_all')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '10px')
		.on('click', () => {
			for (const i of table.node().getElementsByTagName('input')) {
				i.checked = true
			}
		})
	row
		.append('span')
		.text('Clear')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '5px')
		.on('click', () => {
			for (const i of table.node().getElementsByTagName('input')) {
				i.checked = false
			}
		})

	function fillrow(item, issub) {
		const tr = table.append('tr').attr('class', 'sja_clb')

		let cbid
		{
			const td = tr.append('td')
			if (!issub) {
				// only make checkbox for first level, not sub level
				cbid = Math.random().toString()
				// checkbox
				td.append('input')
					.attr('type', 'checkbox')
					.attr('id', cbid)
					.property(
						'checked',
						!tk.samplefiltertemp[strat.label] || !tk.samplefiltertemp[strat.label].includes(item.label)
					)
					.attr('category', item.label)
			}
		}
		tr.append('td')
			.append('label')
			.text(item.label)
			.attr('for', cbid)
			.style('padding-left', issub ? '10px' : '0px')
			.style('font-size', issub ? '.8em' : '1em')
		if (hascohortsize) {
			const td = tr.append('td')
			if (item.cohortsize != undefined) {
				fillbar(
					td,
					{ f: item.samplecount / item.cohortsize, v1: item.samplecount, v2: item.cohortsize },
					{ fillbg: '#ECE5FF', fill: '#9F80FF' }
				)
			}
		}
		{
			const td = tr.append('td')
			if (item.samplecount != undefined) {
				td.text(item.samplecount + (item.cohortsize ? ' / ' + item.cohortsize : '')).style('font-size', '.7em')
			}
		}
		const td = tr.append('td')
		if (item.mclasses) {
			for (const [thisclass, count] of item.mclasses) {
				td.append('span')
					.html(count == 1 ? '&nbsp;' : count)
					.style('background-color', mclass[thisclass].color)
					.attr('class', 'sja_mcdot')
			}
		}
		/*
		if (hashidden) {
			const td = tr.append('td')
			if (item.hiddenmclasses) {
				for (const [mclass, count] of item.hiddenmclasses) {
					td.append('span')
						.html(count == 1 ? '&nbsp;' : count)
						.style('background-color', mclass[mclass].color)
						.attr('class', 'sja_mcdot')
				}
			}
		}
		*/
	}
}
function mayaddGetter_sampleSummaries2(tk, block) {
	if (!tk.mds.sampleSummaries2) return
	if (tk.mds.sampleSummaries2.get) return
	tk.mds.sampleSummaries2.get = async level => {
		// level is one of sampleSummaries2.lst[]
		const lst = [
			'genome=' + block.genome.name,
			'dslabel=' + tk.mds.label,
			'samplesummary2_mclassdetail=' + encodeURIComponent(JSON.stringify(level))
		]
		rangequery_rglst(tk, block, lst)
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.set_id) lst.push('set_id=' + tk.set_id)
		if (tk.token) headers['X-Auth-Token'] = tk.token
		if (tk.filter0) lst.push('filter0=' + encodeURIComponent(JSON.stringify(tk.filter0)))
		return await dofetch3('mds3?' + lst.join('&'), { headers }, { serverData: tk.cache })
	}
}

async function make_multiSampleTable(args) {
	const { arg, holder, size, from, filter_term, no_tabs } = args
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	arg.totalcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	const default_size = 10
	let current_size = parseInt(size) || default_size
	const default_from = 0
	let current_from = parseInt(from) || default_from
	const pagination = arg.totalcases > cutoff_tableview
	const lines = (arg.download_data = [])
	arg.tk.mds.variant2samples.visibleterms = arg.tk.mds.variant2samples.termidlst
	if (pagination) {
		arg.size = current_size
		arg.from = current_from
	}
	holder.selectAll('*').style('opacity', 0.5)
	const [data, numofcases] = await arg.tk.mds.variant2samples.get(arg)
	arg.numofcases = numofcases
	holder.selectAll('*').remove()
	// for tid2values coming from sunburst ring, create list at top of summary & list tabs
	if (no_tabs) {
		const ring_terms_holder = holder.append('div')
		const pill_holder = holder.append('div').style('padding', '20px 0')
		if (arg.tid2value_orig.size) make_sunburst_tidlist(arg, ring_terms_holder)
		init_dictionary_ui(pill_holder, arg)
		init_download(pill_holder, arg)
		// TODO: enable and move later in CONFIG
		// init_remove_terms_menu(pill_holder, arg)
	}

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

	// header panel with pagination info and column editing
	const header_div = holder
		.append('div')
		.style('display', 'flex')
		.style('justify-content', 'space-between')

	// top text to display sample per page and total sample size (only for pagination)
	const page_header = header_div.append('div').style('display', 'none')

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
		if (arg.tid2value_orig.has(term.id.toLowerCase())) continue
		get_table_header(grid_div, term.name)
	}
	if (has_ssm_depth) {
		// to support other configs
		get_table_header(grid_div, 'TUMOR DNA MAF')
		get_table_header(grid_div, 'NORMAL DEPTH')
	}

	let line = []
	const header_divs = grid_div.selectAll('div')._groups[0]
	header_divs.forEach(n => line.push(n.innerText))
	lines.push(line.join('\t'))

	// one row per sample
	for (const [i, sample] of data.entries()) {
		let line = []
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
				line.push(sample.sample_id)
			}
		}
		for (const termid of arg.tk.mds.variant2samples.termidlst) {
			const term = arg.tk.mds.termdb.getTermById(termid)
			if (arg.tid2value_orig.has(term.id.toLowerCase())) continue
			const cell = get_table_cell(grid_div, i)
			cell.text(sample[termid] || 'N/A')
			line.push(sample[termid] || 'N/A')
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
				line.push(sm.altTumor + ' / ' + sm.totalTumor)
				line.push(sm.totalNormal || 'N/A')
			}
		}
		lines.push(line.join('\t'))
	}

	// pages and option to change samples per size (only for pagination)
	const page_footer = holder.append('div').style('display', 'none')
	if (pagination) make_pagination(arg, [page_header, page_footer, holder])

	// show option for show or hide columns.
	// Note: only for visible single table, not across all tables
	let columns = []
	const column_nodes = grid_div.selectAll(`div:nth-child(-n+${col_count})`)._groups[0]
	column_nodes.forEach(n => columns.push(n.innerText))
	// TODO: hide this button for now,
	// varify after GDC demo and redesigning config menu if this feature will be useful
	// make_column_showhide_menu(arg, columns, header_div, grid_div)
}

async function make_multiSampleSummaryList(args) {
	const { arg, holder, new_term } = args
	// remove size to get all samples if switching between list and summary view
	delete arg.size
	// reset tid2value to original when new term added, to remove any existing filter
	if (new_term) arg.tid2value = JSON.parse(JSON.stringify(arg.tid2value_orig))
	arg.querytype = arg.tk.mds.variant2samples.type_summary
	arg.totalcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	const data = await arg.tk.mds.variant2samples.get(arg)
	holder.selectAll('*').remove()

	// for tid2values coming from sunburst ring, create list at top of summary & list tabs
	if (arg.tid2value_orig.size) {
		make_sunburst_tidlist(arg, holder)
	}

	const summary_tabs = []
	for (const category of data) {
		// if tid2values are coming from sunburst ring, don't create summary tab for those terms
		let skip_category = false
		for (const termid of arg.tid2value_orig) {
			if (arg.tk.mds.termdb.getTermById(termid).name == category.name) skip_category = true
		}
		if (skip_category) continue
		// if for numeric_term if samplecont is 0,
		// means no sample have value for that term, skip that term in summary
		if (category.density_data && !category.density_data.samplecount) continue
		summary_tabs.push({
			label: `${category.name} ${
				category.numbycategory
					? `<span style='color:#999;font-size:.8em;float:right;margin-left: 5px;'>n=${category.numbycategory.length}</span>`
					: ``
			}`,
			callback: div => make_summary_panel(arg, div, category, main_tabs),
			active: new_term && category.name == new_term.name
		})
	}

	// TODO: check if # occurance should be displayed in summary tab
	// const occurrence = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
	// const summary_label = `Summary <span style='background:#a6a6a6;color:white;font-size:.8em;float:right;margin:2px 5px;padding: 0px 6px; border-radius: 6px;'>${occurrence}</span>`
	const main_tabs = [
		{
			label: 'Summary',
			callback: async div => {
				tab2box(div, summary_tabs)
				delete main_tabs[0].callback
			}
		},
		{
			label: 'List',
			callback: async div => {
				make_multiSampleTable({ arg, holder: div, filter_term: arg.filter_term })
				delete main_tabs[1].callback
			}
		}
	]

	// gather summary data in for download
	const lines = (arg.download_data = [])
	for (const entry of data) {
		if (entry.numbycategory) {
			for (const [category, count] of entry.numbycategory) {
				lines.push(entry.name + '\t' + category + '\t' + count)
			}
		}
	}

	const tabArg = {
		holder: holder.append('div').style('margin-top', '20px'),
		tabs: main_tabs
	}
	await init_tabs(tabArg)

	init_dictionary_ui(tabArg.tabHolder, arg, main_tabs)
	init_download(tabArg.tabHolder, arg, main_tabs)
	// TODO: enable and move later in CONFIG
	// init_remove_terms_menu(main_tabs.holder, arg, main_tabs)
}

function init_dictionary_ui(holder, arg, main_tabs) {
	const main_holder = arg.div.select('.sj_sampletable_holder')
	const add_btn = holder
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_menuoption')
		.style('margin-left', '20px')
		.style('border-radius', '6px')
		.style('padding', '6px 10px')
		.style('cursor', 'pointer')
		.text('Add fields')
		.on('click', async () => {
			const active_tab = main_tabs ? main_tabs.find(t => t.active) : undefined
			const tip = new Menu({ padding: '5px', parent_menu: add_btn })
			const termdb = await import('../../termdb/app')
			tip.clear().showunder(add_btn.node())
			termdb.appInit({
				holder: tip.d,
				state: {
					vocab: {
						dslabel: arg.tk.dslabel,
						genome: arg.block.genome.name
					},
					treeFilter: {
						tid2value: arg.tid2value,
						ssm_id_lst: arg.mlst.map(i => i.ssm_id).join(',')
					},
					header_mode: 'search_only'
				},
				tree: {
					click_term: term => {
						tip.hide()
						if (arg.tk.mds.termdb.getTermById(term.id) == undefined) {
							arg.tk.mds.variant2samples.termidlst.push(term.id)
							arg.tk.mds.termdb.terms.push(term)
							if (active_tab && active_tab.label == 'Summary')
								make_multiSampleSummaryList({ arg, holder: main_holder, new_term: term })
							else if (active_tab && active_tab.label == 'List')
								make_multiSampleTable({ arg, holder: active_tab.holder })
							else make_multiSampleTable({ arg, holder: main_holder, no_tabs: true })
						}
					},
					disable_terms: JSON.parse(JSON.stringify(arg.tk.mds.variant2samples.termidlst))
				}
			})
		})
}

function init_download(holder, arg, main_tabs) {
	// download button
	holder
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_menuoption')
		.style('margin-left', '20px')
		.style('border-radius', '6px')
		.style('padding', '6px 10px')
		.style('cursor', 'pointer')
		.text('Download')
		.on('click', () => {
			const active_tab = main_tabs ? main_tabs.find(t => t.active) : undefined
			const file_name = active_tab ? active_tab.label : 'List'
			to_textfile(file_name, arg.download_data.join('\n'))
		})
}

function init_remove_terms_menu(holder, arg, main_tabs) {
	const remove_btn = holder
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_filter_tag_btn')
		.style('margin-left', '20px')
		.style('border-radius', '6px')
		.style('padding', '6px 10px')
		.style('cursor', 'pointer')
		.text('- Remove fields')
		.on('click', async () => {
			let termidlst = arg.tk.mds.variant2samples.termidlst
			if (arg.tid2value_orig.size) termidlst = termidlst.filter(tid => !arg.tid2value_orig.has(tid))
			const active_tab = main_tabs ? main_tabs.find(t => t.active) : undefined
			const tip = new Menu({ padding: '5px', parent_menu: remove_btn })
			tip.clear().showunder(remove_btn.node())
			tip.d.on('click', event => event.stopPropagation())

			let terms_remove = []

			const fields_list = tip.d
				.append('div')
				.style('margin', '20px')
				.style('font-size', '.9em')
				.style('display', 'grid')
				.style('grid-row-gap', '3px')
				.style('grid-template-columns', 'auto auto')
				.style('align-items', 'center')
				.style('justify-items', 'left')

			for (const id of termidlst) {
				const term = arg.tk.mds.termdb.getTermById(id)
				const checkbox_div = fields_list.append('div')

				const check = checkbox_div
					.append('input')
					.attr('type', 'checkbox')
					.attr('id', id)
					.on('change', () => {
						if (check.node().checked) terms_remove.push(id)
						else terms_remove = terms_remove.filter(t => t != id)
						submit_btn.property('disabled', terms_remove.length ? false : true)
					})

				fields_list
					.append('div')
					.append('label')
					.style('padding', '2px 5px')
					.text(term.name)
					.on('click', event => {
						event.stopPropagation()
						check.attr('checked', check.node().checked ? null : true)
						check.node().dispatchEvent(new Event('change'))
					})
			}

			const submit_btn = tip.d
				.append('button')
				.style('padding', '5px')
				.style('border-radius', '5px')
				.style('margin', 'auto')
				.style('display', 'flex')
				.property('disabled', terms_remove.length ? false : true)
				.style('border', 'solid 1px #ddd')
				.text('Remove')
				.on('click', () => {
					tip.hide()
					if (terms_remove.length) {
						const main_holder = arg.div.select('.sj_sampletable_holder')
						arg.tk.mds.variant2samples.termidlst = arg.tk.mds.variant2samples.termidlst.filter(
							t => !terms_remove.includes(t)
						)
						arg.tk.mds.termdb.terms = arg.tk.mds.termdb.terms.filter(t => !terms_remove.includes(t.id))
						if (active_tab && active_tab.label == 'Summary') make_multiSampleSummaryList({ arg, holder: main_holder })
						else if (active_tab && active_tab.label == 'List') make_multiSampleTable({ arg, holder: active_tab.holder })
						else make_multiSampleTable({ arg, holder, no_tabs: true })
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
			.style('grid-template-columns', 'auto auto auto')
			.style('grid-row-gap', '3px')
			.style('align-items', 'center')
			.style('justify-items', 'left')

		for (const [category_name, count, total] of category.numbycategory) {
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
					.on('click', () => makeFilteredList(category_name))

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
				.on('click', () => makeFilteredList(category_name))
		}

		function makeFilteredList(cat) {
			if (arg.tid2value == undefined) arg.tid2value = {}
			else if (arg.filter_term) {
				const term = arg.tk.mds.termdb.terms.find(t => t.name == arg.filter_term)
				delete arg.tid2value[term.id]
				delete arg.filter_term
			}
			const term = arg.tk.mds.termdb.terms.find(t => t.name == category.name)
			arg.tid2value[term.id] = cat
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
					const term = arg.tk.mds.termdb.terms.find(t => t.name == arg.filter_term)
					delete arg.tid2value[term.id]
					delete arg.filter_term
				}
				const term = arg.tk.mds.termdb.terms.find(t => t.name == category.name)
				arg.tid2value[term.id] = [
					{ op: '>=', range: Math.round(range.range_start / (term.unit_conversion || 1)) },
					{ op: '<=', range: Math.round(range.range_end / (term.unit_conversion || 1)) }
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
		const term = arg.tk.mds.termdb.getTermById(termid)
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text(term.name)
		cell2
			.style('width', 'auto')
			.style('justify-self', 'stretch')
			.text(arg.tid2value[termid])
	}

	// show occurance for sunburst ring
	if (arg.totalcases) {
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Occurrence')
		cell2
			.style('width', 'auto')
			.style('justify-self', 'stretch')
			.text(arg.totalcases)
	}
}

function make_filter_pill(arg, filter_holder, page_holder) {
	const term = arg.tk.mds.termdb.terms.find(t => t.name == arg.filter_term)
	if (arg.tid2value[term.id] == undefined) return
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
		.html(get_value(arg.tid2value[term.id]))

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
			if (!arg.tid2value_orig.has(term.id)) {
				if (Object.keys(arg.tid2value).length == 1) delete arg.tid2value
				else delete arg.tid2value[term.id]
			}
			// delete from arg as well
			delete arg.filter_term
			make_multiSampleTable({ arg, holder: page_holder, size: arg.size, from: arg.from })
		})

	function get_value(values) {
		if (typeof values == 'string') return values
		else {
			const vals = values.map(a => (a.range * (term.unit_conversion || 1)).toFixed(2))
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
		.style('display', 'inline-block')
		.style('padding', '5px')
		.style('margin', '5px 0')
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

function make_column_showhide_menu(arg, columns, header_div, sample_table) {
	const column_edit_btn = header_div
		.append('div')
		.style('display', 'inline-block')
		.style('font-size', '.9em')
		.classed('sja_menuoption', true)
		.style('margin', '10px 20px')
		.style('border', 'solid 1px #ddd')
		.style('height', '20px')
		.style('line-height', '20px')
		.text('Show/hide columns')
		.on('click', async () => {
			const termidlst = arg.tk.mds.variant2samples.termidlst
			let visibleterms = arg.tk.mds.variant2samples.visibleterms
			const tip = new Menu({ padding: '5px', parent_menu: column_edit_btn })
			tip.clear().showunder(column_edit_btn.node())
			tip.d.on('click', event => event.stopPropagation())

			let hidden_terms = termidlst.filter(t => !visibleterms.includes(t))

			const fields_list = tip.d
				.append('div')
				.style('margin', '20px')
				.style('font-size', '.9em')
				.style('display', 'grid')
				.style('grid-row-gap', '3px')
				.style('grid-template-columns', 'auto auto')
				.style('align-items', 'center')

			fields_list
				.append('div')
				.style('padding', '2px')
				.style('color', '#999')
				.text('Show')

			fields_list
				.append('div')
				.style('padding', '2px 5px')
				.style('color', '#999')
				.text('Column')

			for (const id of termidlst) {
				const term = arg.tk.mds.termdb.getTermById(id)
				const checkbox_div = fields_list
					.append('div')
					.style('display', 'flex')
					.style('justify-content', 'center')

				const check = checkbox_div
					.append('input')
					.attr('type', 'checkbox')
					.attr('id', id)
					.attr('checked', hidden_terms.includes(id) ? null : true)
					.on('change', () => {
						if (check.node().checked) hidden_terms = hidden_terms.filter(t => t != id)
						else hidden_terms.push(id)
						submit_btn.property('disabled', visible_terms_changed)
					})

				fields_list
					.append('div')
					.append('label')
					.style('padding', '2px 5px')
					.text(term.name)
					.on('click', event => {
						event.stopPropagation()
						check.attr('checked', check.node().checked ? null : true)
						check.node().dispatchEvent(new Event('change'))
					})
			}

			const submit_btn = tip.d
				.append('button')
				.style('padding', '5px')
				.style('border-radius', '5px')
				.style('margin', 'auto')
				.style('display', 'flex')
				.property('disabled', visible_terms_changed)
				.style('border', 'solid 1px #ddd')
				.text('Submit')
				.on('click', () => {
					tip.hide()
					if (visible_terms_changed) {
						let hidden_cols = []
						hidden_terms.forEach(tid => hidden_cols.push(arg.tk.mds.termdb.getTermById(tid).name))
						for (const col_name of columns) {
							const col_i = columns.findIndex(c => c == col_name) + 1
							const cells = sample_table.selectAll(`div:nth-child(${columns.length}n+${col_i})`)
							if (hidden_cols.includes(col_name)) {
								cells.each(function() {
									d3select(this)
										.style('visibility', 'hidden')
										.style('width', '0px')
										.style('padding', '0')
								})
							} else {
								cells.each(function() {
									d3select(this)
										.style('visibility', 'visible')
										.style('width', 'auto')
										.style('padding', '2px 5px')
								})
							}
						}
						arg.tk.mds.variant2samples.visibleterms = termidlst.filter(t => !hidden_terms.includes(t))
					}
				})

			function visible_terms_changed() {
				return termidlst.length == visibleterms.length + hidden_terms.length
			}
		})
}
