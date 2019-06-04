import * as client from './client'
import {init} from './mds.termdb'


/*
********************** EXPORTED
display
to_parameter
********************** INTERNAL
*/



export async function display ( group_div, group, mds, genome, count_limit_vcf, callback){
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

    const terms_div = group_div.append('div')
        .style('display','inline-block')

    const tip = new client.Menu({padding:'0'})

    update_terms(terms_div)


    // add new term
    const add_term_btn = group_div.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('padding','2px 7px')
        .style('margin-left','10px')
        .style('border-radius','6px')
        .style('background-color', '#4888BF')
        .html('&#43;')
        .on('click',async ()=>{
            
            tip.clear()
            .showunder( add_term_btn.node() )

            const treediv = tip.d.append('div')

            // a new object as init() argument for launching the tree with modifiers
            const obj = {
                genome: genome,
                mds: mds,
                div: treediv,
                default_rootterm: {},
                modifier_barchart_selectbar: {
                    callback: result => {
                        tip.hide()
                        add_term(result)
                    }
                }
            }
            init(obj)
        })


	// all private functions below


    function update_terms(terms_div){

        terms_div.selectAll('*').remove()

        for(const [i, term] of group.terms.entries()){

            const term_name_btn = terms_div.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('border-radius','6px 0 0 6px')
                .style('background-color', '#4888BF')
                .style('padding','7px 6px 5px 6px')
                .style('margin-left', '5px')
                .style('font-size','.7em')
                .text(term.term.name)
                .style('text-transform','uppercase')
                .on('click',async ()=>{
                    
                    tip.clear()
                    .showunder( term_name_btn.node() )

                    const treediv = tip.d.append('div')

                    // a new object as init() argument for launching the tree with modifiers
                    const obj = {
                        genome: genome,
                        mds: mds,
                        div: treediv,
                        default_rootterm: {},
                        modifier_barchart_selectbar: {
                            callback: result => {
                                tip.hide()
                                replace_term(result, i)
                                callback()
                                update_terms(terms_div)
                            }
                        }
                    }
                    init(obj)
                })

            const condition_btn = terms_div.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('background-color','#eeeeee')
                .style('font-size','.7em')
                .style('padding','7px 6px 5px 6px')

            if(term.term.iscategorical){
                condition_btn
                    .text(term.isnot ? 'IS NOT' : 'IS')
                    .style('background-color', term.isnot ? '#511e78' : '#015051')
                    .on('click',()=>{

                        tip.clear()
                            .showunder( condition_btn.node() )

                        tip.d.append('div')
                            .style('font-size','.7em')
                            .style('color','#fff')
                            .style('padding','5px')
                            .text(term.isnot ? 'IS' : 'IS NOT')
                            .style('background-color', term.isnot ? '#015051' : '#511e78')
                            .on('click', async()=>{
                                tip.hide()
                                group.terms[i].isnot = term.isnot ? false : true
                                // may_settoloading_termgroup( group )
                                await callback()
                                update_terms(terms_div)
                            })
                    })
            } else {
                // range label is not clickable
                condition_btn.text('RANGE')
                    .style('background-color', '#015051')
                    .style('pointer-events','none')
            }

            const term_value_div = terms_div.append('div')
                .style('display','inline-block')

            if( term.term.iscategorical ) {
                
                for (let j=0; j<term.values.length; j++){
                    
                    const term_value_btn = term_value_div.append('div')
                        .attr('class','sja_filter_tag_btn')
                        .style('font-size','1em')
                        .style('padding','3px 4px 3px 4px')
                        .style('margin-right','1px')
                        .style('background-color', '#4888BF')
                        .text(term.values[j].label)
                        .on('click', async ()=>{

                            tip.clear()

                            const wait = tip.d.append('div').text('Loading...')
                            tip.showunder( term_value_btn.node() )

                            const arg = {
                                genome: genome.name,
                                dslabel: mds.label, 
                                getcategories: 1,
                                samplecountbyvcf: count_limit_vcf, // quick n dirty solution, to count using vcf samples
                                termid : term.term.id
                            }

                            try {
                                const data = await client.dofetch( 'termdb', arg )
                                if(data.error) throw data.error
                                wait.remove()

                                tip.d.append('div')
                                    .attr('class','sja_menuoption')
                                    .html('&times;&nbsp;&nbsp;Delete')
                                    .on('click', async ()=>{
                                        group.terms[i].values.splice(j,1)
                                        if(group.terms[i].values.length==0) {
                                            group.terms.splice(i,1)
                                        }
                                        tip.hide()
                                        // may_settoloading_termgroup( group )
                                        await callback()
                                        update_terms(terms_div)
                                    })

                                for (const category of data.lst){

                                    if(term.values.find(v=>v.key == category.key)) continue

                                    tip.d.append('div')
                                        .html('<span style="font-size:.8em;opacity:.6">n='+category.samplecount+'</span> '+category.label)
                                        .attr('class','sja_menuoption')
                                        .on('click',async ()=>{
                                            // replace the old category with the new one
                                            tip.hide()
                                            group.terms[i].values[j] = {key:category.key,label:category.label}
                                            // may_settoloading_termgroup( group )
                                            await callback()
                                            update_terms(terms_div)
                                        })
                                }

                                tip.showunder( term_value_btn.node() )

                            } catch(e) {
                                wait.text( e.message || e )
                            }
                        })

                        // 'OR' button in between values
                        if(j<term.values.length-1){
                            term_value_div.append('div')
                                .style('display','inline-block')
                                .style('color','#fff')
                                .style('background-color','#4888BF')
                                .style('margin-right','1px')
                                .style('padding','7px 6px 5px 6px')
                                .style('font-size','.7em')
                                .style('text-transform','uppercase')
                                .text('or')
                        }else{
                            // '+' button at end of all values to add to list of values
                            const add_value_btn = term_value_div.append('div')
                                .attr('class','sja_filter_tag_btn')
                                .style('background-color','#4888BF')
                                .style('margin-right','1px')
                                .style('padding','3px 5px')
                                .style('text-transform','uppercase')
                                .html('&#43;')
                                .on('click', async ()=>{
                                    tip.clear()
            
                                    const wait = tip.d.append('div').text('Loading...')
                                    tip.showunder( add_value_btn.node() )
            
                                    const arg = {
                                        genome: genome.name,
                                        dslabel: mds.label, 
                                        getcategories: 1,
                                        samplecountbyvcf: 1,
                                        termid : term.term.id
                                    }
            
                                    try {
                                        const data = await client.dofetch( 'termdb', arg )
                                        if(data.error) throw data.error
                                        wait.remove()
            
                                        for (const category of data.lst){
                                            if(term.values.find(v=>v.key == category.key)) continue
                                            tip.d.append('div')
                                                .html('<span style="font-size:.8em;opacity:.6">n='+category.samplecount+'</span> '+category.label)
                                                .attr('class','sja_menuoption')
                                                .on('click',async ()=>{
                                                    group.terms[i].values.push({key:category.key,label:category.label})
                                                    tip.hide()
                                                    // may_settoloading_termgroup( group )
                                                    await callback()
                                                    update_terms(terms_div)
                                                })
                                        }
                                        tip.showunder( add_value_btn.node() )
                                    } catch(e) {
                                        wait.text( e.message || e )
                                    }
                                })
                        }
                }

            } else if( term.term.isinteger || term.term.isfloat ) {
                // TODO numerical term, print range in value button and apply the suitable click callback
                display_numeric_filter(term, term_value_div)
            }

            // button with 'x' to remove term2
            terms_div.append('div')
                .attr('class','sja_filter_tag_btn')
                .style('padding','3px 6px 3px 4px')
                .style('border-radius','0 6px 6px 0')
                .style('background-color', '#4888BF')
                .html('&#215;')
                .on('click',async ()=>{
                    group.terms.splice(i, 1)
                    // may_settoloading_termgroup( group )
                    await callback()
                    update_terms(terms_div)
                })
        }
    }

    async function add_term(result){

        // Add new term to group.terms
        for(let i=0; i < result.terms.length; i++){
            const bar_term = result.terms[i]
            const new_term = {
                values: [{key: bar_term.value, label: bar_term.label}],
                term: {
                    id: bar_term.term.id,
                    name: bar_term.term.name
                }
            }
            if(bar_term.term.iscategorical) new_term.term.iscategorical = bar_term.term.iscategorical
            if(bar_term.term.isfloat) {
                new_term.term.isfloat = bar_term.term.isfloat
                new_term.range = bar_term.range
            }
            if(bar_term.term.isinteger) {
                new_term.term.isinteger = bar_term.term.isinteger
                new_term.range = bar_term.range
            }

            group.terms.push(new_term)
        }
        
        // update the group div with new terms
        await callback()
        update_terms(terms_div)
    }

    async function replace_term(result, term_replce_index){

        // create new array with updated terms
        let new_terms = []
    
        for(const [i, term] of group.terms.entries()){
    
            // replace the term by index of clicked term
            if(i == term_replce_index){
                for(const [j, bar_term] of result.terms.entries()){
                    const new_term = {
                        values: [{key: bar_term.value, label: bar_term.label}],
                        term: {
                            id: bar_term.term.id,
                            name: bar_term.term.name
                        } 
                    }
                    new_term.isnot  = term.isnot ? true : false

                    if(bar_term.term.iscategorical) new_term.term.iscategorical = bar_term.term.iscategorical
                    if(bar_term.term.isfloat) {
                        new_term.term.isfloat = bar_term.term.isfloat
                        new_term.range = bar_term.range
                    }
                    if(bar_term.term.isinteger) {
                        new_term.term.isinteger = bar_term.term.isinteger
                        new_term.range = bar_term.range
                    }

                    new_terms.push(new_term)
                }
            }else{
                new_terms.push(term)
            }
        }
    
        // assing new terms to group
        group.terms = new_terms
        
        // // update the group div with new terms
        // may_settoloading_termgroup( group )
        await callback()
    }

    function display_numeric_filter(i, value_div){

        value_div.selectAll('*').remove()
    
        const numeric_div = value_div.append('div')
            .attr('class','sja_filter_tag_btn')
            .style('font-size','1em')
            .style('padding','3px 5px 3px 5px')
            .style('margin-right','1px')
            .style('background-color', '#4888BF')
    
        numeric_div.selectAll('*').remove()
    
        const x = '<span style="font-family:Times;font-style:italic">x</span>'
        if( i.range.startunbounded ) {
            numeric_div.html(x+' '+(i.range.stopinclusive?'&le;':'&lt;')+' '+i.range.stop)
        } else if( i.range.stopunbounded ) {
            numeric_div.html(x+' '+(i.range.startinclusive?'&ge;':'&gt;')+' '+i.range.start)
        } else {
            numeric_div.html(
                i.range.start
                +' '+(i.range.startinclusive?'&le;':'&lt;')
                +' '+x
                +' '+(i.range.stopinclusive?'&le;':'&lt;')
                +' '+i.range.stop
            )
        }
    
        numeric_div.on('click', ()=>{
    
            tip.clear()
    
            const equation_div = tip.d.append('div')
                .style('display','block')
                .style('padding','3px 5px')
    
            const start_input = equation_div.append('input')
                .attr('type','number')
                .attr('value',i.range.start)
                .style('width','60px')
                .on('keyup', async ()=>{
                    if(!client.keyupEnter()) return
                    start_input.property('disabled',true)
                    await apply()
                    start_input.property('disabled',false)
                })
    
            // to replace operator_start_div
            const startselect = equation_div.append('select')
            .style('margin-left','10px')
    
            startselect.append('option')
                .html('&le;')
            startselect.append('option')
                .html('&lt;')
            startselect.append('option')
                .html('&#8734;')
    
            startselect.node().selectedIndex =
                i.range.startunbounded ? 2 :
                i.range.startinclusive ? 0 : 1
    
            equation_div.append('div')
                .style('display','inline-block')
                .style('padding','3px 10px')
                .html(x)
    
            // to replace operator_end_div
            const stopselect = equation_div.append('select')
                .style('margin-right','10px')
    
            stopselect.append('option')
                .html('&le;')
            stopselect.append('option')
                .html('&lt;')
            stopselect.append('option')
                .html('&#8734;')
    
            stopselect.node().selectedIndex =
                i.range.stopunbounded ? 2 :
                i.range.stopinclusive ? 0 : 1
    
            const stop_input = equation_div.append('input')
                .attr('type','number')
                .style('width','60px')
                .attr('value',i.range.stop)
                .on('keyup', async ()=>{
                    if(!client.keyupEnter()) return
                    stop_input.property('disabled',true)
                    await apply()
                    stop_input.property('disabled',false)
                })
    
            tip.d.append('div')
                .attr('class','sja_menuoption')
                .style('text-align','center')
                .text('APPLY')
                .on('click', ()=>{
                    tip.hide()
                    apply()
                })
    
            // tricky: only show tip when contents are filled, so that it's able to detect its dimention and auto position itself
            tip.showunder( numeric_div.node() )
    
            async function apply () {
                try {
                    if(startselect.node().selectedIndex==2 && stopselect.node().selectedIndex==2) throw 'Both ends can not be unbounded'
    
                    const start = startselect.node().selectedIndex==2 ? null : Number( start_input.node().value )
                    const stop  = stopselect.node().selectedIndex==2  ? null : Number( stop_input.node().value )
                    if( start!=null && stop!=null && start>=stop ) throw 'start must be lower than stop'
    
                    if( startselect.node().selectedIndex == 2 ) {
                        i.range.startunbounded = true
                        delete i.range.start
                    } else {
                        delete i.range.startunbounded
                        i.range.start = start
                        i.range.startinclusive = startselect.node().selectedIndex == 0
                    }
                    if( stopselect.node().selectedIndex == 2 ) {
                        i.range.stopunbounded = true
                        delete i.range.stop
                    } else {
                        delete i.range.stopunbounded
                        i.range.stop = stop
                        i.range.stopinclusive = stopselect.node().selectedIndex == 0
                    }
                    display_numeric_filter(i, value_div)
                    tip.hide()
                    await callback()
                } catch(e) {
                    window.alert(e)
                }
            }
        })
    }
}




function may_settoloading_termgroup ( group ) {
	if( group.div_numbersamples ) group.div_numbersamples.text('Loading...')
	if(group.div_populationaverage) {
		group.div_populationaverage.selectAll('*').remove()
		group.div_populationaverage.append('div').text('Loading...')
	}
}




export function to_parameter ( terms ) {
// apply on the terms[] array of a group
// TODO and/or between multiple terms
	return terms.map( i=> {
		return {
			term: {
				id: i.term.id,
				iscategorical: i.term.iscategorical,
				isfloat: i.term.isfloat,
				isinteger: i.term.isinteger,
			},
			// must return original values[{key,label}] to keep the validator function happy on both client/server
			values: i.values,
			range: i.range,
			isnot: i.isnot,
		}
	})
}
