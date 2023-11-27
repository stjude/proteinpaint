import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { contigNameNoChr2, mclass } from '#shared/common'
import urlmap from '#common/urlmap'
import { addGeneSearchbox, string2variant } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { Tabs } from '#dom/toggleButtons'
import { renderTable } from '#dom/table'
import { make_table_2col } from '#dom/table2col'

/*

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
		if stream2download=true, "unmapped" will be added as a new option
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
	queryCaseFileList
	gdc_search
		makeSsmGeneSearch
			temp_renderGeneSearch
			temp_renderSsmList
	update_singlefile_table
	update_multifile_table
	makeArg_geneSearchbox
	geneSearchInstruction
makeSubmitAndNoPermissionDiv
	validateInputs
	sliceBamAndRender

**************** url parameters
gdc_id=TCGA-06-0211
gdc_ssm=E17K
gdc_var=chr14:g.104780214C>T
gdc_pos=chr7:55153818-55156225

*/

const tip = new Menu({ padding: '' })
const gdc_genome = 'hg38'
const gdcDslabel = 'GDC' // hardcoded in multiple places
const variantFlankingSize = 60 // bp
const baminfo_rows = [
	{ title: 'Entity ID', key: 'entity_id' },
	{ title: 'Experimental Strategy', key: 'experimental_strategy' },
	{ title: 'Sample Type', key: 'sample_type' },
	{ title: 'Size', key: 'file_size', width: '10vw' }
]
const noPermissionMessage =
	'You are attempting to visualize a Sequence Read file that you are not authorized to access. Please request dbGaP Access to the project (<a href=https://gdc.cancer.gov/access-data/obtaining-access-controlled-data target=_blank>click here for more information</a>).'

