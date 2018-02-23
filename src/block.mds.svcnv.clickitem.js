import {event as d3event} from 'd3-selection'
import * as client from './client'
import {focus_singlesample, detailtable_singlesample, createbutton_addfeature} from './block.mds.svcnv'




export function click_multi_singleitem( p ) {
	/*
	click on a single item, of any type
	launch a panel to show details
	only in multi-sample mode, not in single-sample
	for official or custom tracks


	p {}
	.item
	.sample
	.samplegroup
	.tk
	.block

	if item is snvindel, will have:
		.m_sample
	*/

	const pane = client.newpane({x:d3event.clientX, y:d3event.clientY})
	pane.header.text(p.tk.name)

	const buttonrow = pane.body.append('div')
		.style('margin','10px')

	// click focus button to show block in holder
	{
		let blocknotshown = true
		const holder = pane.body.append('div')
			.style('margin','10px')
			.style('display','none')

		// focus button
		buttonrow.append('div')
			.style('display','inline-block')
			.attr('class', 'sja_menuoption')
			.text('Focus')
			.on('click',()=>{

				if(holder.style('display')=='none') {
					client.appear(holder)
				} else {
					client.disappear(holder)
				}

				if(blocknotshown) {
					blocknotshown=false
					focus_singlesample({
						holder: holder,
						m: p.item,
						sample: p.sample,
						samplegroup: p.samplegroup,
						tk: p.tk,
						block: p.block
					})
				}
			})
	}


	if(!p.tk.iscustom) {
		/*
		is official dataset
		click button to show whole-genome view
		may check if dataset is disco-ready
		*/
		let plotnotshown = true
		const holder = pane.body.append('div')
			.style('margin','10px')
			.style('display','none')

		// focus button
		buttonrow.append('div')
			.style('display','inline-block')
			.attr('class', 'sja_menuoption')
			.text(p.sample.samplename+' genome')
			.on('click',()=>{

				if(holder.style('display')=='none') {
					client.appear(holder)
				} else {
					client.disappear(holder)
				}

				if(plotnotshown) {
					plotnotshown=false
					// retrieve data for this sample
					// then call api to show plot

					sjcharts.dtDisco({
						appname: 'dtdisco',
						holderSelector: holder,
						settings: {
							showControls: false,
							selectedSamples: ['SJOS001101_M1']
						}
					})
				}
			})
	}


	createbutton_addfeature( {
		m: p.item,
		holder:buttonrow,
		tk: p.tk,
		block: p.block,
		pane: pane
	})

	p.holder = pane.body
	detailtable_singlesample( p )
}
