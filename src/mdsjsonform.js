import { select as d3select } from 'd3'
import { dofetch2, tab2box, tab_wait } from './client'
import { make_radios } from './dom'

/*
 */

export async function init_mdsjsonform(par) {
	const { holder, genomes } = par

	{
		// check if the form is enabled to work on this server
		const re = await dofetch2('mdsjsonform', { method: 'POST', body: '{}' })
		if (re.error) {
			holder.append('div').text(re.error)
			return
		}
	}

	const [form_div, wrapper_div] = make_header(holder)

	const doms = {}
	doms.genome = make_genome(wrapper_div, genomes)
	doms.name = make_name(wrapper_div)
	set_dense(wrapper_div, doms)
	doms.svcnvfileurl = make_svcnv(wrapper_div)
	doms.vcffileurl = make_vcf(wrapper_div)
	doms.expressionfile = make_express_filepath(wrapper_div)
	make_sampleset(wrapper_div, doms)
	make_assays(wrapper_div, doms)
	console.log(doms)
	make_buttons(form_div, doms)
}

function make_header(holder) {
	const form_div = holder.append('div')
	form_div
		.append('div')
		.style('font-size', '20px')
		.style('margin', '10px')
		.text('Create a Custom GenomePaint Track')
	const wrapper_div = form_div
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr 4fr')
		.style('align-items', 'start')
		.style('grid-template-rows', '1fr')
		.style('row-gap', '15px')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')
	return [form_div, wrapper_div]
}

function make_buttons(form_div, doms) {
	const submit_row = form_div

	submit_row
		.append('button')
		.style('margin-left', '10px')
		.style('margin-top', '5px')
		.text('Submit')
		.on('click', async () => {
			link_holder.html('Loading...')
			try {
				let genome
				{
					const n = doms.genome.node()
					genome = n.options[n.selectedIndex].text
				}
				const deposit = validate_input(doms)
				const re = await dofetch2('mdsjsonform', { method: 'POST', body: JSON.stringify({ deposit }) })
				if (re.error) throw re.error
				link_holder.html(
					'<a href=' +
						window.location.origin +
						'?block=1&genome=' +
						genome +
						'&mdsjsoncache=' +
						re.id +
						' target=_blank>View track</a>'
				)
			} catch (e) {
				window.alert('Error: ' + e)
				link_holder.html('')
				return
			}
		})

	submit_row
		.append('button')
		.text('Example')
		.style('margin-top', '5px')
		.style('margin-left', '10px')
		.on('click', () => {
			doms.name.property('value', 'BALL cell lines')
			doms.svcnvfileurl.property('value', 'genomePaint_demo/demo.svcnv.gz')
			doms.vcffileurl.property('value', 'genomePaint_demo/demo.vcf.gz')
			doms.expressionfile.property('value', 'genomePaint_demo/demo.fpkm.gz')
			doms.assaytrack_radios.nodes()[0].click()
			doms.assaytrack_bigwig_textarea.property(
				'value',
				`SJBALL020016_C1	genomePaint_demo/RNAcoverage/SJBALL020016_C1-sense.bw	SJBALL020016_C1 RNAseq coverage
SJBALL011826_C1	genomePaint_demo/RNAcoverage/SJBALL020016_C1-antisense.bw	mock track`
			)
		})

	const link_holder = submit_row.append('span').style('margin-left', '20px')
}

