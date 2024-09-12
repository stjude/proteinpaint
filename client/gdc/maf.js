import { dofetch3 } from '#common/dofetch'
import { sayerror } from '../dom/sayerror.ts'
import { renderTable } from '../dom/table.ts'
import { make_radios } from '#dom/radiobutton'
import { fileSize } from '#shared/fileSize'
import { Menu } from '#dom/menu'

/*
a UI to list open-access maf files from current cohort
let user selects some, for the backend to generate an aggregated maf file and download to user

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries
callbacks{ postRender() }
*/

const tip = new Menu()

// list of columns to show in MAF file table
const tableColumns = [{ label: 'Case' }, { label: 'Project' }, { label: 'Samples' }, { label: 'File Size' }]

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

export async function gdcMAFui({ holder, filter0, callbacks, debugmode = false }) {
	try {
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
		const obj = {
			// old habit of wrapping everything
			errDiv: holder.append('div'),
			controlDiv: holder.append('div'),
			tableDiv: holder.append('div'),
			opts: {
				filter0,
				experimentalStrategy: 'WXS'
			}
		}
		makeControls(obj)
		await getFilesAndShowTable(obj)
		if (typeof callbacks?.postRender == 'function') {
			callbacks.postRender(publicApi)
		}
	}

	// public api obj to be returned
	const publicApi = { update }
	return publicApi // ?
}

function makeControls(obj) {
	const table = obj.controlDiv.append('table')
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.7).text('Access')
		tr.append('td').text('Open')
	}
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.7).text('Workflow Type')
		tr.append('td').text('Aliquot Ensemble Somatic Variant Merging and Masking')
	}
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.7).text('Experimental Strategy')
		const td = tr.append('td')
		make_radios({
			holder: td,
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
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.7).text('Output Columns')
		const td = tr.append('td')
		const clickText = td
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
				} columns selected, click to change`
			)
		}
	}
}

async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').text('Loading...')

	const body = {
		experimentalStrategy: obj.opts.experimentalStrategy
	}
	if (obj.opts.filter0) body.filter0 = obj.opts.filter0
	const result = await dofetch3('gdc/maf', { body })
	if (result.error) throw result.error
	wait.remove()

	// render
	{
		const row = obj.tableDiv.append('div').style('margin', '20px')
		if (result.filesTotal > result.files.length) {
			row.append('div').text(`Showing first ${result.files.length} files out of ${result.filesTotal} total.`)
		} else {
			row.append('div').text(`Showing ${result.files.length} files.`)
		}
	}

	const rows = []
	for (const f of result.files) {
		const row = [
			{ html: `<a href=https://portal.gdc.cancer.gov/cases/${f.case_uuid} target=_blank>${f.case_submitter_id}</a>` },
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
			{ value: fileSize(f.file_size), url: 'https://portal.gdc.cancer.gov/files/' + f.id }
		]
		rows.push(row)
	}
	renderTable({
		rows,
		columns: tableColumns,
		resize: true,
		div: obj.tableDiv.append('div'),
		selectAll: true,
		dataTestId: 'sja_mafFileTable',
		buttons: [
			{
				text: 'Aggregate selected MAF files and download',
				onChange: updateButtonBySelectionChange,
				callback: submitSelectedFiles
			}
		]
	})

	function updateButtonBySelectionChange(lst, button) {
		let sum = 0
		for (const i of lst) sum += result.files[i].file_size
		if (sum == 0) {
			button.innerHTML = 'No file selected'
			button.disabled = true
			return
		}
		button.disabled = false
		button.innerHTML =
			sum < result.maxTotalSizeCompressed
				? `Download ${fileSize(sum)} compressed MAF data`
				: `Download ${fileSize(result.maxTotalSizeCompressed)} compressed MAF data (${fileSize(sum)} selected)`
	}

	async function submitSelectedFiles(lst, button) {
		const outColumns = mafColumns.filter(i => i.selected).map(i => i.column)
		if (outColumns.length == 0) {
			window.alert('No output columns selected.')
			return
		}

		const fileIdLst = []
		for (const i of lst) {
			fileIdLst.push(result.files[i].id)
		}
		if (fileIdLst.length == 0) return
		const oldText = button.innerHTML
		button.innerHTML = 'Loading... Please wait'
		button.disabled = true

		// may disable the "Aggregate" button here and re-enable later

		let data
		try {
			data = await dofetch3('gdc/mafBuild', { body: { fileIdLst, columns: outColumns } })
			if (data.error) throw data.error
		} catch (e) {
			sayerror(obj.errDiv, e)
			button.innerHTML = oldText
			button.disabled = false

			return
		}

		button.innerHTML = oldText
		button.disabled = false

		// download the file to client
		const a = document.createElement('a')
		a.href = URL.createObjectURL(data)
		a.download = `cohortMAF.${new Date().toISOString().split('T')[0]}.gz`
		a.style.display = 'none'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
}
