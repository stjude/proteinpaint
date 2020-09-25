import { select as d3select } from 'd3'
import { vcfvariantisgermline } from './block.mds.svcnv'
import { dofetch2 } from './client'

/*
 */

export async function init_mdsjsonform(par) {
    const { holder, genomes } = par

    {
        // check if the form is enabled to work on this server
        const re = await dofetch2('mdsjsonform', { method: 'POST', body: '{}' })
        if (re.error) {
            holder.append('div').text(re.error)
            return
        }
    }

    const doms = {} // use this to collect all input DOMs

    // TODO create <select> for genomes
    for (const n in genomes) {
        console.log(n)
    }

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

    const genome_prompt = wrapper_div.append('div')

    doms.genome = genome_prompt.append('span').text('Genome')

    //.genome
    const g_row = wrapper_div.append('div')

    const genome_div = g_row.append('select')
    genome_div.append('input')
    genome_div.attr('type', 'checkbox')
    genome_div.append('option').text('Select') //TODO: Placeholder
    genome_div.append('option').text('hg19')
    genome_div.append('option').text('hg38')
    genome_div.append('option').text('mm10')
    g_row.append('span')

    genome_div.append('input').attr('size', 20)

    //.name
    const tk_name_prompt = wrapper_div.append('div')

    tk_name_prompt.append('span').text('Track name')

    const tk_name_div = wrapper_div.append('div')

    doms.name = tk_name_div
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

    doms.isdense = is_dense_div.append('input').attr('size', 20)

    //.isfull left off since .isdense specified

    //.svcnvfile or .svcnvurl
    //TODO: Function to detect file versus URL.
    //TODO: Function to detect either SVCNV file or vcf file provided - both are allowed
    const svcnv_path_prompt = wrapper_div.append('div')

    svcnv_path_prompt.append('span').text('"SVCNV" file path or URL')

    const svcnv_path_div = wrapper_div.append('div')

    doms.svcnvfileurl = svcnv_path_div
        .append('div')
        .append('input')
        .attr('size', 20)

    //.expressionfile
    const expression_file_prompt = wrapper_div.append('div')

    expression_file_prompt.append('span').text('Gene expression file path')

    const expression_file_div = wrapper_div.append('div')

    doms.expressionfile = expression_file_div
        .append('div')
        .append('input')
        .attr('size', 20)

    //.vcffile
    const vcf_file_prompt = wrapper_div.append('div')

    vcf_file_prompt.append('span').text('VCF file path')

    const vcf_file_div = wrapper_div.append('div')

    doms.vcffile = vcf_file_div
        .append('div')
        .append('input')
        .attr('size', 20)

    //TODO: .vcf.hiddenclass not in track object?

    //.sampleset Array
    const sample_set_prompt = form_div

    sample_set_prompt
        .append('span')
        .text('Sample Sets')
        .style('margins', '5px')
        .style('padding', '10px')

    const sample_set_grid_div = form_div
        .append('div')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr 3fr')
        .style('align-items', 'end')
        .style('grid-template-rows', '1fr 1fr')
        .style('margins', '5px')
        .style('position', 'relative')
        .style('padding', '10px')

    const sample_set_name_prompt = sample_set_grid_div.append('div')

    sample_set_name_prompt.append('span').text('Sample Set Name')

    const sample_set_samples_prompt = sample_set_grid_div.append('div')

    sample_set_samples_prompt.append('span').text('Samples')

    //.sampleset.name
    const sample_set_name_div = sample_set_grid_div.append('div')

    doms.sampleset.name = sample_set_name_div
        .append('div')
        .append('input')
        .attr('size', 20)

    //.sampleset.samples
    const sample_set_samples_div = sample_set_grid_div.append('div')

    sample_set_samples_div
        .append('div')
        .append('input')
        .attr('size', 30)

    //TODO add button to add lines to table

    //.sample2assaytrack Array
    const sample_assay_sam_name_prompt = form_div

    sample_assay_sam_name_prompt
        .append('span')
        .text('Sample Assay')
        .style('margins', '5px')
        .style('padding', '10px')

    const sample_assay_grid_div = form_div
        .append('div')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr 1fr 1fr')
        .style('align-items', 'end')
        .style('grid-template-rows', '1fr 1fr 1fr')
        .style('margins', '5px')
        .style('position', 'relative')
        .style('padding', '10px')

    const sample_assay_type_prompt = sample_assay_grid_div.append('div')

    sample_assay_type_prompt.append('span').text('Type')

    const sample_assay_name_prompt = sample_assay_grid_div.append('div')

    sample_assay_name_prompt.append('span').text('Name')

    const third_col_header_div = sample_assay_grid_div.append('div')

    third_col_header_div.append('div')

    const s_row = sample_assay_grid_div.append('div')

    //.sample2assaytrack.assaytrack.type
    const sample_assay_type_div = s_row.append('select')
    sample_assay_type_div.append('input')
    sample_assay_type_div.attr('type', 'checkbox')
    sample_assay_type_div.append('option').text('Select') //TODO: Placeholder
    sample_assay_type_div.append('option').text('aicheck')
    sample_assay_type_div.append('option').text('bigwig')
    sample_assay_type_div.append('option').text('bigwigstranded')
    sample_assay_type_div.append('option').text('junction')
    s_row
        .append('span')
        .on('click', sam_assay_file_options())

    doms.sample2assaytrack.assaytrack.type = sample_assay_type_div.append('input').attr('size', 20)

    //.sample2assaytrack.assaytrack.name
    const sample_assay_name_div = sample_assay_grid_div.append('div')

    sample_assay_name_div
        .append('div')
        .append('input')
        .attr('size', 20)

    //Third column box
    const third_col_box_div = sample_assay_grid_div.append('div')

    third_col_box_div.append('div').style('display', 'block')

    //TODO add button to add lines to table
    //.sample2assaytrack.assaytrack.strand1.file.normalize
    //.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
    //.sample2assaytrack.assaytrack.strand1.file.normalize
    //.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
    const submit_row = form_div

    submit_row
        .append('button')
        .text('Submit')
        .on('click', async() => {
            try {
                const deposit = validate_input(doms)
                const re = await dofetch2('mdsjsonform', { method: 'POST', body: JSON.stringify({ deposit }) })
                if (re.error) throw re.error
                    // TODO server to return ID of cached file
                console.log(re)
            } catch (e) {
                window.alert('Error: ' + e)
                return
            }
        })
}

