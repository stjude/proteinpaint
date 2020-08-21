import { select as d3select, event as d3event } from 'd3-selection'
import * as common from '../common'
import * as client from '../client'
import { init as init_legend } from './legend'
import { loadTk } from './tk'

/*
TODO how to tell if tk.mds is a custom track

common structure of tk.mds between official and custom

tk.skewer{}
	create if skewer data type is available for this mds
	if not equipped then tk.skewer is undefined and should not show skewer track

stratify labels will account for all tracks, e.g. skewer, cnv
*/

const labyspace = 5

export async function makeTk(tk, block) {
	//tk.load = _load(tk, block)

	tk.itemtip = new client.Menu()

	get_ds(tk, block)
	// tk.mds is created for both official and custom track
	// following procedures are only based on tk.mds

	mayaddGetter_variant2samples(tk, block)

	if (tk.mds.has_skewer) {
		tk.skewer = {
			g: tk.glider.append('g')
		}
	}

	tk.tklabel.text(tk.mds.label)

	make_leftlabels(tk, block)

	tk.clear = () => {
		// called in loadTk
	}

	// TODO <g> for other file types

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	init_legend(tk, block)
}

function get_ds(tk, block) {
	if (tk.dslabel) {
		// official dataset

		tk.mds = block.genome.datasets[tk.dslabel]
		if (!tk.mds) throw 'dataset not found for ' + tk.dslabel

		return
	}
	// custom
	if (!tk.name) tk.name = 'Unamed'
	tk.mds = {}
	// to fill in details to tk.mds
	/*
	if (tk.vcf) {
		await getvcfheader_customtk(tk.vcf, block.genome)
	}
	*/
	// if variant2samples is enabled for custom ds, it will also have the async get()
}

function mayaddGetter_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return
	if (tk.mds.variant2samples.get) return // track from the same mds has already been intialized
	// native track, need to know what to do for custom track
	tk.mds.variant2samples.get = async (mlst, querytype) => {
		/*
		support alternative methods
		where all data are hosted on client
		*/
		// hardcode to getsummary and using fixed levels
		const par = ['genome=' + block.genome.name, 'dslabel=' + tk.mds.label, 'variant2samples=1', 'get=' + querytype]
		if (tk.mds.variant2samples.variantkey == 'ssm_id') {
			// TODO detect too long string length that will result url-too-long error
			// in such case, need alternative query method
			par.push('ssm_id_lst=' + mlst.map(i => i.ssm_id).join(','))
		} else {
			throw 'unknown variantkey for variant2samples'
		}
		return await client.dofetch2('mds3?' + par.join('&'))
	}
}

function make_leftlabels(tk, block) {
	let laby = labyspace + block.labelfontsize
	tk.label_mcount = block.maketklefthandle(tk, laby)
	tk.label_mcount.text('Loading...').on('click', () => {})
	laby += labyspace + block.labelfontsize
	if (tk.mds.has_genecnv_quickfix) {
		// only for genecnv with no sample level info
		// should be replaced with just one multi-row label showing #variants, #cnv and click for a menu for collective summary
		tk.label_genecnv = block.maketklefthandle(tk, laby)
		laby += labyspace + block.labelfontsize
		tk.label_genecnv.text('Loading...').on('click', () => {
			stratifymenu_genecnv(tk, block)
		})
	}
	if (tk.mds.sampleSummaries) {
		tk.label_sampleSummaries = {}
		for (const strat of tk.mds.sampleSummaries) {
			const lab = block.maketklefthandle(tk, laby)
			tk.label_sampleSummaries[strat.label1] = lab
			laby += labyspace + block.labelfontsize
			lab.on('click', () => {
				stratifymenu_samplesummary(strat, tk, block)
			})
		}
	}
}

function parse_client_config(tk) {
	/* for both official and custom
configurations and their location are not stable
*/
}

function configPanel(tk, block) {}

