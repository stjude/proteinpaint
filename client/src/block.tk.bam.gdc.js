import { event as d3event } from 'd3-selection'
import * as client from './client'

export function bamsliceui(genomes, holder, hosturl) {
	let gdc_args = {}
	const default_genome = 'hg38'

	const saydiv = holder.append('div').style('margin', '10px 20px')
	const visualdiv = holder.append('div').style('margin', '20px')

	const inputdiv = holder
		.append('div')
		.style('margin', '40px 20px 20px 20px')
		.style('font-size', '.9em')
		.style('display', 'grid')
		.style('grid-template-columns', '150px auto')
		.style('grid-template-rows', 'repeat(6, auto)')
		.style('gap', '5px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	function cmt(t, red) {
		saydiv
			.style('display', 'block')
			.style('color', red ? 'red' : 'black')
			.html(t)
	}

	// token file upload
	inputdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC Token file')

	const upload_div = inputdiv.append('div')

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
					cmt('Invalid file ' + file.name)
					fileui()
					return
				}
				const reader = new FileReader()
				reader.onload = event => {
					gdc_args['gdc_token'] = event.target.result.trim().split(/\r?\n/)[0]
				}
				reader.onerror = function() {
					cmt('Error reading file ' + file.name, 1)
					fileui()
					return
				}
				reader.readAsText(file, 'utf8')
			})

		setTimeout(() => file_input.node().focus(), 1100)
	}

	fileui()

	inputdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC ID')

	const input = inputdiv
		.append('input')
		.attr('size', 40)
		.style('padding', '3px 10px')
		.property('placeholder', 'File UUID / Case UUID / Case ID')
		.on('change', async () => {
			const gdc_id = input.property('value').trim()
			const bam_info = await client.dofetch2('gdcbam?gdc_id=' + gdc_id)
			console.log(bam_info)
			if (bam_info.error) {
				cmt(bam_info.error, 1)
				baminfo_div.style('display', 'none')
			} else if (bam_info.file_uuid) {
				update_singlefile_table(bam_info.file_metadata)
				saydiv.style('display', 'none')
				gdc_args['entity_id'] = bam_info.entity_id
			} else if (bam_info.case_uuid || bam_info.case_id) {
				update_multifile_table(bam_info.file_metadata)
				saydiv.style('display', 'none')
			}
			gdc_args['case_id'] = gdc_id
		})

	const baminfo_div = inputdiv
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
		.style('grid-template-rows', 'repeat(5, 20px)')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('font-size', '.8em')

	const bamselection_table = baminfo_div
		.append('div')
		.style('display', 'grid')
		.style('position', 'relative')
		.style('margin-left', '10px')
		.style('border-left', '1px solid #eee')
		.style('grid-template-columns', '70px 250px 100px 150px 150px 100px')
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
		{ title: 'Variant', key: 'variant', placeholder: 'chr.pos.ref.mut' }
	]
	for (const field of input_fields) {
		makeFormInput(field)
	}

	inputdiv
		.append('div')
		.style('grid-column', 'span 2')
		.style('font-size', '80%')
		.style('padding', '3px 10px').html(`<b>Note:</b> Either position or variant is required.
			</br>&emsp;&emsp;&nbsp;&nbsp; 
			GDC BAM slice will be visualized for the provided postion or variant, 
			to visualze additional reads, enter again from this form.`)

	//submit button
	const submit_btn_div = holder.append('div')

	submit_btn_div
		.append('button')
		.style('font-size', '1.1em')
		.style('margin', '20px')
		.style('margin-left', '130px')
		.text('submit')
		.on('click', () => {
			try {
				validateInputs(gdc_args)
			} catch (e) {
				cmt(e, 1)
				return
			}
			// success
			inputdiv.remove()
			saydiv.remove()
			submit_btn_div.remove()
			renderBamSlice(gdc_args, genomes[default_genome], visualdiv, hosturl)
		})

	function makeFormInput(field) {
		inputdiv
			.append('div')
			.style('padding', '3px 10px')
			.text(field.title)

		const input = inputdiv
			.append('input')
			.attr('size', field.size || 20)
			.style('padding', '3px 10px')
			.property('placeholder', field.placeholder || '')
			.on('change', () => {
				gdc_args[field.key] = input.property('value').trim()
			})
	}

	function update_singlefile_table(bam_metadata) {
		baminfo_table.selectAll('*').remove()
		baminfo_div.style('display', 'block')
		bamselection_table.style('display', 'none')

		for (const bam_info of bam_metadata) {
			for (const row of baminfo_rows) {
				baminfo_table
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
			.style('grid-template-rows', 'repeat(' + bam_files, length + ', 20px)')
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
			bamselection_table
				.append('div')
				.append('input')
				.style('padding', '3px 10px')
				.style('margin-left', '25px')
				.attr('type', 'checkbox')
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
			.style('height', '100px')
	}
}

function validateInputs(obj) {
	if (!obj) throw 'no parameters passing to validate'
	if (!obj.gdc_token) throw 'gdc token missing'
	if (typeof obj.gdc_token !== 'string') throw 'gdc token is not string'
	if (!obj.case_id) throw ' case ID is missing'
	if (typeof obj.case_id !== 'string') throw 'case id is not string'
	if (!obj.position && !obj.variant) throw ' position or variant is required'
	if (obj.position && typeof obj.position !== 'string') throw 'position is not string'
	if (obj.variant && typeof obj.variant !== 'string') throw 'Varitent is not string'
}

function renderBamSlice(args, genome, holder, hostURL) {
	// create arg for block init
	const par = {
		hostURL,
		nobox: 1,
		genome,
		holder
	}
	let variant
	if (args.position) {
		const pos_str = args.position.split(/[:-]/)
		par.chr = pos_str[0]
		par.start = Number.parseInt(pos_str[1])
		par.stop = Number.parseInt(pos_str[2])
	} else if (args.variant) {
		const variant_str = args.variant.split('.')
		variant = {
			chr: variant_str[0],
			pos: Number.parseInt(variant_str[1]),
			ref: variant_str[2],
			alt: variant_str[3]
		}
		par.chr = variant.chr
		par.start = variant.pos - 500
		par.stop = variant.pos + 500
	}

	par.tklst = []

	const tk = {
		type: client.tkt.bam,
		name: args.entity_id || 'sample bam slice',
		gdc: args.gdc_token + ',' + args.case_id,
		downloadgdc: 1,
		file: 'dummy_str'
	}
	if (args.variant) {
		tk.variants = []
		tk.variants.push(variant)
	}
	par.tklst.push(tk)
	client.first_genetrack_tolist(genome, par.tklst)
	import('./block').then(b => {
		new b.Block(par)
	})
}
