import * as client from './client'
import {init} from './mds.termdb'

/*
********************** EXPORTED
display
********************** INTERNAL
*/

export async function display (holder, obj, callback){
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

    const terms_div = holder.append('div')
        .style('display','inline-block')
        .style('margin-bottom','5px')

    const tip = obj.tk.legend.tip

    // add new term
    obj.d.add_term_info = terms_div.append('div')
        .style('display','inline-block')
        .style('margin-right','7px')
        .text('Select a term to overlay')

    obj.d.term_button = terms_div.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('padding','3px 7px')
        .style('display','inline-block')
        .style('border-radius','6px')
        .style('background-color', '#4888BF')
        .html('&#43;')
        .on('click',async ()=>{
            
            tip.clear()
            .showunder( obj.d.term_button.node() )

            const treediv = tip.d.append('div')

            // a new object as init() argument for launching the tree with modifiers
            init({
                genome: obj.block.genome,
                mds: obj.tk.mds,
                div: treediv,
                default_rootterm: true,
                modifier_click_term:{
                    disable_terms: ( obj.overlay_term ? new Set([ obj.overlay_term.id ]) : undefined ),
                    callback: (t)=>{
                        tip.hide()
                        obj.overlay_term = t
                        // assign default setting about this term
							if( t.iscondition ) {
								if( t.isleaf ) {
									obj.overlay_term_q = { value_by_max_grade:true  }
								} else {
									obj.overlay_term_q = { value_by_max_grade:true, bar_by_children:true }
								}
							} else {
								delete obj.overlay_term_q
							}
                        callback(obj)
                        update_term_button(obj)
                    }
                }
            })
        })

    obj.d.delete_term_button = terms_div.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('display','none')
        .style('margin-right','10px')
        .style('margin-left','1px')
        .style('background','#4888BF')
        .style('border-radius','0 6px 6px 0')
        .style('color','white')
        .style('padding','3px 6px')
        .html('&times;')
        .on('click',()=>{
            delete obj.overlay_term
            update_term_button(obj)
            callback(obj)
        }) 

    function update_term_button(obj){
        if( obj.overlay_term ) {

            obj.d.add_term_info.style('display','none')
    
            obj.d.term_button
                .style('border-radius','6px 0 0 6px')
                .text( obj.overlay_term.name )
            
            obj.d.delete_term_button.style('display','inline-block')
        } else {

            obj.d.add_term_info.style('display','inline-block')

            obj.d.term_button
                .style('border-radius','6px')
                .html('&#43;')

            obj.d.delete_term_button.style('display','none')

        }
    }

}

