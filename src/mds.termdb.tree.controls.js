import {Menu, newpane, tkt} from './client'
import {event} from 'd3-selection'
import * as termvaluesettingui from './mds.termdb.termvaluesetting.ui'
import {validate_termvaluesetting} from './mds.termdb.termvaluesetting'

export function init(obj) {
  obj.controls = {
    components:{cart}
  }

  // below is used for setting up barchart event bus 
  obj.callbacks.bar = {
    postClick: obj.modifier_barchart_selectbar && obj.modifier_barchart_selectbar.callback
      ? termValues => obj.modifier_barchart_selectbar.callback({terms: termValues})
      : obj.bar_click_menu
      ? termValues => show_bar_click_menu(obj, termValues)
      : ()=>{}
  }
}

function show_bar_click_menu(obj, termValues) {
/*
  obj           the term tree obj
  termValue     array of term-value entries
*/
  const options = []
  const filter = obj.components.filter
  if (obj.bar_click_menu.add_filter) {
    options.push({
      label: "Add as filter", 
      callback: filter.menuoption_callback // menuoption_add_filter
    })
  }
  if (obj.bar_click_menu.select_to_gp) {
    options.push({
      label: "Select to GenomePaint",
      callback: select_to_gp.menuoption_callback
    })
  }
  if (obj.bar_click_menu.select_group_add_to_cart) {
    options.push({
      label: "Add group to cart",
      callback: cart.menuoption_callback
    })
  }
  if (options.length) {
    obj.tip.clear().d
      .selectAll('div')
      .data(options)
    .enter().append('div')
      .attr('class', 'sja_menuoption')
      .html(d=>d.label)
      .on('click', d => {
        obj.tip.hide()
        d.callback(obj, termValues)
      })

    obj.tip.show(event.clientX, event.clientY)
  }
}

