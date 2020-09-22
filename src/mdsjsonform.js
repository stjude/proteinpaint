import { select as d3select } from 'd3'
import { vcfvariantisgermline } from './block.mds.svcnv'

//TODO: Genomes in the same or separate function?

export async function init_mdsjsonform(holder) {
	const form_div = holder.append('div')

	form_div
		.append('div')
		.style('font-size', '20px')
		.style('margin', '10px')
		.text('Create a Custom GenomePaint Track')

	const wrapper_div = form_div
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(2, 250px)')
		.style('align-items', 'end')
		.style('grid-auto-rows', '35px')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')

	//.name
	const tk_name_prompt = wrapper_div.append('div')

	tk_name_prompt.append('span').text('Track name')

	const tk_name_div = wrapper_div.append('div')

	tk_name_div.append('div')

	tk_name_div.append('input').attr('size', 20)

	//.type Not included. Only one value - Appear on form or only include on the backend?

	// .isdense
	//TODO: .isdense available in a track object?
	const is_dense_prompt = wrapper_div.append('div')

	is_dense_prompt.append('span').text('Dense Display')

	const row = wrapper_div.append('div')

	const is_dense_div = row.append('select')
	is_dense_div.append('input')
	is_dense_div.attr('type', 'checkbox')
	is_dense_div.append('option').text('Select') //TODO: Placeholder
	is_dense_div.append('option').text('Yes') //True
	is_dense_div.append('option').text('No') //False
	row.append('span')

	is_dense_div.append('input').attr('size', 20)

	//.isfull left off since .isdense specified

	//.svcnvfile or .svcnvurl
	//TODO: Function to detect file versus URL.
	//TODO: Function to detect either SVCNV file or vcf file provided - both are allowed
	const svcnv_path_prompt = wrapper_div.append('div')

	svcnv_path_prompt.append('span').text('SV, CNV file path or URL')

	const svcnv_path_div = wrapper_div.append('div')

	svcnv_path_div.append('div')

	svcnv_path_div.append('input').attr('size', 20)

	//.expressionfile
	const expression_file_prompt = wrapper_div.append('div')

	expression_file_prompt.append('span').text('Expression file path')

	const expression_file_div = wrapper_div.append('div')

	expression_file_div.append('div')

	expression_file_div.append('input').attr('size', 20)

	//.vcffile
	const vcf_file_prompt = wrapper_div.append('div')

	vcf_file_prompt.append('span').text('VCF file path')

	const vcf_file_div = wrapper_div.append('div')

	vcf_file_div.append('div')

	vcf_file_div.append('input').attr('size', 20)

	//TODO: .vcf.hiddenclass not in track object?

	//.sampleset Array
	const samples_array_div = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')
		.html('Sample Sets<br>')

	const samples_table = samples_array_div
		.append('table')
		.style('display', 'inline-block')
		.style('padding-right', '10px')

	const table_row = samples_table
		.append('tr')
		.style('display', 'inline-block')
		.style('padding-right', '10px')

	const table_header = table_row
	table_header.append('th').text('Name')
	table_header.append('th').text('Samples')

	let sample_set = table_row.append('div')
	sample_set.append('input').attr('size', 20)
	sample_set.append('input').attr('size', 40)
	table_row
	//TODO add button to add lines to table

	//.sample2assaytrack Array
	//.sample2assaytrack.samplename -Key
	//.sample2assaytrack.assaytrack - Value
	//.sample2assaytrack.assaytrack.name
	//.sample2assaytrack.assaytrack.type
	//.sample2assaytrack.assaytrack.file
	//.sample2assaytrack.assaytrack.strand1
	//.sample2assaytrack.assaytrack.strand1.file
	//.sample2assaytrack.assaytrack.strand1.file.normalize
	//.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
	//.sample2assaytrack.assaytrack.strand2
	//.sample2assaytrack.assaytrack.strand2.file
	//.sample2assaytrack.assaytrack.strand1.file.normalize
	//.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
}

function validate_form() {
	if (svcnv_path == '' || vcf_file == '') {
		alert('Please provide either a SV, CNV, or VCF file path')
		return false
	}
}
