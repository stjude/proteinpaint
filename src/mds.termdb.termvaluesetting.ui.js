import * as client from './client'
import {init} from './mds.termdb'


export function make_termvalueselection_ui( hodler_div, group, tk, genome){
/*
group{}
	.terms[]
*/
    
    // Group div
	const group_div = hodler_div
        .append('div')
        .style('display', 'block')
        .style('margin','5px 10px')
        .style('padding','3px 10px')
        .style('border','solid 1px')
        .style('border-color','#d4d4d4')

    if( group.name ) {
        group_div.append('div')
            .style('display', 'inline-block')
            .style('opacity',.5)
            .style('font-size','.8em')
            .style('margin-right','10px')
            .text(group.name)
    }

    group.div_numbersamples = group_div.append('div')
        .style('display', 'inline-block')
        .style('opacity',.5)
        .style('font-size','.8em')
        .text('Loading...')

    const terms_div = group_div.append('div')
        .style('display','inline-block')

    update(terms_div, group)

    const tip = new client.Menu({padding:'0'})

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
                mds: tk.mds,
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

    async function add_term(result){

        // Add new term to group.terms
        for(let i=0; i < result.terms.length; i++){
            const bar_term = result.terms[i]
            const new_term = {
                values: [{key: bar_term.value, label: bar_term.label}],
                term: {
                    id: bar_term.term.id,
                    iscategorical: bar_term.term.iscategorical,
                    name: bar_term.term.name
                }
            }
            group.terms.push(new_term)
        }
        
        // update the group div with new terms
        may_settoloading_termgroup( group )
        update(terms_div, group)
    }

    function update(terms_div, group) {

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
                            mds: tk.mds,
                            div: treediv,
                            default_rootterm: {},
                            modifier_barchart_selectbar: {
                                callback: result => {
                                    tip.hide()
                                    replace_term(result, i)
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
                                    may_settoloading_termgroup( group )
                                    update(terms_div, group)
                                    await tk.load()
                                })
                        })
                } else {
                    // range label is not clickable
                    condition_btn.text('RANGE')
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
                                    dslabel: tk.mds.label, 
                                    getcategories: 1,
                                    samplecountbyvcf: 1, // quick n dirty solution, to count using vcf samples
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
                                            may_settoloading_termgroup( group )
                                            update(terms_div, group)
                                            await tk.load()
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
                                                may_settoloading_termgroup( group )
                                                update(terms_div, group)
                                                await tk.load()
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
                                            dslabel: tk.mds.label, 
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
                                                        may_settoloading_termgroup( group )
                                                        update(terms_div, group)
                                                        await tk.load()
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
                        may_settoloading_termgroup( group )
                        update(terms_div, group)
                        await tk.load()
                    })
            }
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
                                iscategorical: bar_term.term.iscategorical,
                                name: bar_term.term.name
                            } 
                        }
                        new_term.isnot  = term.isnot ? true : false
                        new_terms.push(new_term)
                    }
                }else{
                    new_terms.push(term)
                }
            }
    
            // assing new terms to group
            group.terms = new_terms
            
            // // update the group div with new terms
            may_settoloading_termgroup( group )
            update(terms_div, group)
            await tk.load()
        }
}

function may_settoloading_termgroup ( group ) {
	if( group.div_numbersamples ) group.div_numbersamples.text('Loading...')
	if(group.div_populationaverage) {
		group.div_populationaverage.selectAll('*').remove()
		group.div_populationaverage.append('div').text('Loading...')
	}
}