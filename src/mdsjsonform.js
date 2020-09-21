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

	//.name
	const tk_name_div = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	tk_name_div
		.append('div')
		.style('display', 'inline-block')
		.style('padding-right', '10px')
		.text('Track name')

	tk_name_div.append('input').attr('size', 20)

	//.type Not included. Only one value - Appear on form or only include on the backend?

	// .isdense
	//TODO: Field available in a track object?
	const row = form_div
		.append('div')
		.style('margin', '2px')
		.html('Dense Display?')

	const is_dense = row.append('select')
	is_dense.append('input')
	is_dense.attr('type', 'checkbox')
	is_dense.append('option').text('Select') //TODO: Placeholder
	is_dense.append('option').text('Yes') //True
	is_dense.append('option').text('No') //False
	row
		.append('span')
		.style('margin-right', '5px')
		.style('vertical-align', 'left')

	is_dense.append('input').attr('size', 20)

	//.isfull left off since .isdense specified

	//.svcnvfile or .svcnvurl
	//TODO: Function to detect file versus URL.
	//TODO: Function to detect either SVCNV file or vcf file provided - both are allowed
	const svcnv_path = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	svcnv_path
		.append('div')
		.style('display', 'inline-block')
		.style('padding-right', '10px')
		.text('SV, CNV file path or URL')

	svcnv_path.append('input').attr('size', 20)

	//.expressionfile
	const expression_file = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	expression_file
		.append('div')
		.style('display', 'inline-block')
		.style('padding-right', '10px')
		.text('Expression file path')

	expression_file.append('input').attr('size', 20)

	//.vcffile
	const vcf_file = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	vcf_file
		.append('div')
		.style('display', 'inline-block')
		.style('padding-right', '10px')
		.text('VCF file path')

	vcf_file.append('input').attr('size', 20)

	//TODO: .vcf.hiddenclass not in track object?

	//.sampleset Array
	// const sample_set = {
	//     name: VAR_NAME,
	//     samples: []
	// }

	const samples_array = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	const samples_table = samples_array
		.append('table')
		.style('display', 'inline-block')
		.style('padding-right', '10px')

	samples_table.setAttribute('name', 'samples')

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

function validate_form(arg) {
	if (svcnv_path == '' || vcf_file == '') {
		alert('Please provide either a SV, CNV, or VCF file path')
		return false
	}
}