/*
Arguments:

genomes{}
holder
debugmode=boolean
hideTokenInput=true/false
	set to true in pp react wrapper that's integrated into gdc portal
	will be using cookie session id instead of token
filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries
callbackOnRender()
	optional callback for ui testing
stream2download=boolean
	if true, run the app in "bam slice download" mode..


** all above arguments are accessible to all helper functions **


Returns:
	a public API object with callbacks
*/
export async function bamsliceui({
	genomes,
	holder,
	filter0,
	hideTokenInput = false,
	callbackOnRender,
	stream2download = false,
	debugmode = false
}) {
	// public api obj to be returned
	const publicApi = {}

	const genome = genomes[gdc_genome]
	if (!genome) throw 'missing genome for ' + gdc_genome

	// central obj, see comments on top
	const gdc_args = { bam_files: [] }

	// fill from url for quick testing: ?gdc_id=TCGA-44-6147&gdc_pos=chr9:5064699-5065299
	// unable to autoload toke file this way
	const urlp = urlmap()

	/////////////////////////////////////////////////////
	// there are 2 ui holders: formdiv and blockHolder
	// formdiv collects multiple rows
	// each row is for a ui input
	// formdiv will be cleared upon submission

	const backBtnDiv = holder.append('div').style('margin-left', '30px').style('display', 'none')
	backBtnDiv
		.append('button')
		.html('&#171; Back to input form')
		.on('click', () => {
			backBtnDiv.style('display', 'none')
			blockHolder.style('display', 'none').selectAll('*').remove()
			formdiv.style('display', 'block')
		})

	const formdiv = holder.append('div').style('margin-left', '30px')

	const formDiv = formdiv.append('div')
	// table with two columns
	// has two rows for inputting token and input string

	// show block & bam tk
	const blockHolder = holder.append('div').style('display', 'none')

	/////////////////////////////////////////////////////
	// create UI components in formdiv

	// upload toke file
	if (!hideTokenInput) makeTokenInput()

	// <input> to enter gdc id, and doms for display case/file info
	const gdcid_input = await makeGdcIDinput()

	// hold toggle ui for ssm list and gene search
	// contents are only rendered here after a case/file is found via gdc_search()
	const ssmGeneDiv = formdiv.append('div').style('padding', '3px 10px').style('display', 'none')

	// submit button, "no permission" alert
	const [submitButton, saydiv, noPermissionDiv] = makeSubmitAndNoPermissionDiv()

	if (typeof callbackOnRender == 'function') {
		callbackOnRender(publicApi)
	}

	if (urlp.has('gdc_id')) {
		gdcid_input.property('value', urlp.get('gdc_id')).node().dispatchEvent(new Event('keyup'))
	}

	//////////////////////// helper functions

	function makeTokenInput() {
		// make one <tr> with two cells
		const tr = formDiv.insert('div')

		// cell 1
		tr.insert('div').style('display', 'inline-block').style('width', '15vw').text('GDC token file')

		// cell 2
		const td = tr.insert('div').style('display', 'inline-block')
		const input = td.append('input').attr('type', 'file').attr('aria-label', 'GDC token file')

		const file_error_div = td.append('span').style('margin-left', '20px').style('display', 'none')
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
			reader.onerror = function () {
				input.property('value', '')
				show_input_check(file_error_div, 'Error reading file ' + file.name)
				return
			}
			show_input_check(file_error_div)
			reader.readAsText(file, 'utf8')
		})

		setTimeout(() => input.node().focus(), 1100)
	}

	async function makeGdcIDinput() {
		// make one <tr> with two cells
		const tr = formDiv.insert('div')

		// cell 1
		tr.append('div')
			.style('display', 'inline-block')
			.style('width', '15vw')
			.style('padding-top', '5px')
			.text('Enter search string')
			.style('vertical-align', 'top')

		// cell 2
		const td = tr.append('div').style('display', 'inline-block')

		const gdcid_input = td
			.append('input')
			.attr('type', 'search')
			.attr('size', 45)
			.attr('aria-label', 'Specify File name / File UUID / Case ID / Case UUID')
			.style('padding', '3px 10px')
			.property('placeholder', 'File name / File UUID / Case ID / Case UUID')
			.attr('class', 'sja-gdcbam-input') // for testing
			// debounce event listener on keyup
			.on('keyup', debounce(gdc_search, 500))
			// clicking X in <input> fires "search" event. must listen to it and call callback without delay in order to clear the UI
			.on('search', gdc_search)

		const gdc_loading = td
			.append('span')
			.style('padding-left', '10px')
			.style('color', '#999')
			.style('display', 'none')
			.html('loading...')

		const gdcid_error_div = td.append('span').style('display', 'none').style('padding', '2px 5px')

		td.append('br') // add line break from input box
		const listCaseFileHandle = td
			.append('div')
			.style('margin', '5px')
			.style('display', 'inline-block')
			.text('Loading...')
		queryCaseFileList(listCaseFileHandle)

		const userHasNoAccessDiv = td
			.append('div')
			.style('display', 'none')
			.style('width', '500px')
			.style('margin', '20px 3px')
			.html(noPermissionMessage)

		//////////////////////////
		// row 2, to display details of case/file
		const baminfo_div = formdiv.append('div').style('display', 'none').style('margin', '20px 20px 20px 40px')
		// either baminfo_table or bamselection_table is displayed
		// baminfo_table is a static table showing details about one bam file
		// bamselection_table lists multiple bam files available from a sample, allowing user to select some forslicing
		const baminfo_table = baminfo_div.append('div').attr('class', 'sja-gdcbam-onefiletable').style('display', 'none')
		const bamselection_table = baminfo_div
			.append('div')
			.attr('class', 'sja-gdcbam-multifiletable')
			.style('display', 'none')

		// the update() will be called in pp react wrapper, when user changes cohort from gdc ATF
		publicApi.update = _arg => {
			gdc_search(null, _arg?.filter0 || filter0)
			queryCaseFileList(listCaseFileHandle, _arg?.filter0 || filter0)
		}

		/* arguments
		eventNotUsed: d3v7 passes "event" as first argument which is unused, as gdc_search() is used as event listener
		filter0override: new updated gdc filter object, to replace existing filter0
		*/
		async function gdc_search(eventNotUsed, filter0override) {
			saydiv.selectAll('*').remove()
			noPermissionDiv.style('display', 'none')
			submitButton.style('display', 'inline-block')

			const _filter0 = Object.keys(filter0override || {}).length ? filter0override : filter0 || null

			try {
				const gdc_id = gdcid_input.property('value').trim()
				if (!gdc_id.length) {
					baminfo_div.style('display', 'none')
					saydiv.selectAll('*').remove()
					gdcid_error_div.style('display', 'none')
					ssmGeneDiv.style('display', 'none')
					return
				}

				// disable input field and show 'loading...' until response returned from gdc api
				gdcid_input.attr('disabled', 1)
				gdc_loading.style('display', 'inline-block')

				const body = { gdc_id }
				if (_filter0) body.filter0 = _filter0
				const data = await dofetch3('gdcbam', { body })
				/* data = {
					file_metadata:[]
					is_case_id:true
					is_case_uuid:true
					is_file_uuid:true
					is_file_id:true
					numFilesSkippedByWorkflow:int
				}
				*/

				gdcid_input.attr('disabled', null) // enable input field
				gdc_loading.style('display', 'none') // hide loading
				gdc_args.bam_files = [] //empty bam_files array after each gdc api call

				/////////////////////////////////
				// possible exists before rendering ssm and gene ui

				if (data.error) throw 'Error: ' + data.error
				if (!Array.isArray(data.file_metadata)) throw 'Error: .file_metadata[] missing'
				if (data.file_metadata.length == 0) {
					// no viewable bam files
					if (data.is_file_uuid && data.numFilesSkippedByWorkflow == 1) {
						// query is a file uuid which is skipped by workflow
						throw 'File not viewable due to workflow type'
					}
					throw 'No viewable BAM files found'
				}

				// in react wrapper of gdc, session id is available from cookie, if so backend checks user's access to this bam
				// and if no access sets this flag
				// will show the prompt here but will still allow rest of ui to show, just to showcase app's capability
				userHasNoAccessDiv.style('display', data.userHasNoAccess ? 'block' : 'none')

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

				await makeSsmGeneSearch()
			} catch (e) {
				show_input_check(gdcid_error_div, e.message || e)
				baminfo_div.style('display', 'none')
				ssmGeneDiv.style('display', 'none')
			}
		}
		function update_singlefile_table(data, gdc_id) {
			// will update table display, and also insert element into gdc_args.bam_files[]
			baminfo_div.style('display', 'block')
			baminfo_table.style('display', 'block').selectAll('*').remove()
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
		}

		function update_multifile_table(files) {
			const columns = baminfo_rows.map(i => {
				return { label: i.title, width: i.width }
			})
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
			bamselection_table.style('display', 'block').selectAll('*').remove()
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
		return gdcid_input
	}

	async function queryCaseFileList(handle, filter0override) {
		const _filter0 = Object.keys(filter0override || {}).length ? filter0override : filter0 || null
		const body = {}
		if (_filter0) body.filter0 = _filter0
		const data = await dofetch3('gdcbam', { body }) // query same route without case_id
		if (data.error) return handle.text(data.error)
		if (typeof data.case2files != 'object') return handle.text('wrong return')
		// data = { case2files={}, total=int, loaded=int }
		if (data.total < data.loaded) handle.text(`Or, browse ${data.total} BAM files`)
		else handle.text(`Or, browse first ${data.loaded} BAM files out of ${data.total} total`)
		handle.attr('class', 'sja_clbtext').on('click', event => {
			const div = tip
				.clear()
				.showunder(event.target)
				.d.append('div')
				.style('margin', '10px')
				.style('overflow-y', 'scroll')
				.style('height', '300px')
				.style('resize', 'vertical')
			const table = div.append('table').style('border-spacing', '0px')
			// header row that stays
			const tr = table
				.append('tr')
				.style('position', 'sticky')
				.style('top', '0px')
				.style('background-color', 'white')
				.style('color', '#aaa')
				.style('font-size', '.7em')
			tr.append('td').text('CASE')
			tr.append('td').text('BAM FILES, SELECT ONE TO VIEW')
			for (const caseName in data.case2files) {
				const tr = table.append('tr').attr('class', 'sja_clb_gray')
				tr.append('td').style('vertical-align', 'top').style('color', '#888').text(caseName)
				const td2 = tr.append('td')
				for (const f of data.case2files[caseName]) {
					// f { sample_type, experimental_strategy, file_size, file_uuid }
					td2
						.append('div')
						.attr('class', 'sja_clbtext')
						.html(`${f.sample_type}, ${f.experimental_strategy} <span style="font-size:.8em">${f.file_size}</span>`)
						.on('click', () => {
							tip.hide()
							gdcid_input.property('value', f.file_uuid).node().dispatchEvent(new Event('keyup'))
						})
				}
			}
		})
	}

	// this is called after a file/case is found
	// case id is at gdc_args.case_id
	// query ssm associated with the case, show ssm/gene toggle ui
	async function makeSsmGeneSearch() {
		delete gdc_args.ssmInput // delete previous search result
		ssmGeneDiv
			.style('display', 'block') // turn holder visible
			.selectAll('*')
			.remove() // clear holder, including ssm from previous case

		const mutationMsgDiv = ssmGeneDiv.append('p').text('Searching for mutations...')

		// TODO to return all types of alterations for this case (ssm, cnv, fusion)
		const data = await dofetch3('gdc_ssms', {
			body: { case_id: gdc_args.case_id, genome: gdc_genome, dslabel: gdcDslabel }
		})
		if (data.error) throw data.error

		////////////////////////////////////////////////////////
		// remaining of this function will be rewritten using block instance
		// and no longer uses toggle and gene search

		const ssmLst = data.mlst.filter(m => m.dt == 1) // for now filter to only ssm, exclude cnv

		if (ssmLst.length == 0) {
			mutationMsgDiv.text('No mutations from this case.')
			await temp_renderGeneSearch(ssmGeneDiv.append('div'))
			return
		}

		// found ssms
		mutationMsgDiv.remove()
		// display toggle between ssm list and gene search
		const tabs = [
			{
				label: `${ssmLst.length} variants${data.dt2total?.[0] ? ' (' + data.dt2total[0].total + ' total)' : ''}`,
				callback: event => {
					gdc_args.useSsmOrGene = 'ssm'
				}
			},
			{
				label: 'Gene or position',
				callback: event => {
					gdc_args.useSsmOrGene = 'gene'
				}
			}
		]

		if (stream2download) {
			tabs.push({
				label: 'Unmapped reads',
				callback: () => (gdc_args.useSsmOrGene = 'unmapped')
			})
		}

		new Tabs({ holder: ssmGeneDiv, tabs }).main()

		temp_renderSsmList(tabs[0].contentHolder, ssmLst)
		await temp_renderGeneSearch(tabs[1].contentHolder)
	}

	// to be replaced by block ui
	function temp_renderSsmList(div, mlst) {
		const columns = [
			{ label: 'Gene', width: '10vw' },
			{ label: 'Mutation' },
			{ label: 'Consequence' },
			{ label: 'Position' }
		]

		const gene2mlst = new Map() // group by gene
		for (const m of mlst) {
			if (!gene2mlst.has(m.gene)) gene2mlst.set(m.gene, [])
			gene2mlst.get(m.gene).push(m)
		}
		const rows = []
		for (const [gene, mlst] of gene2mlst) {
			for (const m of mlst) {
				const row = []
				row.push({ value: gene, data: m })
				row.push({ value: m.mname })
				row.push({ value: mclass[m.class]?.label || 'Unknown' })
				row.push({ value: m.chr + ':' + m.pos + ' ' + m.ref + '>' + m.alt })
				rows.push(row)
			}
		}

		renderTable({
			rows,
			columns,
			div,
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

		if (urlp.has('gdc_ssm')) {
			// a quick fix. update later when table accepts array index of item selected by default
			for (const [gene, mlst] of gene2mlst) {
				for (const m of mlst) {
					// should send array index of selected item to renderTable() to auto check radio button
					if (m.mname == urlp.get('gdc_ssm')) {
						gdc_args.ssmInput = {
							chr: m.chr,
							pos: m.pos - 1, // convert 1-based to 0-based
							ref: m.ref,
							alt: m.alt
						}
					}
				}
			}
		}
	}
	async function temp_renderGeneSearch(div) {
		const geneSearchRow = div.append('div').style('display', 'grid').style('grid-template-columns', '300px auto')
		geneSearchRow.append('div').text('Enter gene, position, SNP, or variant')

		// create gene search box
		gdc_args.coordInput = addGeneSearchbox(await makeArg_geneSearchbox(geneSearchRow))

		geneSearchInstruction(div)
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

	function makeSubmitAndNoPermissionDiv() {
		const div = formdiv.append('div')

		// 1st <td> with submit button
		const submitButton = div
			.insert('div')
			.style('display', 'inline-block')
			.append('button')
			.style('margin', '20px 20px 20px 40px')
			.style('padding', '10px 25px')
			.style('border-radius', '35px')
			.text('Submit')
			.on('click', async () => {
				try {
					saydiv.selectAll('*').remove()
					validateInputs(gdc_args, genome, hideTokenInput)
					submitButton.text('Loading ...')
					submitButton.property('disabled', true)
					await sliceBamAndRender()
				} catch (e) {
					if (e == 'Permission denied') {
						// backend throws {error:'Permission denied'} to signal the display of this alert
						noPermissionDiv.style('display', 'inline-block')
						submitButton.style('display', 'none')
					} else {
						saydiv.selectAll('*').remove()
						sayerror(saydiv, e.message || e)
						if (e.stack) console.log(e.stack)
					}
				}
				// turn submit button back to active so ui can be reused later
				submitButton.text('Submit')
				submitButton.property('disabled', false)
			})

		// 2nd <td> as notification holder
		const saydiv = div.insert('div').style('display', 'inline-block')
		const noPermissionDiv = div.insert('div').style('display', 'none').style('margin', '20px')
		noPermissionDiv.append('div').text('Access Alert').style('font-size', '1.5em').style('opacity', 0.4)
		noPermissionDiv
			.append('div')
			.style('border-top', 'solid 1px #eee')
			.style('border-bottom', 'solid 1px #eee')
			.style('padding', '20px 0px')
			.style('margin-top', '5px')
			.html(noPermissionMessage)
		return [submitButton, saydiv, noPermissionDiv]
	}

	async function sliceBamAndRender() {
		const args = gdc_args

		// create arg for block init
		const par = {
			nobox: 1,
			genome,
			holder: blockHolder,
			debugmode
		}

		if (args.useSsmOrGene == 'unmapped') {
			/* when this option is in use, app must be running in "download mode"
			even if par is block param, it's fine to skip chr/start/stop on it
			as later it will not reach visualization step and will not instantiate a block
			*/
			par.unmapped = 1
		} else {
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
		for (const [idx, file] of args.bam_files.entries()) {
			// file = {file_id,track_name,about[]}

			submitButton.text(`Slicing BAM file ${idx + 1} of ${args.bam_files.length}...`)

			// translate par{} into request body
			const body = {
				downloadgdc: 1,
				gdcFileUUID: file.file_id
			}

			if (par.unmapped) {
				body.gdcFilePosition = 'unmapped'
				body.unmapped = 1
			} else {
				body.gdcFilePosition = par.chr + ':' + par.start + '-' + par.stop
				// SV_EXPAND
				body.regions = [{ chr: par.chr, start: par.start, stop: par.stop }]
			}

			if (stream2download) {
				// detour
				// TODO support unmapped in this mode
				body.stream2download = true
				const data = await dofetch3('tkbam', { headers, body })
				if (data.error) throw data.error

				// download the file to client
				const a = document.createElement('a')
				a.href = URL.createObjectURL(data)
				if (par.unmapped) {
					a.download = file.track_name + '.unmapped.bam'
				} else {
					a.download = `${file.track_name}.${par.chr}.${par.start}.${par.stop}.bam`
				}
				a.style.display = 'none'
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)

				return
			}

			const gdc_bam_files = await dofetch3('tkbam', { headers, body })
			if (gdc_bam_files.error) throw gdc_bam_files.error
			if (!Array.isArray(gdc_bam_files) || gdc_bam_files.length == 0) throw 'gdc_bam_files not non empty array'

			// This will need to be changed to a loop when viewing multiple regions in the same sample
			const { filesize } = gdc_bam_files[0]

			{
				// update file size
				const i = file.about.find(i => i.k == 'Slice file size')
				if (i) {
					// this file has been sliced before and already has the record; do not add duplicate record
					i.v = filesize
				} else {
					// this file does not have the record
					file.about.push({ k: 'Slice file size', v: filesize })
				}
			}
		}

		formdiv.style('display', 'none')
		backBtnDiv.style('display', 'block')
		blockHolder.style('display', 'block')

		//////////////////////////////////////////////
		//
		// file slices are cached. launch block
		//
		//////////////////////////////////////////////
		par.tklst = []
		for (const file of args.bam_files) {
			const tk = {
				type: 'bam',
				name: file.track_name || 'Sample BAM slice',
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
		<li>SNP example: rs28934574</li>
		<li>Variant:</li>
		<ul>
		  <li>Example: chr2.208248388.C.T</li>
		  <li>Fields are separated by periods. Coordinate is hg38 and 1-based. Reference and alternative alleles are on forward strand.</li>
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
	if (!args.bam_files.length) throw 'No BAM file selected'
	for (const file of args.bam_files) {
		if (!file.file_id) throw 'file uuid is missing'
		if (typeof file.file_id !== 'string') throw 'file uuid is not string'
	}

	if (args.useSsmOrGene == 'unmapped') {
		// do not supply a new attribute
		return
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
