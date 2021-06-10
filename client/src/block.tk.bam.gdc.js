import { event as d3event } from 'd3-selection'
import { debounce } from 'debounce'
import * as client from './client'
import { contigNameNoChr2 } from '../shared/common'
import { url2map } from './app.parseurl'

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

export function bamsliceui(genomes, holder, hosturl) {
	let gdc_args = {
		bam_files: []
	}
	const default_genome = 'hg38'

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

	function cmt(t, red) {
		saydiv
			.style('display', 'block')
			.style('color', red ? 'red' : 'black')
			.html(t)
	}

	// token file upload
	formdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC Token file')

	const upload_div = formdiv.append('div')

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

	formdiv
		.append('div')
		.style('padding', '3px 10px')
		.text('GDC ID')

	const gdcid_inputdiv = formdiv.append('div')

	const gdcid_input = gdcid_inputdiv
		.append('input')
		.attr('size', 40)
		.style('padding', '3px 10px')
		.property('placeholder', 'File UUID / Case UUID / Case ID')
		.on('keyup', debounce(gdc_search, 100))

	const gdc_loading = gdcid_inputdiv
		.append('span')
		.style('font-size', '90%')
		.style('padding-left', '10px')
		.style('color', '#999')
		.style('display', 'none')
		.html('loading...')

	async function gdc_search() {
		const gdc_id = gdcid_input.property('value').trim()
		if (!gdc_id.length) {
			baminfo_div.style('display', 'none')
			saydiv.style('display', 'none')
			return
		} else {
			// disable input field and show 'loading...' until response returned from gdc api
			gdcid_input.attr('disabled', 1)
			gdc_loading.style('display', 'inline-block')
		}
		const bam_info = await client.dofetch2('gdcbam?gdc_id=' + gdc_id)
		// enable input field and hide 'Loading...'
		gdcid_input.attr('disabled', null)
		gdc_loading.style('display', 'none')
		gdc_args.bam_files = [] //empty bam_files array after each gdc api call
		if (bam_info.error) {
			cmt(bam_info.error, 1)
			baminfo_div.style('display', 'none')
		} else if (bam_info.is_file_uuid) {
			// update file id to be suppliled to gdc bam query
			gdc_args.bam_files.push({ file_id: gdc_id })
			update_singlefile_table(bam_info.file_metadata)
			saydiv.style('display', 'none')
		} else if (bam_info.is_case_uuid || bam_info.is_case_id) {
			update_multifile_table(bam_info.file_metadata)
			saydiv.style('display', 'none')
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
			<li>All positions are hg38-based.</li>
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
		.text('submit')
		.on('click', () => {
			try {
				validateInputs(gdc_args, genomes[default_genome])
			} catch (e) {
				cmt(e, 1)
				return
			}
			// success
			formdiv.remove()
			saydiv.remove()
			submit_btn_div.remove()
			renderBamSlice(gdc_args, genomes[default_genome], visualdiv, hosturl)
		})

	function makeFormInput(fields) {
		const inputs = []
		for (const field of fields) {
			formdiv
				.append('div')
				.style('padding', '3px 10px')
				.text(field.title)

			const input = formdiv
				.append('input')
				.attr('size', field.size || 20)
				.style('padding', '3px 10px')
				.property('placeholder', field.placeholder || '')
				.on('change', () => {
					gdc_args[field.key] = input.property('value').trim()
				})
			inputs.push(input)
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

	autofill_url()

	function autofill_url() {
		// autofill input fields if supplied from url
		// format: ?gdc_id=<id>&gdc_pos=<coord>&gdc_var=<variant>
		// example: ?gdc_id=TCGA-44-6147&gdc_pos=chr9:5064699-5065299
		// TODO: can't auto upload file for gdc_token provided from url,
		// google suggests it's not possible because of security reason
		const urlp = url2map()
		if (urlp.has('gdc_id'))
			gdcid_input
				.property('value', urlp.get('gdc_id'))
				.node()
				.dispatchEvent(new Event('keyup'))

		if (urlp.has('gdc_pos'))
			position_input
				.property('value', urlp.get('gdc_pos'))
				.node()
				.dispatchEvent(new Event('change'))
		else if (urlp.has('gdc_var'))
			variant_input
				.property('value', urlp.get('gdc_var'))
				.node()
				.dispatchEvent(new Event('change'))
	}
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
	if (!obj.position && !obj.variant) throw ' position or variant is required'
	if (obj.position && typeof obj.position !== 'string') throw 'position is not string'
	if (obj.variant && typeof obj.variant !== 'string') throw 'Varitent is not string'
    const chr = (obj.position || obj.variant).split(/[:.>]/)[0]
    const [nocount, hascount] = contigNameNoChr2( genome, [chr])
    if (nocount+hascount==0) throw 'chromosome is not valid in position/variant input: ' + chr
    else if (nocount){
        // add chr to non-standard position or variant
        if (obj.position) obj.position = 'chr' + obj.position
        if (obj.variant) obj.variant = 'chr' + obj.variant
    }
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
        // TODO: identify and support GDC variant format e.g. chr19:g.7612022C>T
        // solution: arg.variant.split(/[:.>]|del|dup|ins|inv|con|ext/)
		const variant_str = args.variant.split(/[:.>]/)
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
	for (const file of args.bam_files) {
		const tk = {
			type: client.tkt.bam,
			name: file.track_name || 'sample bam slice',
			gdc: args.gdc_token + ',' + file.file_id,
			downloadgdc: 1,
			file: 'dummy_str'
		}
		if (args.variant) {
			tk.variants = []
			tk.variants.push(variant)
		}
		par.tklst.push(tk)
	}
	client.first_genetrack_tolist(genome, par.tklst)
	import('./block').then(b => {
		new b.Block(par)
	})
}
