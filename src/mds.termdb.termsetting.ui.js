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
		.html(obj.mainlabel ? obj.mainlabel + '&nbsp;' : 'Select term&nbsp;')

	add_term_button( div_addnewterm )
        .style('border-radius','6px')
        .html('&#43;')

	update_ui()
    obj.update_ui = update_ui

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

        if(!obj.is_term1){
            let term_name = obj.termsetting.term.name

            // trim long term name with '...' at end and hover to see full term_name
            if((obj.termsetting.term.isfloat || obj.termsetting.term.isinteger) && obj.termsetting.term.name.length >25){
                term_name = '<label title="'+obj.termsetting.term.name+'">'
                    +obj.termsetting.term.name.substring(0,24)+'...'
                    +'</label>'
            }else if(obj.termsetting.term.iscondition && obj.termsetting.term.name.length >20){
                term_name = '<label title="'+obj.termsetting.term.name+'">'
                    +obj.termsetting.term.name.substring(0,18)+'...'
                    +'</label>'
            }

            add_term_button( div_showterm )
                .html( term_name )
                .style('margin-bottom','2px')
                .style('border-radius', '6px 0px 0px 6px')
        }
        
        if(obj.termsetting.term.isfloat || obj.termsetting.term.isinteger){

            div_showterm
                .append('div')
                .style('font-size','1em')
                .attr('class','sja_filter_tag_btn')
                .style('margin-left','1px')
                .style('background','#4888BF')
                .style('padding','3px 6px')
                .html('BINS')
                .on('click',()=>{
                    // click to show ui and customize binning
                    numeric_bin_edit(obj.tip, obj.termsetting.term, obj.termsetting.term.q, obj.is_term1, (result)=>{
                        obj.termsetting.term.q = result
                        obj.callback(obj.termsetting.term)
                    })
                })

		} else if (obj.termsetting.term.iscondition){

            const [select, btn] = client.make_select_btn_pair( div_showterm )
            select.style('margin-left','1px')
				.on('change',()=>{
					const v = select.node().value
					if(v=='max') obj.termsetting.term.q = { value_by_max_grade:true, bar_by_grade:true }
					else if (v=='recent') obj.termsetting.term.q = { value_by_most_recent:true, bar_by_grade:true }
					else if (v=='any') obj.termsetting.term.q = { value_by_computable_grade:true, bar_by_grade:true }
					else if (v=='sub') obj.termsetting.term.q = { value_by_computable_grade:true, bar_by_children:true }
                    obj.termsetting.q = obj.termsetting.term.q
					__flip_select()
					obj.callback(obj.termsetting.term)
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
                .style('padding','3px 6px')
                .style('margin-left','1px')
                .style('margin-bottom','2px')
                .style('font-size','1em')
                .style('line-height','1.15')
                .style('position','static')
                .style('background-color', '#4888BF')
        
            if( !obj.termsetting.term.isleaf ){
                select.append('option')
                    .attr('value','sub')
                    .text('Sub-conditions')
				// for non-leaf term
                // grades are always compuatable for sub-condition
                // backend supports max/recent/computable grades
            }

			__flip_select()

			function __flip_select() {
				if( obj.termsetting.term.q.bar_by_children ) {
					select.node().value = 'sub'
					btn.html('Sub-conditions &#9662;')
				} else if(obj.termsetting.term.q.value_by_max_grade) {
					select.node().value = 'max'
					btn.html('Max grade per patient &#9662;')
				} else if(obj.termsetting.term.q.value_by_most_recent) {
					select.node().value = 'recent'
					btn.html('Most recent grade per patient &#9662;')
				} else if( obj.termsetting.term.q.value_by_computable_grade) {
					select.node().value = 'any'
					btn.html('Any grade per patient &#9662;')
				}
                select.style('width',btn.node().offsetWidth+'px')
                    .style('margin-left','-'+btn.node().offsetWidth+'px')

                if(obj.is_term1) btn.style('border-radius', '6px')
			}
        }

        // button to remove term
        if(!obj.is_term1){
            div_showterm
                .append('div')
                .attr('class','sja_filter_tag_btn')
                .style('margin-right','6px')
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
                    disable_terms: ( obj.termsetting.term ? new Set([ obj.currterm.id, obj.termsetting.term.id ]) : new Set([ obj.currterm.id ]) ),
                    callback: (term)=>{
                        obj.tip.hide()
						obj.termsetting.term = term
                        // assign default setting about this term
						if( term.iscategorical ) {
							// no need to assign
							delete obj.termsetting.term.q
                            delete obj.termsetting.q
						} else if( term.iscondition ) {
                            term.q = term.isleaf 
                                ? { value_by_max_grade:true, bar_by_grade:true  }
								: { value_by_computable_grade:true, bar_by_children:true }
                            obj.termsetting.q = term.q
						} else if( term.isfloat || term.isinteger ) {
							// TODO server provides binning scheme to add to it
						} else {
							throw 'unknown term type'
						}
                        obj.callback(term)
                        update_ui()
                    }
                }
            })
            obj.tip.showunder( d3event.target )
        })
	}

}