function validate_input(doms) {
    const obj = {
        type: 'mdssvcnv' // hardcoded, must be the same as common.tkt.mdssvcnv
    }
    obj.name = doms.name.property('value') || 'Custom track'
    obj.isdense = doms.isdense.property('value') || 'True' {
        const tmp = doms.svcnvfileurl.property('value')
        const vcf = doms.vcffile.property('value')
        if (tmp == '' && vcf == '') throw 'Missing SVCNV file path or URL, or VCF file path'
        if (isurl(tmp)) {
            obj.svcnvurl = tmp
        } else {
            obj.svcnvfile = tmp
        }
    }
    obj.expressionfile = doms.expressionfile.property('value') || 'Gene expression file'
    obj.vcffile = doms.vcffile.property('value') || 'VCF file'
    obj.sampleset = {
        obj.sampleset.name = doms.sampleset.name.property('value') || 'Sample Set Name'
    } {
        obj.sample2assaytrack = 'sample2assaytrack'
    }
    obj.sample2assaytrack.assaytrack.type = doms.sample2assaytrack.assaytrack.type.property('value')
    return obj
}

function isurl(t) {
    const a = t.toUpperCase()
    return a.startsWith('HTTP://') || a.startsWith('HTTPS://')
}

async function sam_assay_file_options(doms) {
    const tmp = doms.sample2assaytrack.assaytrack.type.property('value')
    if (tmp != 'bigwigstranded') {
        const sample_assay_file_prompt = third_col_header_div.append('div')
        sample_assay_file_prompt.append('span').text('File Path')

        //.sample2assaytrack.assaytrack.file
        const sample_assay_file_div = third_col_box_div.append('div')

        doms.sample2assaytrack.assaytrack.file = sample_assay_file_div
            .append('div')
            .append('input')
            .attr('size', 40)
    } else {
        const sample_assay_strand_prompt = third_col_header_div.append('div')
        sample_assay_strand_prompt.append('span').text('Strand Info')

        const bigwig_s_div = third_col_box_div.append('div')

        bigwig_s_div
            .append('div')

        //.sample2assaytrack.assaytrack.strand1 - no user input
        const strand1_file_prompt = bigwig_s_div.append('div')
        strand1_file_prompt.append('span').text('Strand 1 file path')

        //.sample2assaytrack.assaytrack.strand1.file
        const strand1_file_div = bigwig_s_div.append('div')
        strand1_file_div.append('input').attr('size', 20)

        //.sample2assaytrack.assaytrack.strand2 - no user input
        const strand2_file_prompt = bigwig_s_div.append('div')
        strand2_file_prompt.append('span').text('Strand 2 file path')

        //.sample2assaytrack.assaytrack.strand2.file
        const strand2_file_div = bigwig_s_div.append('div')
        strand2_file_div.append('input').attr('size', 20)
    }
}