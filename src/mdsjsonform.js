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
    doms.isdense = set_dense(wrapper_div)
    doms.svcnvfileurl = make_svcnv(wrapper_div)
    doms.vcffile = make_vcf(wrapper_div)
    doms.expressionfile = make_express_filepath(wrapper_div)
        // doms.sampleset[name] = make_sa_set_name(sample_set_grid_div) //TODO: Figure out why this didn't work
        //doms.genome = make_genome(wrapper_div, genomes)
        // more controls...

    const genome_prompt = wrapper_div.append('div')

    genome_prompt.append('span').text('Genome')

    //.genome
    const g_row = wrapper_div.append('div')

    const select = g_row.append('select')
    for (const n in genomes) {
        select.append('option').text(n)
    }

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



    const sample_set_samples_prompt = sample_set_grid_div.append('div')

    sample_set_samples_prompt.append('span').text('Samples')



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

    // const s_row = sample_assay_grid_div.append('div')

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
            const vcf = doms.vcffile.property('value')
            if (tmp == '' && vcf == '') throw 'Missing SVCNV file path or URL, or VCF file path'
            if (isurl(tmp)) {
                obj.svcnvurl = tmp
            } else {
                obj.svcnvfile = tmp
            }
        } {
            const tmp = doms.expressionfile.property('value')
            if (tmp != '') {
                obj.expressionfile = doms.expressionfile.property('value')
            }
        }
    console.log(obj)
    return obj
}

function isurl(t) {
    const a = t.toUpperCase()
    return a.startsWith('HTTP://') || a.startsWith('HTTPS://')
}

// function make_genome(div){

// }

function make_name(div) {
    const tk_name_prompt = div.append('div')

    tk_name_prompt.append('span').text('Track name')

    const tk_name_div = div.append('div')

    return tk_name_div
        .append('div')
        .append('input')
        .attr('size', 20)
}
// .isdense
function set_dense(div) {
    const is_dense_prompt = div.append('div')

    is_dense_prompt.append('span').text('Dense Display')

    const row = div.append('div')

    const is_dense_div = row.append('select')
    is_dense_div.append('input')
    is_dense_div.attr('type', 'checkbox')
    is_dense_div.append('option').text('Select') //TODO: Placeholder
    is_dense_div.append('option').text('True')
    is_dense_div.append('option').text('False')
    row.append('span')

    return is_dense_div.append('input').attr('size', 20)
}
//.svcnvfile or .svcnvurl
function make_svcnv(div) {
    const svcnv_path_prompt = div.append('div')

    svcnv_path_prompt.append('span').text('"SVCNV" file path or URL')

    const svcnv_path_div = div.append('div')

    return svcnv_path_div
        .append('div')
        .append('input')
        .attr('size', 20)
}
//.vcffile
function make_vcf(div) {
    const vcf_file_prompt = div.append('div')

    vcf_file_prompt.append('span').text('VCF file path')

    const vcf_file_div = div.append('div')

    return vcf_file_div
        .append('div')
        .append('input')
        .attr('size', 20)
}
//.expressionfile
function make_express_filepath(div) {
    const expression_file_prompt = div.append('div')

    expression_file_prompt.append('span').text('Gene expression file path')

    const expression_file_div = div.append('div')

    return expression_file_div
        .append('div')
        .append('input')
        .attr('size', 20)
}
//.sampleset.name
//TODO Figure out why this didn't work
// function make_sa_set_name(div){
//     const sample_set_name_prompt = div.append('div')

//     sample_set_name_prompt.append('span').text('Sample Set Name')

//     const sample_set_name_div = div.append('div')

//     return sample_set_name_div
//             .append('div')
//             .append('input')
//             .attr('size', 20)
// }