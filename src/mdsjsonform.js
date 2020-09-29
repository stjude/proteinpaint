import { select as d3select } from 'd3'
import { vcfvariantisgermline } from './block.mds.svcnv'
import { dofetch2 } from './client'
import { tab2box } from './client'
import { some } from 'async'

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
        .text('Create a Custom ProteinPaint Track')
    const wrapper_div = form_div
        .append('div')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr 4fr')
        .style('align-items', 'end')
        .style('grid-template-rows', '1fr 1fr')
        .style('margins', '50px')
        .style('position', 'relative')
        .style('padding', '20px')


    const doms = {}
    doms.genome = make_genome(wrapper_div, genomes)
    doms.name = make_name(wrapper_div)
    doms.isdense = set_dense(wrapper_div)
    doms.svcnvfileurl = make_svcnv(wrapper_div)
    doms.vcffile = make_vcf(wrapper_div)
    doms.expressionfile = make_express_filepath(wrapper_div)
    doms.sampleset = make_sampleset(wrapper_div)


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
    obj.isdense = doms.isdense.property('value') || 'True' {
        const tmp = doms.svcnvfileurl.property('value')
        const vcf = doms.vcffile.property('value')
        if (tmp == '' && vcf == '') throw 'Missing SVCNV file path or URL, or VCF file path'
        if (isurl(tmp)) {
            obj.svcnvurl = tmp
        } else {
            obj.svcnvfile = tmp
        }
        if (vcf != '') {
            obj.vcffile = vcf
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
//.genome
function make_genome(div, genomes) {
    const genome_prompt = div.append('div')

    genome_prompt.append('span').text('Genome')

    const g_row = div.append('div')

    const select = g_row.append('select')
    for (const n in genomes) {
        select.append('option').text(n)
    }
}

//.name
function make_name(div) {
    const tk_name_prompt = div.append('div')

    tk_name_prompt.append('span').text('Track name')

    const tk_name_div = div.append('div')

    return tk_name_div
        .append('div')
        .append('input')
        .attr('size', 30)
}
// .isdense
function set_dense(div) {
    const is_dense_prompt = div.append('div')

    is_dense_prompt.append('span').text('Dense Display')

    const row = div.append('div')

    const is_dense_div = row.append('select')
    is_dense_div.append('input')
    is_dense_div.attr('type', 'checkbox')
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
        .attr('size', 55)
}
//.vcffile
function make_vcf(div) {
    const vcf_file_prompt = div.append('div')

    vcf_file_prompt.append('span').text('VCF file path')

    const vcf_file_div = div.append('div')

    return vcf_file_div
        .append('div')
        .append('input')
        .attr('size', 55)
}
//.expressionfile
function make_express_filepath(div) {
    const expression_file_prompt = div.append('div')

    expression_file_prompt.append('span').text('Gene expression file path')

    const expression_file_div = div.append('div')

    return expression_file_div
        .append('div')
        .append('input')
        .attr('size', 55)
}
// radio button for Sample Set track
function make_sampleset(div) {
    const sampleset_prompt = div.append('div')

    sampleset_prompt.append('span').text('Sample Sets')

    const row = div.append('div')
    const name = { 'Yes': 1, 'No': 2 }
    console.log(name)
    for (name.key in name) {
        // console.log(`${i}:${name.[i].key}`)
        const radio_btn = row.append('div')
            .style('margin-top', '3px')
            .style('display', 'inline-block')
        radio_btn.append('input')
            .attr('type', 'radio')
            .property('checked', false)
            .attr('name', name.key)
            .attr('id', name["key"])
            .on('change', () => {
                radio_btn.property('checked', true)
            })
        radio_btn.append('label')
            .attr('id', name["key"])
            .attr('for', name["key"])
            .text(name.key)
    }
}