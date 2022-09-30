import { debounce } from 'debounce'
import { dofetch3 } from '../common/dofetch'
import { sayerror } from '../dom/error'
import { first_genetrack_tolist } from '../common/1stGenetk'
import { contigNameNoChr2 } from '#shared/common'
import urlmap from '../common/urlmap'
import { addGeneSearchbox, string2variant } from '../dom/genesearch'
import { Menu } from '../dom/menu'
import { init_tabs_1 } from '../dom/toggleButtons'

/*
*********** gdc_args{}
gdc_args {}
	gdc_token: <string>,
	bam_files: [ {} ]
		file_id: file uuid from gdc <string>,
		track_name: used for naming of track <string> //optional
		about:[] // with keys corresponding to baminfo_rows[]
	case_id: <string>
	useSsmOrGene: 'ssm' or 'gene'
		identifies the choice of the SSM/Gene toggle button
		if value is ssm, will use ssmInput; otherwise check coordInput
	ssmInput:{}
		chr, pos, ref, alt
	coordInput:{}
		output obj from genesearch
# after validation, create position or variant used for launching tk
	position: {chr,start,stop}
	variant: {chr,pos,ref,alt}

changes to UI <input> are stored on this object
and is validated in validateInputs{}

************ functions
makeTokenInput
makeGdcIDinput
	gdc_search
		searchSSM
	update_singlefile_table
	update_multifile_table
makeSsmGeneSearch
	makeArg_geneSearchbox
	geneSearchInstruction
makeSubmit
	validateInputs
	renderBamSlice
*/

const gdc_genome = 'hg38'
const variantFlankingSize = 60 // bp
const baminfo_rows = [
	{ title: 'Entity ID', key: 'entity_id' },
	{ title: 'Entity Type', key: 'entity_type' },
	{ title: 'Experimental Strategy', key: 'experimental_strategy' },
	{ title: 'Sample Type', key: 'sample_type' },
	{ title: 'Size', key: 'file_size' }
]

