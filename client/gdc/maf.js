import { dofetch3 } from '#common/dofetch'
import { make_radios, renderTable, sayerror, Menu, table2col } from '#dom'
import { fileSize } from '#shared/fileSize.js'
import { select } from 'd3-selection'

/*
a UI to list open-access maf files from current cohort
let user selects some, for the backend to generate an aggregated maf file and download to user

obj {} TODO convert to class and declare properties

*/

const tip = new Menu()

// list of columns to show in MAF file table
const tableColumns = [
	{ label: 'Case', sortable: true },
	{ label: 'Project', sortable: true },
	{ label: 'Samples' },
	{ label: 'File Size', barplot: { tickFormat: '~s' }, sortable: true } // barchart column not sortable yet
]

// list of gdc maf file columns; selected ones are used for output
const mafColumns = [
	{ column: 'Hugo_Symbol', selected: true },
	{ column: 'Entrez_Gene_Id', selected: true },
	{ column: 'Center', selected: true },
	{ column: 'NCBI_Build', selected: true },
	{ column: 'Chromosome', selected: true },
	{ column: 'Start_Position', selected: true },
	{ column: 'End_Position', selected: true },
	{ column: 'Strand', selected: true },
	{ column: 'Variant_Classification', selected: true },
	{ column: 'Variant_Type', selected: true },
	{ column: 'Reference_Allele', selected: true },
	{ column: 'Tumor_Seq_Allele1', selected: true },
	{ column: 'Tumor_Seq_Allele2', selected: true },
	{ column: 'dbSNP_RS', selected: true },
	{ column: 'dbSNP_Val_Status', selected: true },
	{ column: 'Tumor_Sample_Barcode', selected: true },
	{ column: 'Matched_Norm_Sample_Barcode', selected: true },
	{ column: 'Match_Norm_Seq_Allele1', selected: true },
	{ column: 'Match_Norm_Seq_Allele2', selected: true },
	{ column: 'Tumor_Validation_Allele1', selected: true },
	{ column: 'Tumor_Validation_Allele2', selected: true },
	{ column: 'Match_Norm_Validation_Allele1', selected: true },
	{ column: 'Match_Norm_Validation_Allele2', selected: true },
	{ column: 'Verification_Status', selected: true },
	{ column: 'Validation_Status', selected: true },
	{ column: 'Mutation_Status', selected: true },
	{ column: 'Sequencing_Phase', selected: true },
	{ column: 'Sequence_Source', selected: true },
	{ column: 'Validation_Method', selected: true },
	{ column: 'Score', selected: true },
	{ column: 'BAM_File', selected: true },
	{ column: 'Sequencer', selected: true },
	{ column: 'Tumor_Sample_UUID', selected: true },
	{ column: 'Matched_Norm_Sample_UUID', selected: true },
	{ column: 'HGVSc', selected: true },
	{ column: 'HGVSp', selected: true },
	{ column: 'HGVSp_Short', selected: true },
	{ column: 'Transcript_ID', selected: true },
	{ column: 'Exon_Number', selected: true },
	{ column: 't_depth', selected: true },
	{ column: 't_ref_count', selected: true },
	{ column: 't_alt_count', selected: true },
	{ column: 'n_depth', selected: true },
	{ column: 'n_ref_count', selected: true },
	{ column: 'n_alt_count', selected: true },
	{ column: 'all_effects', selected: true },
	{ column: 'Allele', selected: true },
	{ column: 'Gene', selected: true },
	{ column: 'Feature', selected: true },
	{ column: 'Feature_type', selected: true },
	{ column: 'One_Consequence', selected: true },
	{ column: 'Consequence', selected: true },
	{ column: 'cDNA_position', selected: true },
	{ column: 'CDS_position', selected: true },
	{ column: 'Protein_position', selected: true },
	{ column: 'Amino_acids', selected: true },
	{ column: 'Codons', selected: true },
	{ column: 'Existing_variation', selected: true },
	{ column: 'DISTANCE', selected: true },
	{ column: 'TRANSCRIPT_STRAND', selected: true },
	{ column: 'SYMBOL', selected: true },
	{ column: 'SYMBOL_SOURCE', selected: true },
	{ column: 'HGNC_ID', selected: true },
	{ column: 'BIOTYPE', selected: true },
	{ column: 'CANONICAL', selected: true },
	{ column: 'CCDS', selected: true },
	{ column: 'ENSP', selected: true },
	{ column: 'SWISSPROT', selected: true },
	{ column: 'TREMBL', selected: true },
	{ column: 'UNIPARC', selected: true },
	{ column: 'UNIPROT_ISOFORM', selected: true },
	{ column: 'RefSeq', selected: true },
	{ column: 'MANE', selected: true },
	{ column: 'APPRIS', selected: true },
	{ column: 'FLAGS', selected: true },
	{ column: 'SIFT', selected: true },
	{ column: 'PolyPhen', selected: true },
	{ column: 'EXON', selected: true },
	{ column: 'INTRON', selected: true },
	{ column: 'DOMAINS', selected: true },
	{ column: '1000G_AF', selected: true },
	{ column: '1000G_AFR_AF', selected: true },
	{ column: '1000G_AMR_AF', selected: true },
	{ column: '1000G_EAS_AF', selected: true },
	{ column: '1000G_EUR_AF', selected: true },
	{ column: '1000G_SAS_AF', selected: true },
	{ column: 'ESP_AA_AF', selected: true },
	{ column: 'ESP_EA_AF', selected: true },
	{ column: 'gnomAD_AF', selected: true },
	{ column: 'gnomAD_AFR_AF', selected: true },
	{ column: 'gnomAD_AMR_AF', selected: true },
	{ column: 'gnomAD_ASJ_AF', selected: true },
	{ column: 'gnomAD_EAS_AF', selected: true },
	{ column: 'gnomAD_FIN_AF', selected: true },
	{ column: 'gnomAD_NFE_AF', selected: true },
	{ column: 'gnomAD_OTH_AF', selected: true },
	{ column: 'gnomAD_SAS_AF', selected: true },
	{ column: 'MAX_AF', selected: true },
	{ column: 'MAX_AF_POPS', selected: true },
	{ column: 'gnomAD_non_cancer_AF', selected: true },
	{ column: 'gnomAD_non_cancer_AFR_AF', selected: true },
	{ column: 'gnomAD_non_cancer_AMI_AF', selected: true },
	{ column: 'gnomAD_non_cancer_AMR_AF', selected: true },
	{ column: 'gnomAD_non_cancer_ASJ_AF', selected: true },
	{ column: 'gnomAD_non_cancer_EAS_AF', selected: true },
	{ column: 'gnomAD_non_cancer_FIN_AF', selected: true },
	{ column: 'gnomAD_non_cancer_MID_AF', selected: true },
	{ column: 'gnomAD_non_cancer_NFE_AF', selected: true },
	{ column: 'gnomAD_non_cancer_OTH_AF', selected: true },
	{ column: 'gnomAD_non_cancer_SAS_AF', selected: true },
	{ column: 'gnomAD_non_cancer_MAX_AF_adj', selected: true },
	{ column: 'gnomAD_non_cancer_MAX_AF_POPS_adj', selected: true },
	{ column: 'CLIN_SIG', selected: true },
	{ column: 'SOMATIC', selected: true },
	{ column: 'PUBMED', selected: true },
	{ column: 'TRANSCRIPTION_FACTORS', selected: true },
	{ column: 'MOTIF_NAME', selected: true },
	{ column: 'MOTIF_POS', selected: true },
	{ column: 'HIGH_INF_POS', selected: true },
	{ column: 'MOTIF_SCORE_CHANGE', selected: true },
	{ column: 'miRNA', selected: true },
	{ column: 'IMPACT', selected: true },
	{ column: 'PICK', selected: true },
	{ column: 'VARIANT_CLASS', selected: true },
	{ column: 'TSL', selected: true },
	{ column: 'HGVS_OFFSET', selected: true },
	{ column: 'PHENO', selected: true },
	{ column: 'GENE_PHENO', selected: true },
	{ column: 'CONTEXT', selected: true },
	{ column: 'case_id', selected: true },
	{ column: 'GDC_FILTER', selected: true },
	{ column: 'COSMIC', selected: true },
	{ column: 'hotspot', selected: true },
	{ column: 'tumor_bam_uuid', selected: true },
	{ column: 'normal_bam_uuid', selected: true },
	{ column: 'RNA_Support', selected: true },
	{ column: 'RNA_depth', selected: true },
	{ column: 'RNA_ref_count', selected: true },
	{ column: 'RNA_alt_count', selected: true },
	{ column: 'callers', selected: true }
]

