import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { contigNameNoChr2 } from '#shared/common'
import urlmap from '#common/urlmap'
import { addGeneSearchbox, string2variant } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { init_tabs } from '#dom/toggleButtons'
import { default_text_color } from '#shared/common'
import { renderTable } from '#dom/table'
import { make_table_2col } from '#dom/table2col'

/*
TODO

SV_EXPAND: to be expanded to support SV review using subpanel

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
makeSubmitAndNoPermissionDiv
	validateInputs
	sliceBamAndRender
*/

const gdc_genome = 'hg38'
const variantFlankingSize = 60 // bp
const baminfo_rows = [
	{ title: 'Entity ID', key: 'entity_id' },
	{ title: 'Experimental Strategy', key: 'experimental_strategy' },
	{ title: 'Sample Type', key: 'sample_type' },
	{ title: 'Size', key: 'file_size' }
]

/*
arguments:

genomes{}
holder
debugmode=boolean

disableSSM=true
	temporary fix; to disable ssm query and selection for gdc phase9
	to reenable, simply delete all uses of this flag

hideTokenInput=true/false
	set to true in pp react wrapper that's integrated into gdc portal
	will be using cookie session id instead of token

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

Returns:

a public API object with callbacks
*/
export async function bamsliceui({
	genomes,
	holder,
	filter0,
	disableSSM = false,
	hideTokenInput = false,
	debugmode = false
}) {
	// public api obj to be returned
	const publicApi = {}

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

	const backBtnDiv = holder
		.append('div')
		.style('margin-left', '30px')
		.style('display', 'none')
	backBtnDiv
		.append('button')
		.html('&#171; Back to input form')
		.on('click', event => {
			backBtnDiv.style('display', 'none')
			blockHolder
				.style('display', 'none')
				.selectAll('*')
				.remove()
			formdiv.style('display', 'block')
		})

	const formdiv = holder.append('div').style('margin-left', '30px')

	const formtable = formdiv.append('table')
	// table with two columns
	// has two rows for inputting token and input string

	// show block & bam tk
	const blockHolder = holder.append('div').style('display', 'none')

	/////////////////////////////////////////////////////
	// create UI components in formdiv

	// upload toke file
	if (!hideTokenInput) makeTokenInput()

	// <input> to enter gdc id, and doms for display case/file info
	makeGdcIDinput()

	// make ssm/gene tab
	// returned div are used by searchSSM()

	const ssmGeneArg = {
		holder: formdiv
			.append('div')
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

	// submit button, "no permission" alert
	const [saydiv, noPermissionDiv] = makeSubmitAndNoPermissionDiv()

	//////////////////////// helper functions

	function makeTokenInput() {
		// make one <tr> with two cells
		const tr = formtable.append('tr')

		// cell 1
		tr.append('td').text('GDC token file')

		// cell 2
		const td = tr.append('td')
		const input = td.append('input').attr('type', 'file')
		const file_error_div = td
			.append('span')
			.style('margin-left', '20px')
			.style('display', 'none')
		input.on('change', event => {
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
		// make one <tr> with two cells
		const tr = formtable.append('tr')

		// cell 1
		tr.append('td').text('Enter search string')

		// cell 2
		const td = tr.append('td')

		const gdcid_input = td
			.append('input')
			.attr('type', 'search')
			.attr('size', 45)
			.attr('aria-label', 'Specify File name / File UUID / Case ID / Case UUID')
			.style('padding', '3px 10px')
			.property('placeholder', 'File name / File UUID / Case ID / Case UUID')
			// debounce event listener on keyup
			.on('keyup', debounce(gdc_search, 500))
			// clicking X in <input> fires "search" event. must listen to it and call callback without delay in order to clear the UI
			.on('search', gdc_search)

		if (urlp.has('gdc_id')) {
			gdcid_input
				.property('value', urlp.get('gdc_id'))
				.node()
				.dispatchEvent(new Event('keyup'))
		}

		const gdc_loading = td
			.append('span')
			.style('padding-left', '10px')
			.style('color', '#999')
			.style('display', 'none')
			.html('loading...')

		const gdcid_error_div = td
			.append('span')
			.style('display', 'none')
			.style('padding', '2px 5px')

		//////////////////////////
		// row 2, to display details of case/file
		const baminfo_div = formdiv
			.append('div')
			.style('display', 'none')
			.style('margin', '20px 20px 20px 40px')
		//.style('overflow', 'hidden')
		// either baminfo_table or bamselection_table is displayed
		// baminfo_table is a static table showing details about one bam file
		// bamselection_table lists multiple bam files available from a sample, allowing user to select some forslicing
		const baminfo_table = baminfo_div.append('div')
		const bamselection_table = baminfo_div.append('div')

		publicApi.update = _arg => {
			gdc_search(null, _arg?.filter0 || filter0)
		}

		async function gdc_search(eventNotUsed, filter) {
			/*
			first argument is "event" which is unused, as gdc_search() is used as event listener
			*/

			noPermissionDiv.style('display', 'none')

			// TODO explain usage of _filter0
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
				.style('display', 'block')
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

			const rows = []
			for (const row of baminfo_rows) {
				rows.push({
					k: row.title,
					v: row.url ? `<a href=${row.url}${onebam.file_uuid} target=_blank>${onebam[row.key]}</a>` : onebam[row.key]
				})
				file.about.push({ k: row.title, v: onebam[row.key] })
			}
			make_table_2col(baminfo_table, rows)
			/*
			baminfo_table
				.style('height', '0')
				.transition()
				.duration(500)
				// .style('height', '100px')
				.style('height', 'auto')
				*/
		}

		function update_multifile_table(files) {
			const columns = []
			for (const row of baminfo_rows) columns.push({ label: row.title })
			const rows = []
			for (const [i, onebam] of files.entries()) {
				const row = []
				for (const column of baminfo_rows) {
					if (column.url) {
						row.push({ html: `<a href=${row.url}${onebam.file_uuid} target=_blank>${onebam[row.key]}</a>` })
					} else {
						row.push({ value: onebam[column.key] })
					}
				}
				rows.push(row)
			}

			baminfo_div.style('display', 'block')
			bamselection_table
				.style('display', 'block')
				.selectAll('*')
				.remove()
			baminfo_table.style('display', 'none')
			renderTable({
				rows,
				columns,
				div: bamselection_table,
				noButtonCallback: (i, node) => {
					const onebam = files[i]
					if (node.checked) {
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
				}
			})
		}
	}

	async function makeSsmGeneSearch() {
		await init_tabs(ssmGeneArg)

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

		const variantsResults_div = ssmGeneArg.tabs[0].holder.append('div')

		const columns = []
		for (const column of ['Gene', 'AAChange', 'Consequence', 'Position']) columns.push({ label: column })

		// group by gene
		const gene2mlst = new Map()
		for (const m of data.mlst) {
			if (!gene2mlst.has(m.gene)) gene2mlst.set(m.gene, [])
			gene2mlst.get(m.gene).push(m)
		}
		const rows = []
		for (const [gene, mlst] of gene2mlst) {
			for (const m of mlst) {
				const row = []
				row.push({ value: gene, data: m })
				row.push({ value: m.mname })
				row.push({ value: m.consequence })
				row.push({ value: m.chr + ':' + m.pos + ' ' + m.ref + '>' + m.alt })
				rows.push(row)
			}
		}

		renderTable({
			rows,
			columns,
			div: variantsResults_div,
			noButtonCallback: (i, node) => {
				const m = rows[i][0].data
				gdc_args.ssmInput = {
					chr: m.chr,
					pos: m.pos - 1, // convert 1-based to 0-based
					ref: m.ref,
					alt: m.alt
				}
			},
			singleMode: true
		})
	}
	function makeSubmitAndNoPermissionDiv() {
		const tr = formdiv.append('table').append('tr') // one row with two cells

		// 1st <td> with submit button
		const button = tr
			.append('td')
			.append('button')
			.style('margin', '20px 20px 20px 40px')
			.style('padding', '10px 25px')
			.style('border-radius', '35px')
			.text('Submit')
			.on('click', async () => {
				try {
					saydiv.selectAll('*').remove()
					validateInputs(gdc_args, genome, hideTokenInput)
					button.text('Loading ...')
					button.property('disabled', true)
					await sliceBamAndRender(gdc_args, genome, blockHolder, debugmode)
					// bam is successfully sliced
					formdiv.style('display', 'none')
					backBtnDiv.style('display', 'block')
					blockHolder.style('display', 'block')
				} catch (e) {
					if (e == 'Permission denied') {
						// backend throws {error:'Permission denied'} to signal the display of this alert
						noPermissionDiv.style('display', 'block')
					} else {
						saydiv.selectAll('*').remove()
						sayerror(saydiv, e.message || e)
						if (e.stack) console.log(e.stack)
					}
				}
				// turn submit button back to active so ui can be reused later
				button.text('Submit')
				button.property('disabled', false)
			})

		// 2nd <td> as notification holder
		const td = tr.append('td')
		const saydiv = td.append('div')
		const noPermissionDiv = td
			.append('div')
			.style('display', 'none')
			.style('margin', '20px')
		noPermissionDiv
			.append('div')
			.text('Access Alert')
			.style('font-size', '1.5em')
			.style('opacity', 0.4)
		noPermissionDiv
			.append('div')
			.style('border-top', 'solid 1px #eee')
			.style('border-bottom', 'solid 1px #eee')
			.style('padding', '20px 0px')
			.style('margin-top', '5px')
			.html(
				'You are attempting to visualize a Sequence Read file that you are not authorized to access. Please request dbGaP Access to the project (click here for more information).'
			)
		return [saydiv, noPermissionDiv]
	}

	return publicApi
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
	if (!args.bam_files.length) throw 'No BAM file supplied'
	for (const file of args.bam_files) {
		if (!file.file_id) throw 'file uuid is missing'
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

async function sliceBamAndRender(args, genome, holder, debugmode) {
	// create arg for block init
	const par = {
		nobox: 1,
		genome,
		holder,
		debugmode
	}

	if (args.position) {
		par.chr = args.position.chr
		par.start = args.position.start
		par.stop = args.position.stop
	} else if (args.variant) {
		par.chr = args.variant.chr
		par.start = args.variant.pos - variantFlankingSize
		par.stop = args.variant.pos + variantFlankingSize
	} else {
		throw 'SV_EXPAND here'
	}

	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (args.gdc_token) {
		headers['X-Auth-Token'] = args.gdc_token
	}

	//////////////////////////////////////////////
	//
	// call backend to slice bam and write to cache file
	//
	//////////////////////////////////////////////
	for (const file of args.bam_files) {
		// file = {file_id}
		const lst = [
			'gdcFileUUID=' + file.file_id,
			'gdcFilePosition=' + par.chr + '.' + par.start + '.' + par.stop,
			// SV_EXPAND
			'regions=' + JSON.stringify([{ chr: par.chr, start: par.start, stop: par.stop }])
		]

		const gdc_bam_files = await dofetch3('tkbam?downloadgdc=1&' + lst.join('&'), { headers })
		if (gdc_bam_files.error) throw gdc_bam_files.error
		if (!Array.isArray(gdc_bam_files) || gdc_bam_files.length == 0) throw 'gdc_bam_files not non empty array'

		// This will need to be changed to a loop when viewing multiple regions in the same sample
		const { filesize } = gdc_bam_files[0]
		//tk.cloaktext.text('BAM slice downloaded. File size: ' + filesize)

		//block.gdcBamSliceDownloadBtn.style('display', 'inline-block')
		file.about.push({ k: 'Slice file size', v: filesize })
	}

	//////////////////////////////////////////////
	//
	// file slices are cached. launch block
	//
	//////////////////////////////////////////////
	par.tklst = []
	for (const file of args.bam_files) {
		const tk = {
			type: 'bam',
			name: file.track_name || 'sample bam slice',
			gdcToken: args.gdc_token,
			gdcFile: {
				uuid: file.file_id,
				// SV_EXPAND
				// tk remembers position for which slice is requested. this position is sent to backend to make the hashed cache file name persistent
				position: par.chr + '.' + par.start + '.' + par.stop
			},
			aboutThisFile: file.about
		}
		if (args.variant) {
			tk.variants = [args.variant]
		}
		par.tklst.push(tk)
	}
	first_genetrack_tolist(genome, par.tklst)
	const _ = await import('./block')
	new _.Block(par)
}
