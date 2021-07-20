import { event as d3event } from 'd3-selection'
import { debounce } from 'debounce'
import { first_genetrack_tolist, tkt, dofetch2, sayerror } from './client'
import { contigNameNoChr2 } from '../shared/common'
import urlmap from './common/urlmap'

/* args required to generate bam track
    gdc_args = 
    {
        gdc_token: <string>,
        // either postion or variant is required
        position: chr:start-stop <string>,
        variant: chr.pos.ref.mut <string>, 
        bam_files: [
            {
                file_id: file uuid from gdc <string>,
                track_name: used for naming of track <string> //optional
            }, 
            {} ..
        ]
    }
*/

const gdc_genome = 'hg38'

export function bamsliceui(genomes, holder) {
	let gdc_args = {
		bam_files: []
	}

	const saydiv = holder.append('div').style('margin', '10px 20px')
	const visualdiv = holder.append('div').style('margin', '20px')

	const formdiv = holder
		.append('div')
		.style('margin', '40px 20px 20px 20px')
		.style('font-size', '.9em')
		.style('display', 'grid')
		.style('grid-template-columns', '150px auto')
		.style('grid-template-rows', 'repeat(6, auto)')
		.style('gap', '5px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	// token file upload
	formdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC Token file')

	const upload_holder = formdiv.append('div')
	const upload_div = upload_holder.append('div').style('display', 'inline-block')

	const fileui = () => {
		upload_div.selectAll('*').remove()

		const file_input = upload_div
			.append('input')
			.attr('type', 'file')
			.on('change', () => {
				const file = d3event.target.files[0]
				if (!file) {
					fileui()
					return
				}
				if (!file.size) {
					show_input_check(file_error_div, 'Invalid file ' + file.name)
					fileui()
					return
				}
				const reader = new FileReader()
				reader.onload = event => {
					gdc_args['gdc_token'] = event.target.result.trim().split(/\r?\n/)[0]
				}
				reader.onerror = function() {
					show_input_check(file_error_div, 'Error reading file ' + file.name)
					fileui()
					return
				}
				show_input_check(file_error_div)
				reader.readAsText(file, 'utf8')
			})

		setTimeout(() => file_input.node().focus(), 1100)
	}

	fileui()

	const file_error_div = upload_holder
		.append('div')
		.style('display', 'none')
		.style('padding', '2px 5px')
		.style('font-size', '90%')

	formdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC ID')

	const gdcid_inputdiv = formdiv.append('div')

	const gdcid_input = gdcid_inputdiv
		.append('input')
		.attr('size', 40)
		.style('padding', '3px 10px')
		.property('placeholder', 'File name / File UUID / Case ID / Case UUID')
		.on('keyup', debounce(gdc_search, 100))

	const gdc_loading = gdcid_inputdiv
		.append('span')
		.style('font-size', '90%')
		.style('padding-left', '10px')
		.style('color', '#999')
		.style('display', 'none')
		.html('loading...')

	const gdcid_error_div = gdcid_inputdiv
		.append('span')
		.style('font-size', '90%')
		.style('display', 'none')
		.style('padding', '2px 5px')

	async function gdc_search() {
		const gdc_id = gdcid_input.property('value').trim()
		if (!gdc_id.length) {
			baminfo_div.style('display', 'none')
			saydiv.style('display', 'none')
			gdcid_error_div.style('display', 'none')
			return
		} else {
			// disable input field and show 'loading...' until response returned from gdc api
			gdcid_input.attr('disabled', 1)
			gdc_loading.style('display', 'inline-block')
		}
		const bam_info = await dofetch2('gdcbam?gdc_id=' + gdc_id)
		// enable input field and hide 'Loading...'
		gdcid_input.attr('disabled', null)
		gdc_loading.style('display', 'none')
		gdc_args.bam_files = [] //empty bam_files array after each gdc api call
		if (bam_info.error) {
			show_input_check(gdcid_error_div, bam_info.error)
			baminfo_div.style('display', 'none')
		} else if (bam_info.is_file_uuid || bam_info.is_file_id) {
			// update file id to be suppliled to gdc bam query
			gdc_args.bam_files.push({ file_id: bam_info.is_file_uuid ? gdc_id : bam_info.file_metadata[0].file_uuid })
			update_singlefile_table(bam_info.file_metadata)
			show_input_check(gdcid_error_div)
		} else if (bam_info.is_case_uuid || bam_info.is_case_id) {
			update_multifile_table(bam_info.file_metadata)
			show_input_check(gdcid_error_div)
		}
	}

	const baminfo_div = formdiv
		.append('div')
		.style('grid-column', 'span 2')
		.style('display', 'none')

	const baminfo_table = baminfo_div
		.append('div')
		.style('display', 'grid')
		.style('position', 'relative')
		.style('margin-left', '10px')
		.style('border-left', '1px solid #eee')
		.style('grid-template-columns', '150px 300px')
		.style('grid-template-rows', 'repeat(15, 20px)')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('font-size', '.8em')

	const bamselection_table = baminfo_div
		.append('div')
		.style('display', 'grid')
		.style('position', 'relative')
		.style('margin-left', '10px')
		.style('padding', '10px')
		.style('border-left', '1px solid #eee')
		.style('grid-template-columns', '70px auto 100px 150px auto 100px')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('font-size', '.8em')

	const baminfo_rows = [
		{ title: 'Entity ID', key: 'entity_id' },
		{ title: 'Entity Type', key: 'entity_type' },
		{ title: 'Experimental Strategy', key: 'experimental_strategy' },
		{ title: 'Sample Type', key: 'sample_type' },
		{ title: 'Size', key: 'file_size' }
	]

	const input_fields = [
		{ title: 'Position', key: 'position', placeholder: 'chr:start-stop' },
		{ title: 'Variant', key: 'variant', placeholder: 'chr.pos.refAllele.altAllele' }
	]

	const [position_input, variant_input] = makeFormInput(input_fields)

	formdiv
		.append('div')
		.style('grid-column', 'span 2')
		.style('opacity', 0.6).html(`<ul>
			<li>All positions are on hg38 and 1-based.</li>
			<li>Either position or variant is required.</li>
			<li>The BAM file will be sliced at the provided postion or variant and visualized.
			To visualize reads from a new region, enter again from this form.</li>
		</ul>`)

	//submit button
	const submit_btn_div = holder.append('div')

	submit_btn_div
		.append('button')
		.style('font-size', '1.1em')
		.style('margin', '20px')
		.style('margin-left', '130px')
		.text('Submit')
		.on('click', () => {
			try {
				validateInputs(gdc_args, genomes[gdc_genome])
			} catch (e) {
				sayerror(saydiv, e.message || e)
				if (e.stack) console.log(e.stack)
				return
			}
			// success
			formdiv.remove()
			saydiv.remove()
			submit_btn_div.remove()
			renderBamSlice(gdc_args, genomes[gdc_genome], visualdiv)
		})

	function makeFormInput(fields) {
		const inputs = []
		for (const field of fields) {
			formdiv
				.append('div')
				.style('padding', '3px 10px')
				.text(field.title)

			const input_div = formdiv.append('div').style('display', 'inline-block')

			const input = input_div
				.append('input')
				.attr('size', field.size || 20)
				.style('padding', '3px 10px')
				.property('placeholder', field.placeholder || '')
				.on('change', () => {
					let input_str = input.property('value').trim()
					const chr = input_str.split(/[:.>]/)[0]
					if (!input_str.length) {
						saydiv.style('display', 'none')
						err_div.style('display', 'none')
						delete gdc_args[field.key]
						return
					}
					const [nocount, hascount] = contigNameNoChr2(genomes[gdc_genome], [chr])
					if (nocount + hascount == 0) {
						const err_msg = 'chromosome is not valid: ' + chr
						show_input_check(err_div, err_msg)
					} else {
						if (nocount) input_str = 'chr' + input_str
						show_input_check(err_div)
					}
					gdc_args[field.key] = input_str
				})
			inputs.push(input)

			const err_div = input_div
				.append('div')
				.style('display', 'none')
				.style('padding', '2px 5px')
				.style('font-size', '90%')
		}
		return inputs
	}

	function update_singlefile_table(bam_metadata) {
		baminfo_table.selectAll('*').remove()
		baminfo_div.style('display', 'block')
		bamselection_table.style('display', 'none')

		for (const bam_info of bam_metadata) {
			// assign track name as entity_id
			gdc_args.bam_files[0].track_name = bam_info.entity_id
			for (const row of baminfo_rows) {
				baminfo_table
					.style('display', 'grid')
					.append('div')
					.style('padding', '3px 10px')
					.style('font-weight', 'bold')
					.text(row.title)

				baminfo_table
					.append('div')
					.style('padding', '3px 10px')
					.text(bam_info[row.key])
			}
		}

		baminfo_table
			.style('padding', '10px')
			.style('height', '0')
			.transition()
			.duration(500)
			.style('height', '100px')
	}

	function update_multifile_table(bam_files) {
		bamselection_table.selectAll('*').remove()
		baminfo_div.style('display', 'block')
		baminfo_table.style('display', 'none')

		bamselection_table
			.style('display', 'grid')
			.style('grid-template-rows', 'repeat(' + bam_files.length + ', 20px)')
			.append('div')
			.style('padding', '3px 10px')
			.style('font-weight', 'bold')
			.text('Bam file')

		for (const row of baminfo_rows) {
			bamselection_table
				.append('div')
				.style('padding', '3px 10px')
				.style('font-weight', 'bold')
				.text(row.title)
		}

		for (const bam_info of bam_files) {
			const file_checkbox = bamselection_table
				.append('div')
				.append('input')
				.style('padding', '3px 10px')
				.style('margin-left', '25px')
				.attr('type', 'checkbox')
				.on('change', () => {
					if (file_checkbox.node().checked) {
						gdc_args.bam_files.push({
							file_id: bam_info.file_uuid,
							track_name: bam_info.sample_type + ', ' + bam_info.experimental_strategy + ', ' + bam_info.entity_id
						})
					} else {
						// remove from array if checkbox unchecked
						gdc_args.bam_files = gdc_args.bam_files.filter(f => f.file_id != bam_info.file_uuid)
					}
				})
			for (const row of baminfo_rows) {
				bamselection_table
					.append('div')
					.style('padding', '3px 10px')
					.text(bam_info[row.key])
			}
		}

		bamselection_table
			.style('padding', '10px')
			.style('height', '0')
			.transition()
			.duration(500)
			.style('height', bam_files.length * 22 + 'px')
	}

	// autofill input fields if supplied from url
	// format: ?gdc_id=<id>&gdc_pos=<coord>&gdc_var=<variant>
	// example: ?gdc_id=TCGA-44-6147&gdc_pos=chr9:5064699-5065299
	// Note: can't auto upload file for gdc_token provided from url,
	// it's not possible because of security reason
	const urlp = urlmap()
	if (urlp.has('gdc_id')) {
		gdcid_input
			.property('value', urlp.get('gdc_id'))
			.node()
			.dispatchEvent(new Event('keyup'))
	}

	if (urlp.has('gdc_pos')) {
		position_input
			.property('value', urlp.get('gdc_pos'))
			.node()
			.dispatchEvent(new Event('change'))
	} else if (urlp.has('gdc_var')) {
		variant_input
			.property('value', urlp.get('gdc_var'))
			.node()
			.dispatchEvent(new Event('change'))
	}
}

function show_input_check(holder, error_msg) {
	// if error_msg was supplied it will appear as red next to input field
	// if error_msg is not supplied, check mark will appear next to field after entering value
	holder
		.style('display', 'inline-block')
		.style('color', error_msg ? 'red' : 'green')
		.html(error_msg ? '&#10060; ' + error_msg : '&#10003;')
}

function validateInputs(obj, genome) {
	if (!obj) throw 'no parameters passing to validate'
	if (!obj.gdc_token) throw 'gdc token missing'
	if (typeof obj.gdc_token !== 'string') throw 'gdc token is not string'
	if (!obj.bam_files.length) throw 'no bam file supplied'
	for (const file of obj.bam_files) {
		if (!file.file_id) throw ' file uuid is missing'
		if (typeof file.file_id !== 'string') throw 'file uuid is not string'
	}
	if (!obj.position && !obj.variant) throw 'position or variant is required'
	// parse position or variant string and replace with object
	if (obj.position) {
		if (typeof obj.position !== 'string') throw 'position is not string'
		const tmp = obj.position.split(/[:\-]/)
		if (tmp.length != 3) throw 'position is not in "chr:start-stop" format'
		const [nocount, hascount] = contigNameNoChr2(genome, [tmp[0]])
		if (nocount + hascount == 0) throw 'invalid chromosome in position'
		const start = Number(tmp[1])
		const stop = Number(tmp[2])
		if (!Number.isInteger(start) || !Number.isInteger(stop)) throw 'non-integer start/stop in position'
		obj.position = {
			chr: nocount ? 'chr' + tmp[0] : tmp[0],
			start,
			stop
		}
	} else {
		if (typeof obj.variant !== 'string') throw 'variant is not string'
		const tmp = obj.variant.split(/[:\-.>]/)
		if (tmp.length != 4) throw 'variant is not in format of "chr.pos.ref.alt"'
		const [nocount, hascount] = contigNameNoChr2(genome, [tmp[0]])
		if (nocount + hascount == 0) throw 'invalid chromosome in variant'
		const pos = Number(tmp[1])
		if (!Number.isInteger(pos)) throw 'non-integer position in variant'
		obj.variant = {
			chr: nocount ? 'chr' + tmp[0] : tmp[0],
			pos: pos - 1, // convert 1-based to 0-based
			ref: tmp[2],
			alt: tmp[3]
		}
	}
}

function renderBamSlice(args, genome, holder) {
	// create arg for block init
	const par = {
		nobox: 1,
		genome,
		holder
	}
	if (args.position) {
		par.chr = args.position.chr
		par.start = args.position.start
		par.stop = args.position.stop
	} else if (args.variant) {
		par.chr = args.variant.chr
		par.start = args.variant.pos - 60
		par.stop = args.variant.pos + 60
	}

	par.tklst = []
	for (const file of args.bam_files) {
		const tk = {
			type: tkt.bam,
			name: file.track_name || 'sample bam slice',
			gdc: args.gdc_token,
			gdc_file: file.file_id,
			downloadgdc: 1,
			file: 'dummy_str'
		}
		if (args.variant) {
			tk.variants = [args.variant]
		}
		par.tklst.push(tk)
	}
	first_genetrack_tolist(genome, par.tklst)
	import('./block').then(b => {
		new b.Block(par)
	})
}
