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

            div_showterm
				.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('margin-left','1px')
                .style('background','#4888BF')
                .style('padding','3px 6px')
                .html('BINS')
                .on('click',()=>{
                    // click to show ui and customize binning
                    make_numeric_bin_btns(obj.tip, obj.termsetting.term, obj.termsetting.q, (result)=>{
                        obj.termsetting.q = result
                        obj.callback()
                    })
                })

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
                    callback: (term)=>{
                        obj.tip.hide()
						obj.termsetting.term = term
                        // assign default setting about this term
						if( term.iscategorical ) {
							// no need to assign
							delete obj.termsetting.q
						} else if( term.iscondition ) {
							if( term.isleaf ) {
								obj.termsetting.q = { value_by_max_grade:true, bar_by_grade:true  }
							} else {
								obj.termsetting.q = { value_by_max_grade:true, bar_by_children:true }
							}
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

export function make_numeric_bin_btns(tip, term, callback){
    
    tip.clear().showunder(d3event.target)

    const bin_edit_tip = new client.Menu({padding:'0'})

    const bin_edit_div = tip.d.append('div')
        .style('margin','10px')

    const bin_size_div = bin_edit_div.append('div')
        .html('Bin Size')

    const bin_size_btn = bin_size_div.append('div')
        .attr('class','sja_edit_btn')

    const first_bin_div = bin_edit_div.append('div')
        .html('First Bin')

    const first_bin_btn = first_bin_div.append('div')
        .attr('class','sja_edit_btn')

    const last_bin_div = bin_edit_div.append('div')
        .html('Last Bin')

    const last_bin_btn = last_bin_div.append('div')
        .attr('class','sja_edit_btn')

    update_btn(term.q)

    function update_btn(term_q_callback){

        let custom_bins_q

        if(term_q_callback && term_q_callback.binconfig){
            
            //if bincoinfig initiated by user/by default
            custom_bins_q = term_q_callback.binconfig

        }else if(term.graph.barchart.numeric_bin.bins){
            
            //if binconfig not defined yet or deleted by user, set it as numeric_bin.bins
            const bins = term.graph.barchart.numeric_bin.bins
            custom_bins_q = {
                bin_size: bins.bin_size,
                startinclusive: bins.startinclusive,
                stopinclusive: bins.stopinclusive,
                first_bin:{
                    stop: bins.first_bin.stop,
                    startunbounded: bins.first_bin.startunbounded,
                    startinclusive: bins.first_bin.startinclusive,
                    stopinclusive: bins.first_bin.stopinclusive
                }
            }

            if(bins.first_bin.start) custom_bins_q.first_bin.start = bins.first_bin.start
            if(bins.last_bin && bins.last_bin.start){
                custom_bins_q.last_bin = {
                    start: bins.last_bin.start,
                    stopunbounded: bins.last_bin.stopunbounded,
                    startinclusive: bins.last_bin.startinclusive,
                    stopinclusive: bins.last_bin.stopinclusive
                }
            if(bins.last_bin.stop) custom_bins_q.last_bin.stop = bins.last_bin.stop
            }
        }

        const x = '<span style="font-family:Times;font-style:italic">x</span>'

        bin_size_btn.text(custom_bins_q.bin_size + ' ' + (term.unit?term.unit:''))
            .on('click', () => {
                bin_size_menu(bin_edit_tip, custom_bins_q, term_q_callback, update_btn, callback)
            })

        let first_bin_start, first_bin_stop, last_bin_start, last_bin_stop

        first_bin_start = isFinite(custom_bins_q.first_bin.start_percentile) ? custom_bins_q.first_bin.start_percentile 
        : isFinite(custom_bins_q.first_bin.start) ? custom_bins_q.first_bin.start : undefined

        first_bin_stop = isFinite(custom_bins_q.first_bin.stop_percentile) ? custom_bins_q.first_bin.stop_percentile 
        : isFinite(custom_bins_q.first_bin.stop) ? custom_bins_q.first_bin.stop : undefined

        if(custom_bins_q.last_bin){
            last_bin_start = isFinite(custom_bins_q.last_bin.start_percentile) ? custom_bins_q.last_bin.start_percentile 
            : isFinite(custom_bins_q.last_bin.start) ? custom_bins_q.last_bin.start : undefined

            last_bin_stop = isFinite(custom_bins_q.last_bin.stop_percentile) ? custom_bins_q.last_bin.stop_percentile 
            : isFinite(custom_bins_q.last_bin.stop) ? custom_bins_q.last_bin.stop : undefined
        }

        //update first_bin button
        if( isFinite(first_bin_start) &&  isFinite(first_bin_stop)){
            first_bin_btn.html(
                first_bin_start +
                ' '+ (custom_bins_q.first_bin.startinclusive?'&le;':'&lt;')+
                ' '+ x+
                ' '+ (custom_bins_q.first_bin.stopinclusive? '&le;':'&lt;')+
                ' '+ first_bin_stop +
                ' '+ ((isFinite(custom_bins_q.first_bin.start_percentile) || isFinite(custom_bins_q.first_bin.stop_percentile))?'Percentile':
                term.unit?term.unit:'')
            )
        }else if(isFinite(first_bin_start)){
            first_bin_btn.html(
                x +
                ' '+ (custom_bins_q.first_bin.startinclusive?'&ge;':'&gt;')+
                ' '+ first_bin_start +
                ' '+ (isFinite(custom_bins_q.first_bin.start_percentile)? 'Percentile' : term.unit?term.unit:'')
        )
        }else if(isFinite(first_bin_stop)){
            first_bin_btn.html(
                x+
                ' '+ (custom_bins_q.first_bin.stopinclusive? '&le;':'&lt;')+
                ' '+ first_bin_stop +
                ' '+ (isFinite(custom_bins_q.first_bin.stop_percentile)? 'Percentile' :term.unit?term.unit:'')
            )
        }else{
            first_bin_btn.text('EDIT')
        }

        first_bin_btn.on('click', () => {
            edit_bin_menu(bin_edit_tip, custom_bins_q, term_q_callback, 'first', update_btn, callback)
        })

        //update last_bin button
        if(custom_bins_q.last_bin){
            if( isFinite(last_bin_start) &&  isFinite(last_bin_stop)){
                last_bin_btn.html(
                    last_bin_start +
                    ' '+ (custom_bins_q.last_bin.startinclusive?'&le;':'&lt;')+
                    ' '+ x+
                    ' '+ (custom_bins_q.last_bin.stopinclusive? '&le;':'&lt;')+
                    ' '+ last_bin_stop +
                    ' '+ ((isFinite(custom_bins_q.last_bin.start_percentile) || isFinite(custom_bins_q.last_bin.stop_percentile))?'Percentile':
                    term.unit?term.unit:'')
            )
            }else if(isFinite(last_bin_start)){
                last_bin_btn.html(
                    x +
                    ' '+ (custom_bins_q.last_bin.startinclusive?'&ge;':'&gt;')+
                    ' '+ last_bin_start +
                    ' '+ (isFinite(custom_bins_q.last_bin.start_percentile)? 'Percentile' : term.unit?term.unit:'')
             )
            }else if(isFinite(last_bin_stop)){
                last_bin_btn.html(
                    x+
                    ' '+ (custom_bins_q.last_bin.stopinclusive? '&le;':'&lt;')+
                    ' '+ last_bin_stop +
                    ' '+ (isFinite(custom_bins_q.last_bin.stop_percentile)? 'Percentile' :term.unit?term.unit:'')
                )
            }else last_bin_btn.text('EDIT')
        }else{
            last_bin_btn.text('EDIT')
        }

        last_bin_btn.on('click', () => {
            edit_bin_menu(bin_edit_tip, custom_bins_q, term_q_callback, 'last', update_btn, callback)
        })
    }
}

function bin_size_menu(bin_edit_tip, custom_bins_q, term_q, update_btn, callback){

    bin_edit_tip.clear().showunder(d3event.target)

    const bin_size_div = bin_edit_tip.d.append('div')
        .style('display','block')
        .style('padding','3px 5px')
  
    const x = '<span style="font-family:Times;font-style:italic">x</span>'
  
    bin_size_div.append('div')
        .style('display','inline-block')
        .style('padding','3px 10px')
        .html('Bin Size')
  
    const bin_size_input = bin_size_div.append('input')
        .attr('type','number')
        .attr('value',custom_bins_q.bin_size)
        .style('width','60px')
        .on('keyup', async ()=>{
            if(!client.keyupEnter()) return
            bin_size_input.property('disabled',true)
            apply()
            bin_size_input.property('disabled',false)
        })
  
    // select between start/stop inclusive
    const include_select = bin_size_div.append('select')
        .style('margin-left','10px')
  
    include_select.append('option')
        .attr('value','stopinclusive')
        .html('start &lt; ' + x + ' &le; end')
    include_select.append('option')
        .attr('value','startinclusive')
        .html('start &le; ' + x + ' &lt; end')
  
    include_select.node().selectedIndex =
      custom_bins_q.startinclusive ? 1 : 0 
  
    bin_edit_tip.d.append('div')
        .attr('class','sja_menuoption')
        .style('text-align','center')
        .text('APPLY')
        .on('click', ()=>{
            apply()
        })
  
    if(term_q && term_q.binconfig){
        bin_edit_tip.d.append('div')
            .attr('class','sja_menuoption')
            .style('text-align','center')
            .html('RESET')
            .on('click', ()=>{
                delete term_q.binconfig
                callback(term_q)
                bin_edit_tip.hide()
                update_btn(term_q)
            })
    }
  
    function apply(){
        if(!term_q || !term_q.binconfig){
            term_q = {}
            term_q.binconfig = custom_bins_q
        }
  
        if(bin_size_input.node().value) term_q.binconfig.bin_size = parseFloat(bin_size_input.node().value)
        term_q.binconfig.startinclusive = (include_select.node().value == 'startinclusive')
        term_q.binconfig.stopinclusive = (include_select.node().value == 'stopinclusive')

        callback(term_q)
        bin_edit_tip.hide()
        update_btn(term_q)
    }
  
}

function edit_bin_menu(bin_edit_tip, custom_bins_q, term_q, bin_flag, update_btn, callback){
  
    bin_edit_tip.clear().showunder(d3event.target)
  
    let bin
    if(bin_flag == 'first'){
        bin = custom_bins_q.first_bin
    }else if(bin_flag == 'last'){
        if(custom_bins_q.last_bin) bin = custom_bins_q.last_bin
        else{
            bin = {
                start: '',
                stop: ''
            }
        }
    }
  
    const bin_edit_div = bin_edit_tip.d.append('div')
        .style('display','block')
        .style('padding','3px 5px')
  
    const start_input = bin_edit_div.append('input')
        .attr('type','number')
        .style('width','60px')
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
        startselect = bin_edit_div.append('select')
            .style('margin-left','10px')
  
        startselect.append('option')
            .html('&le;')
        startselect.append('option')
            .html('&lt;')
  
        startselect.node().selectedIndex =
            bin.startinclusive ? 0 : 1
    }else{
        bin_edit_div.append('div')
            .style('display','inline-block')
            .style('padding','3px 10px')
            .html(custom_bins_q.startinclusive? ' &le;': ' &lt;')
    }
  
    const x = '<span style="font-family:Times;font-style:italic">x</span>'
  
    bin_edit_div.append('div')
        .style('display','inline-block')
        .style('padding','3px 10px')
        .html(x)
  
    // relation between first bin and upper value
    let stopselect
    if(bin_flag == 'first'){
        bin_edit_div.append('div')
            .style('display','inline-block')
            .style('padding','3px 10px')
            .html(custom_bins_q.stopinclusive? ' &le;': ' &lt;')
    }else{
        stopselect = bin_edit_div.append('select')
            .style('margin-left','10px')
  
        stopselect.append('option')
            .html('&le;')
        stopselect.append('option')
            .html('&lt;')
  
        stopselect.node().selectedIndex =
            bin.stopinclusive ? 0 : 1
    }
      
    const stop_input = bin_edit_div.append('input')
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
    const percent_div = bin_edit_div.append('div')
        .style('margin-top','10px')
        .html('Input as Percentile')
      
    const id = Math.random()
    const percent_input = percent_div.append('input')
        .attr('id',id)
        .attr('type','checkbox')
        .attr('value','percent')
        .style('margin-left','10px')
  
    if(bin.start_percentile || bin.stop_percentile) percent_input.property('checked',true)
  
    bin_edit_tip.d.append('div')
        .attr('class','sja_menuoption')
        .style('text-align','center')
        .text('APPLY')
        .on('click', ()=>{
            apply()
        })
  
    if(term_q && term_q.binconfig){
        bin_edit_tip.d.append('div')
            .attr('class','sja_menuoption')
            .style('text-align','center')
            .html('RESET')
            .on('click', ()=>{
                delete term_q.binconfig
                callback(term_q)
                bin_edit_tip.hide()
                update_btn(term_q)
            })
    }
  
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
            
            //first_bin parameter setup from input
            if(bin_flag == 'first'){
    
                if(start_input.node().value){
                    if(percent_input.node().checked) term_q.binconfig.first_bin.start_percentile = parseFloat(start_input.node().value)
                    else term_q.binconfig.first_bin.start = parseFloat(start_input.node().value)
                }else{
                    delete term_q.binconfig.first_bin.start
                    delete term_q.binconfig.first_bin.start_percentile
                    term_q.binconfig.first_bin.startunbounded = true
                }
                if(stop_input.node().value){
                    if(percent_input.node().checked) term_q.binconfig.first_bin.stop_percentile = parseFloat(stop_input.node().value)
                    else term_q.binconfig.first_bin.stop = parseFloat(stop_input.node().value)
                }else if(!start_input.node().value) throw 'If start is empty, stop is required for first bin.' 
        
                if(start_input.node().selectedIndex == 0) term_q.binconfig.first_bin.startinclusive = true
                else term_q.binconfig.first_bin.startinclusive = false
                
                // if percentile checkbox is unchecked, delete start/stop_percentile
                if(!percent_input.node().checked){
                    delete term_q.binconfig.first_bin.start_percentile
                    delete term_q.binconfig.first_bin.stop_percentile
                }
            }
    
            //last_bin parameter setup from input
            else if(bin_flag == 'last'){
    
                if(start_input.node().value){
                    if(percent_input.node().checked) term_q.binconfig.last_bin.start_percentile = parseFloat(start_input.node().value)
                    else term_q.binconfig.last_bin.start = parseFloat(start_input.node().value)
                }else if(!stop_input.node().value) throw 'If stop is empty, start is required for last bin.'
        
                if(stop_input.node().value) {
                    if(percent_input.node().checked) term_q.binconfig.last_bin.stop_percentile = parseFloat(stop_input.node().value)
                    else term_q.binconfig.last_bin.stop = parseFloat(stop_input.node().value)
                }else{
                    delete term_q.binconfig.last_bin.stop
                    delete term_q.binconfig.last_bin.stop_percentile
                    term_q.binconfig.last_bin.stopunbounded = true
                }
        
                if(stop_input.node().selectedIndex == 0) term_q.binconfig.last_bin.stopinclusive = true
                else term_q.binconfig.last_bin.stopinclusive = false
        
                // if percentile checkbox is unchecked, delete start/stop_percentile
                if(!percent_input.node().checked){
                    delete term_q.binconfig.last_bin.start_percentile
                    delete term_q.binconfig.last_bin.stop_percentile
                }
            
            }
            callback(term_q)
            bin_edit_tip.hide()
            update_btn(term_q)
        }catch(e){
            window.alert(e)
        }
    }
  
}