export async function gdcMAFui({ filter0, callbacks, debugmode = false }, holder) {
	try {
		if (callbacks) {
			/* due to src/app.js line 100
			delete this when that is reshaped to app.sjcharts.callbacks={}
			*/
			delete callbacks.sjcharts
			for (const n in callbacks) {
				if (typeof callbacks[n] != 'function') throw `callbacks.${n} not function`
			}
		}
		{
			// validate column names in case of human err
			const cn = new Set()
			for (const c of mafColumns) {
				if (!c.column) throw '.column missing from an element'
				if (cn.has(c.column)) throw 'duplicate column: ' + c.column
				cn.add(c.column)
			}
		}
		update({ filter0 })
	} catch (e) {
		console.log(e)
		sayerror(holder, e.message || e)
	}

	async function update({ filter0 }) {
		holder.selectAll('*').remove()
		// TODO convert obj to class and declare all properties
		const obj = {
			errDiv: holder.append('div'),
			controlDiv: holder.append('div'),
			tableDiv: holder.append('div'),
			opts: {
				filter0,
				experimentalStrategy: 'WXS'
			},
			busy: false, // when downloading, set to true for disabling ui interactivity
			mafTableArg: null,
			expStrategyRadio: null
		}
		makeControls(obj)
		await getFilesAndShowTable(obj)
		callbacks?.postRender?.(publicApi)
	}

	// return api to be accessible by react wrapper; will call api.update() to auto refresh cohortmaf UI on GFF cohort change
	const publicApi = { update }
	return publicApi
}

