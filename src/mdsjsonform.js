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
		.style('grid-template-columns', '1fr 4fr')
		.style('align-items', 'end')
		.style('grid-template-rows', '1fr 1fr')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')

	//.name
	const tk_name_prompt = wrapper_div.append('div')

	tk_name_prompt.append('span').text('Track name')

	const tk_name_div = wrapper_div.append('div')

	tk_name_div
		.append('div')
		.append('input')
		.attr('size', 20)

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

	svcnv_path_div
		.append('div')
		.append('input')
		.attr('size', 20)

	//.expressionfile
	const expression_file_prompt = wrapper_div.append('div')

	expression_file_prompt.append('span').text('Gene expression file path')

	const expression_file_div = wrapper_div.append('div')

	expression_file_div
		.append('div')
		.append('input')
		.attr('size', 20)

	//.vcffile
	const vcf_file_prompt = wrapper_div.append('div')

	vcf_file_prompt.append('span').text('VCF file path')

	const vcf_file_div = wrapper_div.append('div')

	vcf_file_div
		.append('div')
		.append('input')
		.attr('size', 20)

	//TODO: .vcf.hiddenclass not in track object?

	//.sampleset Array
	const sample_set_prompt = wrapper_div.append('div')

	sample_set_prompt.append('span').text('Sample Sets')

	const sample_set_grid = wrapper_div.append('div')

	sample_set_grid
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr 1fr')
		// .style('grid-template-rows', '1fr 1fr')
		.style('grid-gap', '5px')
		// .style('align-items', 'end')
		.style('margin', '5px')
		.style('position', 'relative')
		.style('background', 'blue')

	const sample_set_name_prompt = sample_set_grid.append('div')

	sample_set_name_prompt.append('span').text('Name')

	const sample_set_samples_prompt = sample_set_grid.append('div')

	sample_set_samples_prompt.append('span').text('Samples')

	const sample_set_name_div = sample_set_grid.append('div')

	sample_set_name_div
		.append('div')
		.append('input')
		.attr('size', 20)

	const sample_set_samples_div = sample_set_grid.append('div')

	sample_set_samples_div
		.append('div')
		.append('input')
		.attr('size', 20)

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