function stratifymenu_samplesummary(strat, tk, block) {
	// strat is one of tk.mds.sampleSummaries[]
	if (!tk._data || !tk._data.sampleSummaries) return
	const result = tk._data.sampleSummaries.find(i => i.label == strat.label1)
	if (!result) return
	tk.tktip.showunder(tk.label_sampleSummaries[strat.label1].node()).clear()
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div').style('overflow-y', 'scroll')
	if (result.items.reduce((i, j) => i + 1 + (j.label2 ? j.label2.length : 0), 0) > 20) {
		scrolldiv.style('height', '400px').style('resize', 'vertical')
	}
	const table = scrolldiv.append('table')
	// 4 columns
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text(strat.label1.toUpperCase())
	const hascohortsize = result.items[0].cohortsize != undefined
	if (hascohortsize) {
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('%')
	}
	tr.append('td')
	/*
		.append('div')
		.style('position','absolute')
		.style('top','0px')
		.text('SAMPLES')
		*/
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('MUTATIONS')
	for (const item of result.items) {
		fillrow(item)
		if (item.label2) {
			for (const i of item.label2) {
				fillrow(i, true)
			}
		}
	}
	function fillrow(item, issub) {
		const tr = table.append('tr').attr('class', 'sja_clb')
		tr.append('td')
			.text(item.label)
			.style('padding-left', issub ? '10px' : '0px')
			.style('font-size', issub ? '.8em' : '1em')
		if (hascohortsize) {
			const td = tr.append('td')
			if (item.cohortsize != undefined) {
				client.fillbar(
					td,
					{ f: item.samplecount / item.cohortsize, v1: item.samplecount, v2: item.cohortsize },
					{ fillbg: '#ECE5FF', fill: '#9F80FF' }
				)
			}
		}
		tr.append('td')
			.text(item.samplecount + (item.cohortsize ? ' / ' + item.cohortsize : ''))
			.style('font-size', '.7em')
		const td = tr.append('td')
		for (const [mclass, count] of item.mclasses) {
			td.append('span')
				.html(count == 1 ? '&nbsp;' : count)
				.style('background-color', common.mclass[mclass].color)
				.attr('class', 'sja_mcdot')
		}
	}
}
function stratifymenu_genecnv(tk, block) {
	// quick fix, will abandon when getting sample-level cnv data
	if (!tk._data || !tk._data.genecnvNosample) return
	tk.tktip.showunder(tk.label_genecnv.node()).clear()
	const m = tk._data.genecnvNosample[0]
	const maxf = (m.gain + m.loss) / m.total
	const frac2width = f => (100 * f) / maxf
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div').style('overflow-y', 'scroll')
	if (tk._data.genecnvNosample.length > 20) {
		scrolldiv.style('height', '400px').style('resize', 'vertical')
	}
	const table = scrolldiv.append('table')
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Project') // XXX hardcoded!
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Max: ' + Math.ceil(100 * maxf) + '%')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Loss/Gain/Total')
	for (const item of tk._data.genecnvNosample) {
		const tr = table.append('tr').attr('class', 'sja_clb')
		tr.append('td').text(item.label)
		const td = tr.append('td')
		if (item.loss) {
			td.append('div')
				.style('background', tk.mds.queries.genecnv.losscolor)
				.style('display', 'inline-block')
				.style('width', frac2width(item.loss / item.total) + 'px')
				.style('height', '15px')
		}
		if (item.gain) {
			td.append('div')
				.style('background', tk.mds.queries.genecnv.gaincolor)
				.style('display', 'inline-block')
				.style('width', frac2width(item.gain / item.total) + 'px')
				.style('height', '15px')
		}
		tr.append('td').html(
			'<span style="color:' +
				tk.mds.queries.genecnv.losscolor +
				'">' +
				item.loss +
				'</span>\t\t' +
				'<span style="color:' +
				tk.mds.queries.genecnv.gaincolor +
				'">' +
				item.gain +
				'</span>\t\t' +
				'<span style="opacity:.5;font-size:.8em">' +
				item.total +
				'</span>'
		)
	}
}

/*
function _load(tk, block) {
	return () => {
		return loadTk(tk, block)
	}
}
*/