function validate_input(doms) {
	const obj = {
		type: 'mdssvcnv' // hardcoded, must be the same as common.tkt.mdssvcnv
	}
	obj.name = doms.name.property('value') || 'Custom track'

	// .isdense/isfull is already defined

	{
		const cnv = doms.svcnvfileurl.property('value').trim()
		const vcf = doms.vcffileurl.property('value').trim()
		if (!cnv && !vcf) throw 'Either SVCNV or VCF file/URL (or both) needs to be provided.'
		if (cnv) {
			if (isurl(cnv)) {
				obj.svcnvurl = cnv
			} else {
				obj.svcnvfile = cnv
			}
		}
		if (vcf) {
			if (isurl(vcf)) {
				obj.vcfurl = vcf
			} else {
				obj.vcffile = vcf
			}
		}
	}
	{
		const tmp = doms.expressionfile.property('value').trim()
		if (tmp) {
			if (isurl(tmp)) {
				obj.expressionurl = tmp
			} else {
				obj.expressionfile = tmp
			}
		}
	}

	if (doms.sampleset_inuse) {
		const tmp = doms.sampleset_textarea.property('value').trim()
		if (!tmp) throw 'Missing input for sample subset'
		const group2lst = new Map()
		const nogrplst = []
		for (const line of tmp.split('\n')) {
			if (!line) continue
			const [sample, group] = line.split('\t')
			if (group) {
				if (!group2lst.has(group)) group2lst.set(group, [])
				group2lst.get(group).add(sample)
			} else {
				nogrplst.push(sample)
			}
		}
		obj.sampleset = []
		if (nogrplst.length) {
			obj.sampleset.push({ samples: nogrplst })
		}
		for (const [group, lst] of group2lst) {
			obj.sampleset.push({ name: group, samples: lst })
		}
	}

	if (doms.assaytrack_inuse) {
		obj.sample2assaytrack = {}
		parse_bigwig(doms, obj)
		parse_bigwigstranded(doms, obj)
		parse_bedj(doms, obj)
		parse_junction(doms, obj)
	}
	console.log(obj)
	return obj
}

function isurl(t) {
	const a = t.toUpperCase()
	return a.startsWith('HTTP://') || a.startsWith('HTTPS://')
}
//.genome
function make_genome(div, genomes) {
	const genome_prompt = div.append('div')

	genome_prompt.append('span').text('Genome')

	const g_row = div.append('div')

	const select = g_row.append('select')
	for (const n in genomes) {
		select.append('option').text(n)
	}
	return select
}

//.name
function make_name(div) {
	const tk_name_prompt = div.append('div')

	tk_name_prompt.append('span').text('Track name')

	const tk_name_div = div.append('div')

	return tk_name_div
		.append('div')
		.append('input')
		.attr('size', 30)
}
// .isdense, isfull
function set_dense(div, doms) {
	// this helper function will not return radio buttons,
	// the radio buttons will trigger callback that will modify doms{} attribute

	doms.isdense = true // default settings are needed in case the form is submitted without triggering radio callback
	doms.isfull = false
	const is_dense_prompt = div.append('div')

	is_dense_prompt.append('span').text('Display')

	const row = div.append('div')
	make_radios({
		holder: row,
		options: [{ label: 'Dense', value: 1, checked: true }, { label: 'Expanded', value: 2 }],
		callback: value => {
			if (value == 1) {
				doms.isdense = true
				doms.isfull = false
			} else {
				doms.isdense = false
				doms.isfull = true
			}
		},
		styles: {
			display: 'inline'
		}
	})
}
//.svcnvfile or .svcnvurl
function make_svcnv(div) {
	const svcnv_path_prompt = div.append('div')

	svcnv_path_prompt.append('span').text('"SVCNV" file path or URL')

	const svcnv_path_div = div.append('div')

	return svcnv_path_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
//.vcffile
function make_vcf(div) {
	const vcf_file_prompt = div.append('div')

	vcf_file_prompt.append('span').text('VCF file path')

	const vcf_file_div = div.append('div')

	return vcf_file_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
//.expressionfile
function make_express_filepath(div) {
	const expression_file_prompt = div.append('div')

	expression_file_prompt.append('span').text('Gene expression file path')

	const expression_file_div = div.append('div')

	return expression_file_div
		.append('div')
		.append('input')
		.attr('size', 55)
}
// .sampleset
function make_sampleset(div, doms) {
	const sampleset_prompt = div.append('div')

	sampleset_prompt.append('span').text('Subset samples')

	const column2 = div.append('div')
	const radiodiv = column2.append('div')
	const uidiv = column2.append('div').style('display', 'none')
	make_radios({
		holder: radiodiv,
		options: [{ label: 'Show all', value: 1, checked: true }, { label: 'Show subset', value: 2 }],
		callback: value => {
			doms.sampleset_inuse = value == 2
			uidiv.style('display', value == 2 ? 'block' : 'none')
		},
		styles: {
			display: 'inline'
		}
	})
	// contents of uidiv
	doms.sampleset_textarea = uidiv
		.append('textarea')
		.style('width', '200px')
		.style('height', '250px')
}

// Assay track
function make_assays(div, doms) {
	const assay_prompt = div.append('div')

	assay_prompt.append('span').text('Assay tracks')

	const column2 = div.append('div')
	const radiodiv = column2.append('div')
	const uidiv = column2.append('div').style('display', 'none')
	const { divs, labels, inputs } = make_radios({
		holder: radiodiv,
		options: [{ label: 'Yes', value: 1 }, { label: 'No', value: 2, checked: true }],
		callback: value => {
			doms.assaytrack_inuse = value == 1
			uidiv.style('display', value == 1 ? 'block' : 'none')
		},
		styles: {
			display: 'inline'
		}
	})
	doms.assaytrack_radios = inputs
	// contents of uidiv
	const tabs = [
		{
			label: 'bigWig',
			callback: async div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by a tab')
				doms.assaytrack_bigwig_textarea = div
					.append('textarea')
					.style('width', '200px')
					.style('height', '250px')
			}
		},
		{
			label: 'Stranded bigWig',
			callback: async div => {
				div
					.append('div')
					.text(
						'Copy and paste the sample name, strand 1 file path, strand 2 file path, and track name in a three column format separated by a tabs'
					)
				doms.assaytrack_bigwigstranded_textarea = div
					.append('textarea')
					.style('width', '200px')
					.style('height', '250px')
			}
		},
		{
			label: 'JSON-BED (bedj)',
			callback: async div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by a tab')
				doms.assaytrack_bedj_textarea = div
					.append('textarea')
					.style('width', '200px')
					.style('height', '250px')
			}
		},
		{
			label: 'Splice junction',
			callback: async div => {
				div
					.append('div')
					.text('Copy and paste the sample name, file path, and track name in a three column format separated by a tab')
				doms.assaytrack_junction_textarea = div
					.append('textarea')
					.style('width', '200px')
					.style('height', '250px')
			}
		}
	]
	tab2box(uidiv, tabs)
}

