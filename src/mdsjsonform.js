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

    const doms = {} // use this to collect all input DOMs
    doms.name = make_name(wrapper_div)
        //doms.genome = make_genome(wrapper_div, genomes)
        // more controls...

    const genome_prompt = wrapper_div.append('div')

    doms.genome = genome_prompt.append('span').text('Genome')

    //.genome
    const g_row = wrapper_div.append('div')

    const select = g_row.append('select')
    for (const n in genomes) {
        select.append('option').text(n)
    }

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

    //TODO add button to add lines to table
    //.sample2assaytrack.assaytrack.strand1
    //.sample2assaytrack.assaytrack.strand1.file
    //.sample2assaytrack.assaytrack.strand1.file.normalize
    //.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
    //.sample2assaytrack.assaytrack.strand2
    //.sample2assaytrack.assaytrack.strand2.file
    //.sample2assaytrack.assaytrack.strand1.file.normalize
    //.sample2assaytrack.assaytrack.strand1.file.normalize.dividefactor
    const submit_row = form_div

    submit_row
        .append('button')
        .text('Submit')
        .on('click', async() => {
            link_holder.html('Loading...')
            try {
                let genome {
                    //const n = doms.genome.node()
                    //genome = n.options[n.selectedIndex].text
                    genome = 'hg19'
                }
                const deposit = validate_input(doms)
                const re = await dofetch2('mdsjsonform', { method: 'POST', body: JSON.stringify({ deposit }) })
                if (re.error) throw re.error
                link_holder.html(
                    '<a href=' +
                    window.location.origin +
                    '?block=1&genome=' +
                    genome +
                    '&mdsjsoncache=' +
                    re.id +
                    ' target=_blank>View track</a>'
                )
            } catch (e) {
                window.alert('Error: ' + e)
                return
            }
        })

    const link_holder = submit_row.append('span').style('margin-left', '20px')
}

function validate_input(doms) {
    const obj = {
        type: 'mdssvcnv' // hardcoded, must be the same as common.tkt.mdssvcnv
    }
    obj.name = doms.name.property('value') || 'Custom track'
    obj.isdense = doms.isdense.property('value') || 'True'
        // TODO correct the logic that either svcnv or vcf file is required
        {
            const tmp = doms.svcnvfileurl.property('value')
            if (tmp == '') throw 'Missing SVCNV file path or URL'
            if (isurl(tmp)) {
                obj.svcnvurl = tmp
            } else {
                obj.svcnvfile = tmp
            }
        }
        //obj.expressionfile = doms.expressionfile.property('value') || 'Gene expression file'
        //obj.vcffile = doms.vcffile.property('value') || 'VCF file'
    return obj
}

function isurl(t) {
    const a = t.toUpperCase()
    return a.startsWith('HTTP://') || a.startsWith('HTTPS://')
}

function make_name(div) {
    const tk_name_prompt = div.append('div')

    tk_name_prompt.append('span').text('Track name')

    const tk_name_div = div.append('div')

    return tk_name_div
        .append('div')
        .append('input')
        .attr('size', 20)
}