export function numeric_bin_edit(tip, term, term_q, is_term1, callback){
    
    let custom_bins_q, default_bins_q

    if(term_q && term_q.binconfig){
            
        //if bincoinfig initiated by user/by default
        custom_bins_q = JSON.parse(JSON.stringify(term_q.binconfig))

    }else if(term.graph.barchart.numeric_bin.bins){
        
        //if binconfig not defined yet or deleted by user, set it as numeric_bin.bins
        const bins = (term.graph.barchart.numeric_bin.bins_less && !is_term1) ? 
            term.graph.barchart.numeric_bin.bins_less :
            term.graph.barchart.numeric_bin.bins

        custom_bins_q = JSON.parse(JSON.stringify(bins))
    }
    // console.log(term_q)
    default_bins_q = (term.graph.barchart.numeric_bin.bins_less && !is_term1)? 
            term.graph.barchart.numeric_bin.bins_less :
            term.graph.barchart.numeric_bin.bins

    tip.clear().showunder(d3event.target)

    tip.d.style('padding','0px')

    const config_table = tip.d.append('table')
		.style('border-spacing','7px')
		.style('border-collapse','separate')

    //Bin Size edit row
    const bin_size_tr = config_table.append('tr')

    bin_size_tr.append('td')
        .style('margin','5px')
        .html('Bin Size')

    const bin_size_td = bin_size_tr.append('td')

    bin_size_edit()

    //First Bin edit row
    const first_bin_tr = config_table.append('tr')
    
    first_bin_tr.append('td')
        .style('margin','5px')
        .html('First Bin')

    const first_bin_td = first_bin_tr.append('td')   

    end_bin_edit(first_bin_td, 'first')

    //Last bin edit row
    const last_bin_tr = config_table.append('tr')
    
    last_bin_tr.append('td')
        .style('margin','5px')
        .html('Last Bin')

    const last_bin_td = last_bin_tr.append('td')
    
    const last_bin_select_div = last_bin_td.append('div')
    .style('display','none')

    // if last bin is not defined, it will be auto, can be edited from dropdown
    const last_bin_select = last_bin_select_div.append('select')
        .style('margin-left','15px')
        .style('margin-bottom','7px')
        .on('change',()=>{
            apply_last_bin_change()
        })  

    last_bin_select.append('option')
        .attr('value','auto')
        .html('Auto')

    last_bin_select.append('option')
        .attr('value','custom')
        .html('Custom Bin')

    if(Object.keys(custom_bins_q.last_bin).length === 0 && custom_bins_q.last_bin.constructor === Object){
        last_bin_select.node().selectedIndex = 0
    }else if(JSON.stringify(custom_bins_q.last_bin) != JSON.stringify(default_bins_q.last_bin)){
        last_bin_select.node().selectedIndex = 1
    }

    const last_bin_edit_div = last_bin_td.append('div')
        .style('display','none')

    apply_last_bin_change()

    end_bin_edit(last_bin_edit_div, 'last')

    function apply_last_bin_change(){
    
        if(last_bin_select.node().value == 'custom'){
            last_bin_edit_div.style('display','block')
        }else{
            const last_bin = default_bins_q.last_bin? default_bins_q.last_bin : {}
            term_q.binconfig.last_bin = JSON.parse(JSON.stringify(last_bin))
            custom_bins_q.last_bin = JSON.parse(JSON.stringify(last_bin))
            callback(term_q)
            last_bin_edit_div.style('display','none')
        }
    }  

    if(!default_bins_q.last_bin || (Object.keys(default_bins_q.last_bin).length === 0 && default_bins_q.last_bin.constructor === Object)){
        last_bin_select_div.style('display','block')
    }else{
        last_bin_edit_div.style('display','block')
    }

    // note for users to press enter to make changes to bins
    const note_tr = config_table.append('tr')

    note_tr.append('td')
    
    note_tr.append('td').append('div')
        .style('font-size','.6em')
        .style('margin-left','10px') 
        .style('color','#858585')   
        .text('Note: Press ENTER to update.')

    // reset row with 'reset to default' button if any changes detected
    const reset_bins_tr = config_table.append('tr')
        .style('display','none')

    const button_div = reset_bins_tr.append('div')
        .style('display','inline-block')

    // reset button    
    button_div.append('div')
        .style('font-size','.8em')
        .style('margin-left','10px')    
        .style('display','inline-block')
        .style('border-radius','5px')
        .attr('class','sja_menuoption')
        .text('RESET')
        .on('click',()=>{
            term_q.binconfig = JSON.parse(JSON.stringify(default_bins_q))
            custom_bins_q = JSON.parse(JSON.stringify(default_bins_q))
            callback(term_q)
            bin_size_edit()
            end_bin_edit(first_bin_td, 'first')
            end_bin_edit(last_bin_td, 'last')
            reset_bins_tr.style('display','none')
        })
    
    if(bins_customized(term_q.binconfig, default_bins_q)) reset_bins_tr.style('display','table-row')
    
    // function to edit bin_size options
    function bin_size_edit(){

        bin_size_td.selectAll('*').remove()
    
        const x = '<span style="font-family:Times;font-style:italic">x</span>'
        
        const bin_size_input = bin_size_td.append('input')
            .attr('type','number')
            .attr('value',custom_bins_q.bin_size)
            .style('margin-left','15px')
            .style('width','60px')
            .on('keyup', ()=>{
                if(!client.keyupEnter()) return
                bin_size_input.property('disabled',true)
                apply()
                bin_size_input.property('disabled',false).node().focus()
            })
        
        // select between start/stop inclusive
        const include_select = bin_size_td.append('select')
            .style('margin-left','10px')
            .on('change', ()=>{
                apply()
            })
        
        include_select.append('option')
            .attr('value','stopinclusive')
            .html('start &lt; ' + x + ' &le; end')
        include_select.append('option')
            .attr('value','startinclusive')
            .html('start &le; ' + x + ' &lt; end')
        
        include_select.node().selectedIndex =
            custom_bins_q.startinclusive ? 1 : 0
    
        function apply(){
    
            if(!term_q || !term_q.binconfig){
                term_q = {}
                term_q.binconfig = custom_bins_q
            }
    
            if(bin_size_input.node().value) term_q.binconfig.bin_size = parseFloat(bin_size_input.node().value)
            term_q.binconfig.stopinclusive = (include_select.node().value == 'stopinclusive')
            if(!term_q.binconfig.stopinclusive) term_q.binconfig.startinclusive = (include_select.node().value == 'startinclusive')

            if(bins_customized(term_q.binconfig, default_bins_q)) reset_bins_tr.style('display','table-row')
            callback(term_q)
        }
    }

    // function to edit first and last bin 
    function end_bin_edit(bin_edit_td, bin_flag){

        bin_edit_td.selectAll('*').remove()
    
        let bin
        if(bin_flag == 'first'){
            bin = custom_bins_q.first_bin
        }else if(bin_flag == 'last'){
            if(custom_bins_q.last_bin){
                bin = custom_bins_q.last_bin
            } 
            else{
                bin = {
                    start: '',
                    stop: ''
                }
            }
        }
    
        const start_input = bin_edit_td.append('input')
            .attr('type','number')
            .style('width','60px')
            .style('margin-left','15px')
            .on('keyup', async ()=>{
                if(!client.keyupEnter()) return
                start_input.property('disabled',true)
                await apply()
                start_input.property('disabled',false)
            })
      
        if(isFinite(bin.start_percentile)){
            start_input.attr('value',parseFloat(bin.start_percentile))
        }else if(isFinite(bin.start)){
            start_input.attr('value',parseFloat(bin.start))
        }
      
        // select realation between lowerbound and first bin/last bin
        let startselect
        if(bin_flag == 'first'){
            startselect = bin_edit_td.append('select')
                .style('margin-left','10px')
                .on('change', ()=>{
                    apply()
                })
      
            startselect.append('option')
                .html('&le;')
            startselect.append('option')
                .html('&lt;')
      
            startselect.node().selectedIndex =
                bin.startinclusive ? 0 : 1
        }else{
            bin_edit_td.append('div')
                .style('display','inline-block')
                .style('padding','3px 10px')
                .style('margin-left','10px')
                .style('width','15px')
                .html(custom_bins_q.startinclusive? ' &le;': ' &lt;')
        }
    
        const x = '<span style="font-family:Times;font-style:italic">x</span>'
    
        bin_edit_td.append('div')
            .style('display','inline-block')
            .style('padding','3px 10px')
            .html(x)
      
        // relation between first bin and upper value
        let stopselect
        if(bin_flag == 'first'){
            bin_edit_td.append('div')
                .style('display','inline-block')
                .style('padding','3px 10px')
                .style('margin-left','10px')
                .style('width','15px')
                .html(custom_bins_q.stopinclusive? ' &le;': ' &lt;')
        }else{
            stopselect = bin_edit_td.append('select')
                .style('margin-left','10px')
                .on('change', ()=>{
                    apply()
                })
      
            stopselect.append('option')
                .html('&le;')
            stopselect.append('option')
                .html('&lt;')
      
            stopselect.node().selectedIndex =
                bin.stopinclusive ? 0 : 1
        }
          
        const stop_input = bin_edit_td.append('input')
            .style('margin-left','10px')
            .attr('type','number')
            .style('width','60px')
            .on('keyup', async ()=>{
                if(!client.keyupEnter()) return
                stop_input.property('disabled',true)
                await apply()
                stop_input.property('disabled',false)
            })
      
        if(isFinite(bin.stop_percentile)){
            stop_input.attr('value',parseFloat(bin.stop_percentile))
        }else if(isFinite(bin.stop)){
            stop_input.attr('value',parseFloat(bin.stop))
        }
      
        // percentile checkbox
        const id = Math.random()
        const percentile_checkbox = bin_edit_td.append('input')
            .attr('type','checkbox')
            .style('margin','0px 5px 0px 10px')
            .attr('id',id)
            .on('change', async ()=>{
                try{
                    if(percentile_checkbox.node().checked){
                        if(parseFloat(start_input.node().value) >100 || parseFloat(start_input.node().value) <0 ||parseFloat(stop_input.node().value) >100 || parseFloat(stop_input.node().value) <0)
                        throw 'Percentile value must be within 0 to 100'
                    }
                }catch(e){
                    window.alert(e)
                }
            })
    
        bin_edit_td.append('label')
            .attr('for',id)
            .text('Percentile')
            .style('font-size','.8em')
            .attr('class','sja_clbtext')
      
        if(bin.start_percentile || bin.stop_percentile) percentile_checkbox.property('checked',true)
    
        function apply(){
            try{
                if(!term_q || !term_q.binconfig){
                    term_q = {}
                    term_q.binconfig = custom_bins_q
                }
        
                if(!term_q.binconfig.last_bin){
                    term_q.binconfig.last_bin = {}
                }
        
                if(start_input.node().value && stop_input.node().value && (start_input.node().value > stop_input.node().value)) 
                    throw 'start value must be smaller than stop value'

                if(percentile_checkbox.node().checked){
                    if(parseFloat(start_input.node().value) >100 || parseFloat(start_input.node().value) <0 ||parseFloat(stop_input.node().value) >100 || parseFloat(stop_input.node().value) <0)
                    throw 'Percentile value must be within 0 to 100'
                }
                
                //first_bin parameter setup from input
                if(bin_flag == 'first'){
        
                    if(start_input.node().value){
                        delete term_q.binconfig.first_bin.startunbounded
                        if(percentile_checkbox.node().checked) term_q.binconfig.first_bin.start_percentile = parseFloat(start_input.node().value)
                        else term_q.binconfig.first_bin.start = parseFloat(start_input.node().value)
                    }else{
                        delete term_q.binconfig.first_bin.start
                        delete term_q.binconfig.first_bin.start_percentile
                        term_q.binconfig.first_bin.startunbounded = true
                    }
                    if(stop_input.node().value){
                        if(percentile_checkbox.node().checked) term_q.binconfig.first_bin.stop_percentile = parseFloat(stop_input.node().value)
                        else term_q.binconfig.first_bin.stop = parseFloat(stop_input.node().value)
                    }else if(!start_input.node().value) throw 'If start is empty, stop is required for first bin.' 
            
                    if(startselect.node().selectedIndex == 0) term_q.binconfig.first_bin.startinclusive = true
                    else if(term_q.binconfig.first_bin.startinclusive) delete term_q.binconfig.first_bin.startinclusive
                    
                    // if percentile checkbox is unchecked, delete start/stop_percentile
                    if(!percentile_checkbox.node().checked){
                        delete term_q.binconfig.first_bin.start_percentile
                        delete term_q.binconfig.first_bin.stop_percentile
                    }
                }
        
                //last_bin parameter setup from input
                else if(bin_flag == 'last'){
        
                    if(start_input.node().value){
                        if(percentile_checkbox.node().checked) term_q.binconfig.last_bin.start_percentile = parseFloat(start_input.node().value)
                        else term_q.binconfig.last_bin.start = parseFloat(start_input.node().value)
                    }else if(!stop_input.node().value) throw 'If stop is empty, start is required for last bin.'
            
                    if(stop_input.node().value) {
                        delete term_q.binconfig.last_bin.stopunbounded
                        if(percentile_checkbox.node().checked) term_q.binconfig.last_bin.stop_percentile = parseFloat(stop_input.node().value)
                        else term_q.binconfig.last_bin.stop = parseFloat(stop_input.node().value)
                    }else{
                        delete term_q.binconfig.last_bin.stop
                        delete term_q.binconfig.last_bin.stop_percentile
                        term_q.binconfig.last_bin.stopunbounded = true
                    }
            
                    if(stopselect.node().selectedIndex == 0) term_q.binconfig.last_bin.stopinclusive = true
                    else if(term_q.binconfig.last_bin.stopinclusive) delete term_q.binconfig.last_bin.stopinclusive
            
                    // if percentile checkbox is unchecked, delete start/stop_percentile
                    if(!percentile_checkbox.node().checked){
                        delete term_q.binconfig.last_bin.start_percentile
                        delete term_q.binconfig.last_bin.stop_percentile
                    }
                
                }
                if(bins_customized(term_q.binconfig, default_bins_q)) reset_bins_tr.style('display','table-row')
                callback(term_q)
            }catch(e){
                window.alert(e)
            }
        }
    }

    function bins_customized(custom_bins_q, default_bins_q){
        if(custom_bins_q && default_bins_q){
            if(custom_bins_q.bin_size == default_bins_q.bin_size &&
                custom_bins_q.stopinclusive == default_bins_q.stopinclusive &&
                JSON.stringify(custom_bins_q.first_bin) == JSON.stringify(default_bins_q.first_bin)){
                    if(default_bins_q.last_bin && JSON.stringify(custom_bins_q.last_bin) == JSON.stringify(default_bins_q.last_bin)){
                        return false
                    }else if((Object.keys(custom_bins_q.last_bin).length === 0 && custom_bins_q.last_bin.constructor === Object)){
                        return false
                    }
            }else{
                return true
            }
        }
    }
}