function parse_bigwig(doms, obj) {
	const tmp = doms.assaytrack_bigwig_textarea.property('value').trim()
	if (!tmp) return
	for (const line of tmp.split('\n')) {
		if (!line) continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' bigwig',
			type: 'bigwig'
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		if (!obj.sample2assaytrack[sample]) obj.sample2assaytrack[sample] = []
		obj.sample2assaytrack[sample].push(tk)
	}
}

function parse_bigwigstranded(doms, obj) {
	const tmp = doms.assaytrack_bigwigstranded_textarea.property('value').trim()
	if (!tmp) return
	for (const line of tmp.split('\n')) {
		if (!line) continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[3] || sample + ' bigwigstranded',
			type: 'bigwigstranded'
		}
		if (isurl(lst[1])) {
			tk.url1 = {
				strand1: {
					url: lst[1]
				}
			}
		} else {
			tk.file1 = {
				strand1: {
					file: lst[1]
				}
			}
		}
		if (isurl(lst[2])) {
			tk.url2 = {
				strand2: {
					url: lst[2]
				}
			}
		} else {
			tk.file2 = {
				strand2: {
					file: lst[2]
				}
			}
		}
		if (!obj.sample2assaytrack[sample]) obj.sample2assaytrack[sample] = []
		obj.sample2assaytrack[sample].push(tk)
	}
}

function parse_bedj(doms, obj) {
	const tmp = doms.assaytrack_bedj_textarea.property('value').trim()
	if (!tmp) return
	for (const line of tmp.split('\n')) {
		if (!line) continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' bed',
			type: 'bedj'
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		if (!obj.sample2assaytrack[sample]) obj.sample2assaytrack[sample] = []
		obj.sample2assaytrack[sample].push(tk)
	}
}

function parse_junction(doms, obj) {
	const tmp = doms.assaytrack_junction_textarea.property('value').trim()
	if (!tmp) return
	for (const line of tmp.split('\n')) {
		if (!line) continue
		const lst = line.split('\t')
		const sample = lst[0]
		if (!lst[1]) {
			// missing file/url
			continue
		}
		const tk = {
			name: lst[2] || sample + ' splice junction',
			type: 'junction'
		}
		if (isurl(lst[1])) {
			tk.url = lst[1]
		} else {
			tk.file = lst[1]
		}
		if (!obj.sample2assaytrack[sample]) obj.sample2assaytrack[sample] = []
		obj.sample2assaytrack[sample].push(tk)
	}
}