/*
arguments:

genomes{}
holder
disableSSM=true
	temporary fix; to disable ssm query and selection for gdc phase9
	to reenable, simply delete all uses of this flag
hideTokenInput=true/false
	set to true in gdc react wrapper
filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries
*/
export async function bamsliceui({ genomes, holder, filter0, disableSSM = false, hideTokenInput = false }) {
	const genome = genomes[gdc_genome]
	if (!genome) throw 'missing genome for ' + gdc_genome

	// central obj, see comments on top
	const gdc_args = { bam_files: [] }
	const tip = new Menu({ padding: '' })

	// fill from url for quick testing: ?gdc_id=TCGA-44-6147&gdc_pos=chr9:5064699-5065299
	// unable to autoload toke file this way
	const urlp = urlmap()

	/////////////////////////////////////////////////////
	// there are 2 ui holders: formdiv and blockHolder
	// formdiv collects multiple rows
	// each row is for a ui input
	// formdiv will be cleared upon submission
	const backBtnDiv = holder.append('div').style('display', 'none')
	backBtnDiv
		.append('button')
		.html('&lt;&lt; back')
		.on('click', event => {
			backBtnDiv.style('display', 'none')
			blockHolder
				.style('display', 'none')
				.selectAll('*')
				.remove()
			formdiv.style('display', 'grid')
		})

	const formdiv = holder
		.append('div')
		.style('margin', '40px 20px 20px 20px')
		.style('display', 'grid')
		.style('grid-template-columns', '300px auto')
		.style('grid-template-rows', 'repeat(6, auto)')
		.style('gap', '5px')
		.style('align-items', 'center')
		.style('justify-items', 'left')

	// show block & bam tk
	const blockHolder = holder
		.append('div')
		.style('display', 'none')
		.style('margin', '20px')

	/////////////////////////////////////////////////////
	// create UI components in formdiv

	// for showing err
	const saydiv = formdiv.append('div').style('grid-column', 'span 2')
	const api = {}
	// upload toke file
	if (!hideTokenInput) makeTokenInput()

	// <input> to enter gdc id, and doms for display case/file info
	makeGdcIDinput()

	// make ssm/gene tab
	// returned div are used by searchSSM()

	const ssmGeneArg = {
		holder: formdiv
			.append('div')
			.style('grid-column', 'span 2')
			.style('padding', '3px 10px')
			.style('display', 'none'),
		tabs: [
			{
				width: 140,
				label: 'Select SSM',
				callback: event => {
					gdc_args.useSsmOrGene = 'ssm'
				}
				// .tab and .holder are automatically added
			},
			{
				width: 140,
				label: 'Gene or position',
				callback: event => {
					gdc_args.useSsmOrGene = 'gene'
				}
				// .tab and .holder are automatically added
			}
		]
		// .tabHolder is automatically added
	}
	await makeSsmGeneSearch()

	// submit button
	makeSubmit()

	//////////////////////// helper functions

	function makeTokenInput() {
		// col 1
		formdiv
			.append('div')
			.style('padding', '3px 10px')
			.text('GDC Token file')
		// col 2
		const upload_holder = formdiv.append('div')
		const upload_div = upload_holder.append('div').style('display', 'inline-block')
		const file_error_div = upload_holder
			.append('div')
			.style('display', 'none')
			.style('padding', '2px 5px')
		const input = upload_div
			.append('input')
			.attr('type', 'file')
			.on('change', event => {
				const file = event.target.files[0]
				if (!file) {
					input.property('value', '')
					return
				}
				if (!file.size) {
					input.property('value', '')
					show_input_check(file_error_div, 'Blank file ' + file.name)
					return
				}
				const reader = new FileReader()
				reader.onload = event => {
					const text = event.target.result.trim()
					if (text.length < 100) {
						input.property('value', '')
						show_input_check(file_error_div, 'Does not look like a toke file (content too short)')
						return
					}
					if (text.length > 1000) {
						input.property('value', '')
						show_input_check(file_error_div, 'Does not look like a toke file (content too long)')
						return
					}
					gdc_args.gdc_token = text
				}
				reader.onerror = function() {
					input.property('value', '')
					show_input_check(file_error_div, 'Error reading file ' + file.name)
					return
				}
				show_input_check(file_error_div)
				reader.readAsText(file, 'utf8')
			})

		setTimeout(() => input.node().focus(), 1100)
	}

	function makeGdcIDinput() {
		//////////////////////////
		// row 1, for <input>
		// col 1
		formdiv
			.append('div')
			.style('padding', '3px 10px')
			.text('Enter file name, file UUID, case ID, or case UUID')

		// col 2
		const gdcid_inputdiv = formdiv.append('div')

		const gdcid_input = gdcid_inputdiv
			.append('input')
			.attr('type', 'search')
			.attr('size', 40)
			.style('padding', '3px 10px')
			.property('placeholder', 'File name / File UUID / Case ID / Case UUID')
			.on('keyup', debounce(gdc_search, 500))
		if (urlp.has('gdc_id')) {
			gdcid_input
				.property('value', urlp.get('gdc_id'))
				.node()
				.dispatchEvent(new Event('keyup'))
		}

		const gdc_loading = gdcid_inputdiv
			.append('span')
			.style('padding-left', '10px')
			.style('color', '#999')
			.style('display', 'none')
			.html('loading...')

		const gdcid_error_div = gdcid_inputdiv
			.append('span')
			.style('display', 'none')
			.style('padding', '2px 5px')

		//////////////////////////
		// row 2, to display details of case/file
		const baminfo_div = formdiv
			.append('div')
			.style('grid-column', 'span 2')
			.style('display', 'none')
			.style('border-left', '1px solid #ccc')
			.style('margin', '20px 20px 20px 40px')
			.style('overflow', 'hidden')
		// either baminfo_table or bamselection_table is displayed
		// baminfo_table is a static table showing details about one bam file
		// bamselection_table lists multiple bam files available from a sample, allowing user to select some forslicing
		const baminfo_table = baminfo_div
			.append('div')
			.style('grid-template-columns', 'auto auto')
			// Fix for autosizing table height. No need to repeat rows
			// .style('grid-template-rows', 'repeat(15, 20px)')
			.style('align-items', 'center')
			.style('justify-items', 'left')

		const bamselection_table = baminfo_div
			.append('div')
			.style('grid-template-columns', 'repeat(6, auto)')
			.style('align-items', 'center')
			.style('justify-items', 'left')
			.style('overflow', 'scroll') //Fix for grid rows appearring defined area
			.style('max-height', '20vh')

		api.update = _arg => {
			gdc_search(null, _arg?.filter0 || filter0)
		}

		async function gdc_search(eventNotUsed, filter) {
			/*
			first argument is "event" which is unused, as gdc_search() is used as event listener
			*/
			const _filter0 = Object.keys(filter || {}).length ? filter : filter0 || null
			try {
				const gdc_id = gdcid_input.property('value').trim()
				if (!gdc_id.length) {
					baminfo_div.style('display', 'none')
					saydiv.style('display', 'none')
					gdcid_error_div.style('display', 'none')
					ssmGeneArg.holder.style('display', 'none')
					return
				}
				// disable input field and show 'loading...' until response returned from gdc api
				gdcid_input.attr('disabled', 1)
				gdc_loading.style('display', 'inline-block')
				const data = await dofetch3(
					`gdcbam?gdc_id=${gdc_id}${_filter0 ? '&filter0=' + encodeURIComponent(JSON.stringify(_filter0)) : ''}`
				)
				// enable input field and hide 'Loading...'
				gdcid_input.attr('disabled', null)
				gdc_loading.style('display', 'none')
				gdc_args.bam_files = [] //empty bam_files array after each gdc api call
				if (data.error) throw 'Error: ' + data.error
				if (!Array.isArray(data.file_metadata)) throw 'Error: .file_metadata[] missing'
				if (data.file_metadata.length == 0) throw 'No viewable BAM files found'
				/*
				in file_metadata[], each element is a bam file:
				{
					case_id: "9a2a226e-9605-4214-9320-469305e664e6"
					entity_id: "TCGA-49-AARQ-11A-21D-A413-08"
					entity_type: "aliquot"
					experimental_strategy: "WXS"
					file_size: "10.43 GB"
					file_uuid: "f383b776-b162-4c61-909b-3b92d1853511"
					sample_type: "Solid Tissue Normal"
				}

				record case_id for the found file
				if the array has multiple files, all are from the same case
				so the case_id should be the same for all files
				*/
				gdc_args.case_id = data.file_metadata[0].case_id
				await searchSSM(gdc_args.case_id)

				if (data.is_file_uuid || data.is_file_id) {
					// matches with one bam file
					// update file id to be supplied to gdc bam query
					update_singlefile_table(data, gdc_id)
					show_input_check(gdcid_error_div)
				} else if (data.is_case_uuid || data.is_case_id) {
					// matches with multiple bam files from a case
					update_multifile_table(data.file_metadata)
					show_input_check(gdcid_error_div)
				}
			} catch (e) {
				show_input_check(gdcid_error_div, e.message || e)
				baminfo_div.style('display', 'none')
				ssmGeneArg.holder.style('display', 'none')
			}
		}
		function update_singlefile_table(data, gdc_id) {
			// will update table display, and also insert element into gdc_args.bam_files[]
			baminfo_div.style('display', 'block')
			baminfo_table
				.style('display', 'grid')
				.selectAll('*')
				.remove()
			bamselection_table.style('display', 'none')

			const onebam = data.file_metadata[0]
			const file = {
				file_id: data.is_file_uuid ? gdc_id : onebam.file_uuid,
				track_name: onebam.entity_id, // assign track name as entity_id
				about: []
			}
			gdc_args.bam_files.push(file)

			for (const row of baminfo_rows) {
				baminfo_table
					.append('div')
					.style('padding', '3px 10px')
					.text(row.title)
					.style('opacity', 0.5)
				const d = baminfo_table.append('div').style('padding', '3px 10px')
				if (row.url) {
					d.html(`<a href=${row.url}${onebam.file_uuid} target=_blank>${onebam[row.key]}</a>`)
				} else {
					d.text(onebam[row.key])
				}
				file.about.push({ k: row.title, v: onebam[row.key] })
			}
			baminfo_table
				.style('height', '0')
				.transition()
				.duration(500)
				// .style('height', '100px')
				.style('height', 'auto')
		}

		function update_multifile_table(files) {
			baminfo_div.style('display', 'block')
			bamselection_table
				.style('display', 'grid')
				.selectAll('*')
				.remove()
			baminfo_table.style('display', 'none')

			bamselection_table.style('grid-template-rows', 'repeat(' + files.length + ', 20px)').append('div') //Placeholder div over checkboxes

			for (const row of baminfo_rows) {
				bamselection_table
					.append('div')
					.style('padding', '3px 10px')
					.text(row.title)
					.style('opacity', 0.5)
					.style('white-space', 'nowrap') //Fix for values overlapping on window resize
					.style('text-overflow', 'ellipsis')
					.style('overflow', 'hidden')
					.style('max-width', '10vw')
			}

			for (const onebam of files) {
				const wrapper = bamselection_table
					.append('label') //Creates a row wrapper where all text is clickable
					.style('display', 'contents')
					.style('white-space', 'nowrap')
					.style('overflow', 'hidden')
					.style('text-overflow', 'ellipsis')
					.style('max-width', '10vw')
					.style('background-clip', 'padding-box')
					.on('mouseenter', event => {
						wrapper.style('background-color', '#fcfcca')
					})
					.on('mouseleave', event => {
						wrapper.style('background-color', '')
					})
				const file_checkbox = wrapper
					// .append('div')
					.append('input')
					.style('padding', '3px 10px')
					.style('margin-left', '25px')
					.attr('type', 'checkbox')
					.on('change', event => {
						if (file_checkbox.node().checked) {
							gdc_args.bam_files.push({
								file_id: onebam.file_uuid,
								track_name: onebam.sample_type + ', ' + onebam.experimental_strategy + ', ' + onebam.entity_id,
								about: baminfo_rows.map(i => {
									return { k: i.title, v: onebam[i.key] }
								})
							})
						} else {
							// remove from array if checkbox unchecked
							gdc_args.bam_files = gdc_args.bam_files.filter(f => f.file_id != onebam.file_uuid)
						}
					})
				for (const row of baminfo_rows) {
					const d = wrapper
						// const d = bamselection_table
						.append('div')
						.style('padding', '3px 10px')
						.style('background', 'inherit')
					if (row.url) {
						d.html(`<a href=${row.url}${onebam.file_uuid} target=_blank>${onebam[row.key]}</a>`)
					} else {
						d.text(onebam[row.key])
					}
				}
			}

			bamselection_table
				.style('height', '0')
				.transition()
				.duration(500)
				.style('height', 'auto')
				.style('max-height', '20vh')
			// .style('height', files.length * 24 + 'px') //Creates a gap between the 2nd to last and last row
		}
	}

	async function makeSsmGeneSearch() {
		await init_tabs_1(ssmGeneArg)

		// argument for making search box
		// gene searchbox is created in 2nd tab holder
		const geneHolder = ssmGeneArg.tabs[1].holder
		ssmGeneArg.noSsmMessageInGeneHolder = geneHolder
			.append('div')
			.text('No variant found for this case.')
			.style('margin-bottom', '10px')
			.style('opacity', 0.4)
			.style('display', 'none')

		const geneSearchRow = geneHolder
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', '300px auto')
		geneSearchRow.append('div').text('Enter gene, position, SNP, or variant')

		// create gene search box
		gdc_args.coordInput = addGeneSearchbox(await makeArg_geneSearchbox(geneSearchRow))

		geneSearchInstruction(geneHolder)

		ssmGeneArg.tabs[0].holder
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(auto-fit, 1fr)')
			.style('overflow-y', 'auto')
			.style('max-height', '30vw')
	}

	async function makeArg_geneSearchbox(div) {
		const opt = {
			genome,
			tip,
			row: div.append('div'),
			allowVariant: true
		}
		if (urlp.has('gdc_pos')) {
			const t = urlp.get('gdc_pos').split(/[:\-]/)
			if (t.length == 3) {
				opt.defaultCoord = {
					chr: t[0],
					start: Number(t[1]),
					stop: Number(t[2])
				}
			}
		} else if (urlp.has('gdc_var')) {
			const variant = await string2variant(urlp.get('gdc_var'), genome)
			if (variant) {
				opt.defaultCoord = variant
			}
		}
		return opt
	}

	async function searchSSM(case_id) {
		// got case, turn on div and search for ssm

		// delete previous search result
		delete gdc_args.ssmInput
		// turn holder visible
		ssmGeneArg.holder.style('display', 'block')

		if (disableSSM) {
			ssmGeneArg.tabs[1].tab.node().click()
			ssmGeneArg.tabHolder.style('display', 'none')
			return
		}

		ssmGeneArg.tabs[0].holder.selectAll('*').remove()
		ssmGeneArg.tabs[0].tab.text('Loading')
		const data = await dofetch3(`gdc_ssms?case_id=${case_id}&genome=${gdc_genome}`)
		if (data.error) throw data.error
		if (data.mlst.length == 0) {
			// clear holder
			ssmGeneArg.tabs[1].tab.node().click()
			ssmGeneArg.tabHolder.style('display', 'none')
			ssmGeneArg.noSsmMessageInGeneHolder.style('display', 'block')
			return
		}
		// found ssms, display
		ssmGeneArg.tabHolder.style('display', 'block')
		ssmGeneArg.noSsmMessageInGeneHolder.style('display', 'none')
		ssmGeneArg.tabs[0].tab.text(`${data.mlst.length} variant${data.mlst.length > 1 ? 's' : ''}`)

		const variantsResults_div = ssmGeneArg.tabs[0].holder
			.append('div')
			// Creates the wrapper for the variant result rows
			// Maintains the height and scroll bars
			.style('overflow', 'scroll')
			.style('max-height', '30vw')

		function addRow() {
			// Creates the rows with the positions 'fixed'
			// Use rows for event listeners
			const row = variantsResults_div
				.append('div')
				.style('display', 'grid')
				.style('grid-template-columns', '2vw minmax(8vw,10vw) minmax(10vw,15vw) minmax(10vw,15vw) minmax(10vw,15vw)')
				.style('gap', '5px')
				.style('padding', '0.3em')
				.style('align-items', 'center')
				.style('justify-content', 'left')
			return row
		}

		// header
		{
			const row = addRow()
			row
				.style('position', 'sticky')
				.style('background-color', 'white')
				.style('top', '0')
			for (const h of ['', 'Gene', 'AAChange', 'Consequence', 'Position']) {
				row
					.append('div')
					.style('top', '0')
					.style('opacity', 0.3)
					.text(h)
			}
		}

		// group by gene
		const gene2mlst = new Map()
		for (const m of data.mlst) {
			if (!gene2mlst.has(m.gene)) gene2mlst.set(m.gene, [])
			gene2mlst.get(m.gene).push(m)
		}

		let i = 1
		for (const [gene, mlst] of gene2mlst) {
			let first = true
			for (const m of mlst) {
				m.row = addRow()
				m.row
					.append('div')
					.text(i++)
					.style('font-size', '.7em')
					.style('color', '#b0aeae') //Fix for numbers appearing over sticky header
				m.row
					.append('div')
					.text(first ? gene : '')
					.style('font-style', 'italic')
					.style('white-space', 'nowrap') //Fix for value overlapping position on small screen
					.style('overflow', 'hidden')
					.style('text-overflow', 'ellipsis')
				m.row
					.append('div')
					.style('white-space', 'nowrap') //Fix for value overlapping consequence on small screen
					.style('overflow', 'hidden')
					.style('text-overflow', 'ellipsis')
					.text(m.mname)
				m.row
					.append('div')
					.text(m.consequence)
					.style('font-size', '.8em')
					.style('white-space', 'nowrap') //Fix for value overlapping position on small screen
					.style('overflow', 'hidden')
					.style('text-overflow', 'ellipsis')
				m.row
					.append('div')
					.style('font-size', '.8em')
					.style('color', '#b0aeae') //Fix for numbers appearing over sticky header
					.text(m.chr + ':' + m.pos + ' ' + m.ref + '>' + m.alt)
				first = false

				m.row.on('mouseover', event => {
					if (!m.isClicked) m.row.style('background-color', '#fcfcca')
				})
				m.row.on('mouseout', event => {
					if (!m.isClicked) m.row.style('background-color', '')
				})
				m.row.on('click', event => {
					for (const m2 of data.mlst) {
						m2.isClicked = false
						m2.row.style('background-color', '')
					}
					m.isClicked = true
					m.row.style('background-color', '#ffe3e4')
					gdc_args.ssmInput = {
						chr: m.chr,
						pos: m.pos - 1, // convert 1-based to 0-based
						ref: m.ref,
						alt: m.alt
					}
				})
			}
		}
	}
	function makeSubmit() {
		formdiv
			.append('div')
			.style('grid-column', 'span 2')
			.append('button')
			.style('margin', '20px 20px 20px 100px')
			.style('padding', '5px 15px')
			.style('border-radius', '15px')
			.text('Submit')
			.on('click', event => {
				try {
					validateInputs(gdc_args, genome, hideTokenInput)
				} catch (e) {
					sayerror(saydiv, e.message || e)
					if (e.stack) console.log(e.stack)
					return
				}
				// success
				formdiv.style('display', 'none')
				backBtnDiv.style('display', '')
				blockHolder.style('display', '')
				renderBamSlice(gdc_args, genome, blockHolder)
			})
	}

	return api
}