function makeControls(obj) {
	const table = table2col({ holder: obj.controlDiv })
	table.addRow('Access', 'Open')
	table.addRow('Workflow Type', 'Aliquot Ensemble Somatic Variant Merging and Masking')
	{
		const [td1, td2] = table.addRow('Experimental Strategy')
		obj.expStrategyRadio = make_radios({
			holder: td2,
			options: [
				{ label: 'WXS', value: 'WXS', checked: obj.opts.experimentalStrategy == 'WXS' },
				{
					label: 'Targeted Sequencing',
					value: 'Targeted Sequencing',
					checked: obj.opts.experimentalStrategy == 'Targeted Sequencing'
				}
			],
			styles: { display: 'inline' },
			callback: async value => {
				obj.opts.experimentalStrategy = value
				await getFilesAndShowTable(obj)
			}
		})
	}

	{
		const [td1, td2] = table.addRow('Output Columns')
		const clickText = td2
			.append('span')
			.attr('class', 'sja_clbtext')
			.on('click', event => {
				const rows = [],
					selectedRows = []
				for (const [i, c] of mafColumns.entries()) {
					rows.push([{ value: c.column }])
					if (c.selected) selectedRows.push(i)
				}
				renderTable({
					div: tip.clear().showunder(event.target).d,
					rows,
					columns: [{ label: 'Column Name' }],
					selectedRows,
					noButtonCallback: (i, n) => {
						mafColumns[i].selected = n.checked
						updateText()
					}
				})
			})

		updateText()

		function updateText() {
			clickText.text(
				`${mafColumns.reduce((c, i) => c + (i.selected ? 1 : 0), 0)} of ${
					mafColumns.length
				} columns selected. Click to change`
			)
		}
	}
}

