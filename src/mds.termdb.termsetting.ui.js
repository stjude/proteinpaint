import * as client from './client'
import {init} from './mds.termdb'
import {event as d3event} from 'd3-selection'





export async function display (obj){
/*
.genome{}
.mds{}
.holder
.tip
.termsetting{}
	.term{}
	.q{}
.callback()
*/
	// if term is not selected, show first; otherwise, show second
	const div_addnewterm = obj.holder.append('div')
	const div_showterm = obj.holder.append('div')

    div_addnewterm
		.append('span')
		.html('Select a term to overlay&nbsp;')

	add_term_button( div_addnewterm )
        .style('border-radius','6px')
        .html('&#43;')

	update_ui()

    function update_ui () {

        if( !obj.termsetting.term ) {
			// no term is selected
			div_addnewterm.style('display','block')
			div_showterm.style('display','none')
			return
        }

		// a term is selected
		div_addnewterm.style('display','none')
		div_showterm
			.style('display','block')
			.selectAll('*').remove()

		add_term_button( div_showterm )
			.text( obj.termsetting.term.name )
			.style('border-radius', '6px 0px 0px 6px')

        if(obj.termsetting.term.isfloat || obj.termsetting.term.isinteger){

            const custom_bin_div = div_showterm
				.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('margin-left','1px')
                .style('background','#4888BF')
                .style('padding','3px 6px')
                .html('BINS')

			// TODO click to show ui and customize binning

		} else if (obj.termsetting.term.iscondition){

            const [select, btn] = client.make_select_btn_pair( div_showterm )
            select.style('margin-left','1px')
				.on('change',()=>{
					const v = select.node().value
					if(v=='max') obj.termsetting.q = { value_by_max_grade:true, bar_by_grade:true }
					else if (v=='recent') obj.termsetting.q = { value_by_most_recent:true, bar_by_grade:true }
					else if (v=='any') obj.termsetting.q = { value_by_computable_grade:true, bar_by_grade:true }
					else if (v=='sub') obj.termsetting.q = { value_by_max_grade:true, bar_by_children:true }
					__flip_select()
					__flip_select2()
					obj.callback()
				})

            select.append('option')
                .attr('value','max')
                .text('Max grade per patient')
    
            select.append('option')
                .attr('value','recent')
                .text('Most recent grade per patient')

            select.append('option')
                .attr('value','any')
                .text('Any grade per patient')
        
            btn
                .style('padding','3px 7px')
                .style('margin-left','1px')
                .style('background-color', '#4888BF')
        
			let select2, btn2
            if( !obj.termsetting.term.isleaf ){
                select.append('option')
                    .attr('value','sub')
                    .text('Sub-conditions')
				// for non-leaf term
				// need a second <select> for selecting max/recent/computable when first select is subcondition
				const [s, b] = client.make_select_btn_pair( div_showterm )
				select2 = s
				btn2 = b
				select2.style('margin-left','1px')
					.on('change',()=>{
						delete obj.termsetting.q.value_by_max_grade
						delete obj.termsetting.q.value_by_most_recent
						delete obj.termsetting.q.value_by_computable_grade
						const v = select2.node().value
						if(v=='max') obj.termsetting.q.value_by_max_grade=true
						else if (v=='recent') obj.termsetting.q.value_by_most_recent=true
						else if (v=='any') obj.termsetting.q.value_by_computable_grade=true
						__flip_select2()
						obj.callback()
					})

				select2.append('option')
					.attr('value','max')
					.text('Max grade per patient')
				select2.append('option')
					.attr('value','recent')
					.text('Most recent grade per patient')
				select2.append('option')
					.attr('value','any')
					.text('Any grade per patient')
				btn2
					.style('padding','3px 7px')
					.style('margin-left','1px')
					.style('background-color', '#4888BF')
            }

			__flip_select()
			__flip_select2()

			function __flip_select() {
				if( obj.termsetting.q.bar_by_children ) {
					select.node().value = 'sub'
					btn.html('Sub-conditions &#9662;')
				} else if(obj.termsetting.q.value_by_max_grade) {
					select.node().value = 'max'
					btn.html('Max grade per patient &#9662;')
				} else if(obj.termsetting.q.value_by_most_recent) {
					select.node().value = 'recent'
					btn.html('Most recent grade per patient &#9662;')
				} else if( obj.termsetting.q.value_by_computable_grade) {
					select.node().value = 'any'
					btn.html('Any grade per patient &#9662;')
				}
            	select.style('width',btn.node().offsetWidth+'px')
			}
			function __flip_select2() {
				if(!select2) return
				if(!obj.termsetting.q.bar_by_children) {
					select2.style('display','none')
					btn2.style('display','none')
					return
				}
				select2.style('display','inline-block')
				btn2.style('display','inline-block')
				if(obj.termsetting.q.value_by_max_grade) {
					select2.node().value = 'max'
					btn2.html('Max grade per patient &#9662;')
				} else if(obj.termsetting.q.value_by_most_recent) {
					select2.node().value = 'recent'
					btn2.html('Most recent grade per patient &#9662;')
				} else if( obj.termsetting.q.value_by_computable_grade) {
					select2.node().value = 'any'
					btn2.html('Any grade per patient &#9662;')
				}
            	select2.style( 'width', btn2.node().offsetWidth+'px' )
			}
        }

        // button to remove term
        div_showterm
			.append('div')
            .attr('class','sja_filter_tag_btn')
            .style('margin-right','10px')
            .style('margin-left','1px')
            .style('background','#4888BF')
            .style('border-radius','0 6px 6px 0')
            .style('padding','3px 6px')
            .html('&times;')
            .on('click',()=>{
				delete obj.termsetting.term
				update_ui()
                obj.callback()
            })
	}


	function add_term_button ( holder ) {
		// adds a blue button, returns the button
		// for labeling
		return holder.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('padding','3px 7px')
        .style('display','inline-block')
        .style('background-color', '#4888BF')
        .on('click',async ()=>{
            obj.tip.clear()
            init({
                genome: obj.genome,
                mds: obj.mds,
                div: obj.tip.d,
                default_rootterm: true,
                modifier_click_term:{
                    disable_terms: ( obj.termsetting.term ? new Set([ obj.termsetting.term.id ]) : undefined ),
                    callback: (t)=>{
                        obj.tip.hide()
						obj.termsetting.term = t
                        // assign default setting about this term
						if( t.iscategorical ) {
							// no need to assign
							delete obj.termsetting.q
						} else if( t.iscondition ) {
							if( t.isleaf ) {
								obj.termsetting.q = { value_by_max_grade:true, bar_by_grade:true  }
							} else {
								obj.termsetting.q = { value_by_max_grade:true, bar_by_children:true }
							}
						} else if( t.isfloat || t.isinteger ) {
							// TODO server provides binning scheme to add to it
						} else {
							throw 'unknown term type'
						}
                        obj.callback()
                        update_ui()
                    }
                }
            })
            obj.tip.showunder( d3event.target )
        })
	}

}

