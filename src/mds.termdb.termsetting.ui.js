import * as client from './client'
import {init} from './mds.termdb'
import {selectAll} from 'd3-selection'

/*
********************** EXPORTED
display
********************** INTERNAL
*/

export async function termui_display (obj){
    /*
    group{}
        .terms[]
            .term{}
            .values[]
            .range{}
            .iscategorical
            .isinteger
            .isfloat
            .isnot
    */

    let overlay_term, term_q

    const terms_div = obj.holder.append('div')
        .style('display','inline-block')
        .style('margin-bottom','5px')

    // add new term
    terms_div.add_term_info = terms_div.append('div')
        .style('display','inline-block')
        .style('margin-right','7px')
        .text('Select a term to overlay')

    //'+' button
    terms_div.term_button = terms_div.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('padding','3px 7px')
        .style('display','inline-block')
        .style('border-radius','6px')
        .style('background-color', '#4888BF')
        .html('&#43;')
        .on('click',async ()=>{
            
            obj.tip.clear()
            .showunder( terms_div.term_button.node() )

            const treediv = obj.tip.d.append('div')

            // a new object as init() argument for launching the tree with modifiers
            init({
                genome: obj.genome,
                mds: obj.mds,
                div: treediv,
                default_rootterm: true,
                modifier_click_term:{
                    disable_terms: ( obj.overlay_term ? new Set([ obj.overlay_term.id ]) : undefined ),
                    callback: (t)=>{
                        obj.tip.hide()
                        overlay_term = t
                        // assign default setting about this term
							if( t.iscondition ) {
								if( t.isleaf ) {
									term_q = { value_by_max_grade:true  }
								} else {
									term_q = { value_by_max_grade:true, bar_by_children:true }
								}
							} else {
								term_q = undefined
							}
                        obj.callback(overlay_term, term_q)
                        update_term_button(terms_div)
                    }
                }
            })
        }) 

    function update_term_button(terms_div){

        if( overlay_term ) {

            terms_div.add_term_info.style('display','none')
    
            terms_div.term_button
                .style('border-radius','6px 0 0 6px')
                .text( overlay_term.name )
            
            const edit_div = terms_div.append('div')
                .style('display','inline-block')

            if(overlay_term.isfloat || overlay_term.isinteger){

                const custom_bin_div = edit_div.append('div')
                    .attr('class','sja_filter_tag_btn')
                    .style('margin-left','1px')
                    .style('background','#4888BF')
                    .style('padding','3px 6px')
                    .html('BINS')

                //TODO: create tip with 3 buttons
                //TODO: change custom bins from the buttons

            }else if(overlay_term.iscondition){

                const [grade_type_select, grade_type_btn] = client.make_select_btn_pair(edit_div)
                grade_type_select.style('margin-right','1px')

                grade_type_select.append('option')
                .attr('value','max')
                .text('Max grade per patient')
    
                grade_type_select.append('option')
                    .attr('value','recent')
                    .text('Most recent grade per patient')

                grade_type_select.append('option')
                    .attr('value','any')
                    .text('Any grade per patient')
        
                grade_type_btn
                    .style('padding','2px 4px 3px 4px')
                    .style('margin-right','1px')
                    .style('font-size','1em')
                    .style('background-color', '#4888BF')
        
                if(overlay_term.value_by_max_grade){
                    grade_type_btn.html('(Max grade per patient) &#9662;')
                    grade_type_select.node().value = 'max'
        
                }else if(overlay_term.value_by_most_recent){
                    grade_type_btn.html('(Most recent grade per patient) &#9662;')
                    grade_type_select.node().value = 'recent'
                }
        
                grade_type_select.style('width',grade_type_btn.node().offsetWidth+'px')

                if(overlay_term.isleaf){
                    
                    //TODO: on change update term_q
                    
                }else{

                    grade_type_select.append('option')
                        .attr('value','sub')
                        .text('Sub-condition')

                    //TODO: on change update term_q

                }

            }

            //button to remove overlay term
            const delete_term_button = edit_div.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('margin-right','10px')
                .style('margin-left','1px')
                .style('background','#4888BF')
                .style('border-radius','0 6px 6px 0')
                .style('padding','3px 6px')
                .html('&times;')
                .on('click',()=>{
                    overlay_term = undefined
                    term_q = undefined
                    obj.callback(overlay_term, term_q)
                    
                    edit_div.selectAll('*').remove()
                    update_term_button(terms_div)
                })
        } else {

            terms_div.add_term_info.style('display','inline-block')

            terms_div.term_button
                .style('border-radius','6px')
                .html('&#43;')

        }
    }

}

