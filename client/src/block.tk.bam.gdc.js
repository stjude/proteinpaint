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
		.style('grid-template-rows', 'repeat(4, 30px)')
		.style('gap', '5px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	function cmt(t, red) {
		saydiv.style('color', red ? 'red' : 'black').html(t)
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

	const input_fields = [
		{ title: 'Case ID', key: 'case_id', size: 40 },
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
		.style('padding', '3px 10px')
		.html(`<b>Note:</b> Either position or variant is required.
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
			.property('placeholder', field.placeholder || '')
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
		name: 'sample bam slice',
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