export function getFilterUi(obj) {
    if( !obj.termfilter || !obj.termfilter.show_top_ui ) {
      // do not display ui, and do not collect callbacks
      return
    }

    if(!obj.termfilter.terms) {
      obj.termfilter.terms = []
    } else {
      if(!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
      validate_termvaluesetting( obj.termfilter.terms )
    }

    obj.dom.termfilterdiv.selectAll('*').remove()

    const div = obj.dom.termfilterdiv
      .style('display','inline-block')
      .append('div')
      .style('display','inline-block')
      .style('border','solid 1px #ddd')
      .style('padding','7px')
      .style('margin-bottom','10px')
    
    div.append('div')
      .style('display','inline-block')
      .style('margin','0px 5px')
      .text('FILTER')
      .style('opacity','.5')
      .style('font-size','.8em')

    termvaluesettingui.display(
      div,
      obj.termfilter,
      obj.mds,
      obj.genome,
      false,
      // callback when updating the filter
      obj.main
    )

  return {
    main() {
      if(!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
      validate_termvaluesetting( obj.termfilter.terms )
      obj.termfilter.update_terms()
    },

    menuoption_callback( obj, tvslst ) {
    /*
    obj: the tree object
    tvslst: an array of 1 or 2 term-value setting objects
         this is to be added to the obj.termfilter.terms[]
       if barchart is single-term, tvslst will have only one element
       if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
    */
      if(!tvslst) return

      if( !obj.termfilter || !obj.termfilter.show_top_ui ) {
        // do not display ui, and do not collect callbacks
        return
      }

      for(const [i, term] of tvslst.entries()){
        obj.termfilter.terms.push(term)
      }

      obj.main()
    }
  }
}



const select_to_gp = {
  menuoption_callback( obj, tvslst ) {
    const lst = []
    for(const t of tvslst) lst.push(t)
    if(obj.termfilter && obj.termfilter.terms) {
      for(const t of obj.termfilter.terms) {
        lst.push( JSON.parse(JSON.stringify(t)))
      }
    }

    const pane = newpane({x:100,y:100})
    import('./block').then(_=>{
      new _.Block({
        hostURL:localStorage.getItem('hostURL'),
        holder: pane.body,
        genome:obj.genome,
        nobox:true,
        chr: obj.genome.defaultcoord.chr,
        start: obj.genome.defaultcoord.start,
        stop: obj.genome.defaultcoord.stop,
        nativetracks:[ obj.genome.tracks.find(i=>i.__isgene).name.toLowerCase() ],
        tklst:[ {
          type:tkt.mds2,
          dslabel:obj.dslabel,
          vcf:{ numerical_axis:{ AFtest:{ groups:[
            { is_termdb:true, terms: lst },
            obj.bar_click_menu.select_to_gp.group_compare_against
          ] } } }
        } ]
      })
    })
  }
}



const cart = {
  render(obj) {
    if(!obj.selected_groups) return

    if(obj.selected_groups.length > 0){
      // selected group button
      obj.dom.cartdiv
        .style('display','inline-block')
        .attr('class','sja_filter_tag_btn')
        .style('padding','6px')
        .style('margin','0px 10px')
        .style('border-radius', obj.button_radius)
        .style('background-color','#00AB66')
        .style('color','#fff')
        .text('Selected '+ obj.selected_groups.length +' Group' + (obj.selected_groups.length > 1 ?'s':''))
        .on('click',()=>cart.make_selected_group_tip(obj))
    }else{
      obj.dom.cartdiv
        .style('display','none')
    }
  },
  menuoption_callback( obj, tvslst ) {
    if(!tvslst) return
      
    const new_group = {}
    new_group.is_termdb = true
    new_group.terms = []

    for(const [i, term] of tvslst.entries()){
      new_group.terms.push(term)
    }

    if(!obj.selected_groups){
      obj.selected_groups = []
    }

    obj.selected_groups.push(new_group)
    cart.render(obj)
  },
  make_selected_group_tip(obj){
    // const tip = obj.tip // not working, creating new tip
    const tip = new Menu({padding:'0'})
    tip.clear()
    tip.showunder( obj.dom.cartdiv.node() )

    const table = tip.d.append('table')
      .style('border-spacing','5px')
      .style('border-collapse','separate')

    // one row for each group
    for( const [i, group] of obj.selected_groups.entries() ) {
    
      const tr = table.append('tr')
      const td1 = tr.append('td')

      td1.append('div')
        .attr('class','sja_filter_tag_btn')
        .text('Group '+(i+1))
        .style('white-space','nowrap')
        .style('color','#000')
        .style('padding','6px')
        .style('margin','3px 5px')
        .style('font-size','.7em')
        .style('text-transform','uppercase')
        
      group.dom = {
        td2: tr.append('td'),
        td3: tr.append('td').style('opacity',.5).style('font-size','.8em'),
        td4: tr.append('td')
      }
      
      termvaluesettingui.display(
        group.dom.td2, 
        group, 
        obj.mds, 
        obj.genome, 
        false,
        // callback when updating the selected groups
        () => {group.update_terms()}
      )
      
      // TODO : update 'n=' by group selection 
      // group.dom.td3.append('div')
      //  .text('n=?, view stats')

      // 'X' button to remove gorup
      group.dom.td4.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('padding','2px 6px 2px 6px')
        .style('display','inline-block')
        .style('margin-left','7px')
        .style('border-radius','6px')
        .style('background-color','#fa5e5b')
        .html('&#215;') 
        .on('click',()=>{
          
          // remove group and update tip and button
          obj.selected_groups.splice(i,1)
          
          if(obj.selected_groups.length == 0){
            obj.dom.cartdiv.style('display','none')
            tip.hide()
          }
          else{
            make_selected_group_tip(tip)
            update_cart_button(obj)
          }
        })
    }

    if(obj.selected_groups.length > 1){
      
      const tr_gp = table.append('tr')
      const td_gp = tr_gp.append('td')
        .attr('colspan',4)
        .attr('align','center')
        .style('padding','0')

      td_gp.append('div')
        .attr('class','sja_filter_tag_btn')
        .style('display','inline-block')
        .style('height','100%')
        .style('width','96%')
        .style('padding','4px 10px')
        .style('margin-top','10px')
        .style('border-radius','3px')
        .style('background-color','#eee')
        .style('color','#000')
        .text('Perform Association Test in GenomePaint')
        .style('font-size','.8em')
        .on('click',()=>{
          tip.hide()
          const pane = newpane({x:100,y:100})
          import('./block').then(_=>{
            new _.Block({
              hostURL:localStorage.getItem('hostURL'),
              holder: pane.body,
              genome:obj.genome,
              nobox:true,
              chr: obj.genome.defaultcoord.chr,
              start: obj.genome.defaultcoord.start,
              stop: obj.genome.defaultcoord.stop,
              nativetracks:[ obj.genome.tracks.find(i=>i.__isgene).name.toLowerCase() ],
              tklst:[ {
                type:tkt.mds2,
                dslabel:obj.dslabel,
                vcf:{ numerical_axis:{ AFtest:{ groups: obj.selected_groups} } }
              } ]
            })
          })
        })
    }
  }
}