function geneSearchInstruction(d) {
	d.append('div').style('opacity', 0.6).html(`<ul>
		<li>Enter gene, position, SNP, or variant.
		The BAM file will be sliced at the given position and visualized.</li>
		<li>Position</li>
		<ul><li>Example: chr17:7676339-7676767</li>
		    <li>Coordinates are hg38 and 1-based.</li>
		</ul>
		<li>SNP example: rs1641548</li>
		<li>Variant:</li>
		<ul>
		  <li>Example: chr2.208248388.C.T</li>
		  <li>Fields are separated by periods. Coordinate is hg38 and 1-based. Reference and alternate aleles are on forward strand.</li>
		</ul>
		<li>Supported HGVS formats for variants:</li>
		<ul>
		  <li>SNV: chr2:g.208248388C>T</li>
		  <li>MNV: chr2:g.119955155_119955159delinsTTTTT</li>
		  <li>Insertion: chr5:g.171410539_171410540insTCTG</li>
		  <li>Deletion: chr10:g.8073734delTTTAGA</li>
		</ul>
		</ul>`)
}

function show_input_check(holder, error_msg) {
	// if error_msg was supplied it will appear as red next to input field
	// if error_msg is not supplied, check mark will appear next to field after entering value
	holder
		.style('display', 'inline-block')
		.style('color', error_msg ? 'red' : 'green')
		.html(error_msg ? '&#10060; ' + error_msg : '&#10003;')
}