async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').style('margin', '30px 10px 10px 10px').text('Loading...')

	let result // convenient for accessing outside of try-catch

	try {
		const body = {
			experimentalStrategy: obj.opts.experimentalStrategy
		}
		if (obj.opts.filter0) body.filter0 = obj.opts.filter0
		result = await dofetch3('gdc/maf', { body })
		if (result.error) throw result.error
		if (!Array.isArray(result.files)) throw 'result.files[] not array'
		if (result.files.length == 0) throw 'No MAF files available.'

		// render
		if (result.filesTotal > result.files.length) {
			wait.text(`Showing first ${result.files.length} MAF files out of ${result.filesTotal} total.`)
		} else {
			wait.text(`Showing ${result.files.length} MAF files.`)
		}

		const rows = []
		for (const f of result.files) {
			const row = [
				{
					html: `<a href=https://portal.gdc.cancer.gov/files/${f.id} target=_blank>${f.case_submitter_id}</a>`,
					value: f.case_submitter_id
				},
				{ value: f.project_id },
				{
					html: f.sample_types
						.map(i => {
							return (
								'<span class="sja_mcdot" style="padding:1px 8px;background:#ddd;color:black;white-space:nowrap">' +
								i +
								'</span>'
							)
						})
						.join(' ')
				},
				{ value: f.file_size } // do not send in text-formated file size, table sorting won't work
			]
			rows.push(row)
		}

		// tracks table arg, so that the created button DOM element is accessible and can be modified
		obj.mafTableArg = {
			rows,
			columns: tableColumns,
			resize: true,
			div: obj.tableDiv.append('div'),
			selectAll: true, // comment out for quicker testing
			dataTestId: 'sja_mafFileTable',
			header: { allowSort: true },
			selectedRows: [], //[198], // uncomment out for quicker testing
			buttons: [
				{
					text: 'Aggregate selected MAF files and download',
					onChange: updateButtonBySelectionChange,
					callback: submitSelectedFiles
				}
			]
		}
		renderTable(obj.mafTableArg)
	} catch (e) {
		wait.text(e.message || e)
		if (e.stack) console.log(e.stack)
	}

	function updateButtonBySelectionChange(lst, button) {
		if (obj.busy) {
			/* is waiting for server response. do not proceed to alter submit button
			because the checkboxes in the maf table cannot be disabled when submission is running,
			thus user can still check and uncheck maf files, that can cause the submit button to be enabled
			thus do below to disable it
			*/
			obj.mafTableArg.buttons[0].button.property('disabled', true)
			return
		}

		let sum = 0
		for (const i of lst) sum += result.files[i].file_size
		if (sum == 0) {
			button.innerHTML = 'No file selected'
			button.disabled = true
			return
		}

		// TEMP fix! later add `buttonsToLeft:true` at line 321; this fix avoid changing table.ts to make it easy to cherrypick for 2.16 gdc release
		select(button.parentElement).style('float', 'left')

		button.disabled = false
		button.innerHTML =
			sum < result.maxTotalSizeCompressed
				? `Download ${fileSize(sum)} compressed MAF data`
				: `Download ${fileSize(result.maxTotalSizeCompressed)} compressed MAF data (${fileSize(sum)} selected)`
	}

	/* after table is created, on clicking download btn for first time, create a <span> after download btn,
	in order to show server-sent message on problematic files (emtpy, failed, invalid)
	scope this <span> for easy access by helpers,
	detect if it is truthy to only create it once
	*/
	let serverMessage

	async function submitSelectedFiles(lst, button) {
		const outColumns = mafColumns.filter(i => i.selected).map(i => i.column)
		if (outColumns.length == 0) {
			window.alert('No output columns selected.')
			return
		}

		mayCreateServerMessageSpan(button)

		const fileIdLst = []
		for (const i of lst) {
			fileIdLst.push(result.files[i].id)
		}
		if (fileIdLst.length == 0) return

		const oldText = button.innerHTML
		button.innerHTML = 'Loading... Please wait'
		button.disabled = true
		serverMessage.style('display', 'none')

		// may disable the "Aggregate" button here and re-enable later

		let data
		try {
			obj.busy = true
			obj.expStrategyRadio.inputs.property('disabled', true)
			data = await dofetch3('gdc/mafBuild', { body: { fileIdLst, columns: outColumns } })
			if (!Object.keys(data).length) throw 'server returned blank multipart'
			obj.busy = false
			obj.expStrategyRadio.inputs.property('disabled', false)
		} catch (e) {
			sayerror(obj.errDiv, e)
			button.innerHTML = oldText
			button.disabled = false
			obj.busy = false
			obj.expStrategyRadio.property('disabled', false)
			return
		}

		button.innerHTML = oldText
		button.disabled = false

		if (data.errors?.body) {
			// expect gdc/mafBuild errors to be an array
			const errors = data.errors.body || []
			if (Array.isArray(errors)) {
				const fileErrors = errors.filter(d => d.url)
				if (fileErrors.length) displayRunStatusErrors(fileErrors)
				const nonFileErrors = errors.filter(d => !d.url)
				for (const e of nonFileErrors) sayerror(obj.errDiv, e.error || e.message)
			}
		}

		// download the file to client
		if (!data.gzfile) throw 'missing gzfile from response'
		const href = URL.createObjectURL(data.gzfile.body)
		// console.log(394, [octetData?.body.size, href.length, href], octetData)
		const a = document.createElement('a')
		a.href = href
		a.download = `cohortMAF.${new Date().toISOString().split('T')[0]}.maf.gz`
		a.style.display = 'none'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}

	function mayCreateServerMessageSpan(button) {
		if (serverMessage) return // message <span> are already created
		const holder = select(button.parentElement)
		serverMessage = holder.append('span').attr('class', 'sja_clbtext').style('display', 'none')
	}

	function displayRunStatusErrors(errors) {
		// errors[] each ele: {error:str, url:str}
		const rows = [] // map errors[] to rows[] to show in table of menu
		for (const e of errors) {
			if (typeof e.error != 'string') throw '.error=string missing from an entry'
			if (typeof e.url != 'string') throw '.url=string missing from an entry'
			// url should end in file uuid, which can be used to match with original record of that file
			const l = e.url.split('/')
			const uuid = l[l.length - 1]
			const fo = result.files.find(i => i.id == uuid)
			if (fo) {
				// record is found for this failed uuid
				rows.push([
					{ html: `<a href=${e.url} target=_blank>${fo.case_submitter_id}</a>` },
					{ value: fo.project_id },
					{ value: fileSize(fo.file_size) },
					{ value: e.error }
				])
			} else {
				// file is not found; could happen in testing when backend hardcodes a uuid not in result.files[], or even gdc backend changes..
				rows.push([{ value: uuid }, { value: '?' }, { value: '?' }, { value: e.error }])
			}
		}
		serverMessage
			.text(`${errors.length} empty/failed file${errors.length > 1 ? 's' : ''}`)
			.style('display', '')
			.on('click', event => {
				renderTable({
					rows,
					columns: [{ column: '' }, { column: '' }, { column: '' }, { column: '' }],
					showHeader: false,
					div: tip.clear().showunder(event.target).d
				})
			})
	}
}