function validateInputs(args, genome, hideTokenInput = false) {
	if (!hideTokenInput) {
		if (!args.gdc_token) throw 'GDC token missing'
		if (typeof args.gdc_token !== 'string') throw 'GDC token is not string'
	}
	if (!args.bam_files.length) throw 'no bam file supplied'
	for (const file of args.bam_files) {
		if (!file.file_id) throw ' file uuid is missing'
		if (typeof file.file_id !== 'string') throw 'file uuid is not string'
	}

	if (args.useSsmOrGene == 'ssm') {
		const s = args.ssmInput
		if (!s) throw 'No variant selected'
		if (!s.chr) throw 'ssmInput.chr missing'
		if (!Number.isInteger(s.pos)) throw 'ssmInput.pos not integer'
		if (!s.ref) throw 'ssmInput.ref missing'
		if (!s.alt) throw 'ssmInput.alt missing'
		args.variant = s
		return
	}
	// using coordInput
	const ci = args.coordInput
	if (!ci.chr) throw 'No valid position or variant was entered'
	const [nocount, hascount] = contigNameNoChr2(genome, [ci.chr])
	if (nocount + hascount == 0) throw 'Invalid chromosome name: ' + ci.chr
	const chr = nocount ? 'chr' + ci.chr : ci.chr
	if (Number.isInteger(ci.pos)) {
		// is variant
		if (!ci.ref) throw 'Reference allele missing from variant string'
		if (!ci.alt) throw 'Alternative allele missing from variant string'
		args.variant = {
			chr,
			pos: ci.pos - 1, // convert 1-based to 0-based
			ref: ci.ref,
			alt: ci.alt
		}
	} else {
		// is range
		if (!Number.isInteger(ci.start) || !Number.isInteger(ci.stop)) throw 'non-integer start/stop'
		args.position = {
			chr,
			start: ci.start,
			stop: ci.stop
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
		par.start = args.variant.pos - variantFlankingSize
		par.stop = args.variant.pos + variantFlankingSize
	}

	par.tklst = []
	for (const file of args.bam_files) {
		const tk = {
			type: 'bam',
			name: file.track_name || 'sample bam slice',
			gdcToken: args.gdc_token,
			gdcFile: {
				uuid: file.file_id,
				position: par.chr + '.' + par.start + '.' + par.stop
			},
			downloadgdc: true,
			aboutThisFile: file.about
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
