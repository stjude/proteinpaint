import {event as d3event} from 'd3-selection'
import {axisLeft,axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import * as client from './client'
import {rnabamtk_initparam} from './block.mds.svcnv.share'


/*
on the fly ase track
runs off RNA bam and VCF


********************** EXPORTED
loadTk()


********************** INTERNAL
getdata_region

*/



const labyspace = 5



export async function loadTk( tk, block ) {

	block.tkcloakon(tk)
	block.block_setheight()

	if(tk.uninitialized) {
		makeTk(tk, block)
	}

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = []

	let xoff = 0
	for(let i=block.startidx; i<=block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: xoff
		})
		xoff += r.width + block.regionspace
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const [idx,r] of block.subpanels.entries()) {
			xoff += r.leftpad
			regions.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx:idx,
				x: xoff
			})
			xoff += r.width
		}
	}

	tk.regions = regions

	try {

		// reset max
		tk.dna.coveragemax = 0
		tk.rna.coveragemax = 0

		for(const r of regions) {
			await getdata_region( r, tk, block )
		}

		renderTk( tk, block )

		block.tkcloakoff( tk, {} )

	} catch(e) {
		tk.height_main = tk.height = 100
		block.tkcloakoff( tk, {error: (e.message||e)})
		if(e.stack) console.log(e.stack)
	}


	set_height(tk, block)
}




function getdata_region ( r, tk, block ) {
	const arg = {
		genome: block.genome.name,
		samplename: tk.samplename,
		rnabamfile: tk.rnabamfile,
		rnabamurl: tk.rnabamurl,
		rnabamindexURL: tk.rnabamindexURL,
		vcffile: tk.vcffile,
		vcfurl: tk.vcfurl,
		vcfindexURL: tk.vcfindexURL,
		rnabarheight: tk.rna.coveragebarh,
		dnabarheight: tk.dna.coveragebarh,
		barypad: tk.barypad,
		chr: r.chr,
		start: r.start,
		stop: r.stop,
		width: r.width,
		asearg: tk.asearg
	}
	return client.dofetch('ase', arg )
	.then(data=>{
		if(data.error) throw data.error
		r.genes = data.genes
		r.coveragesrc = data.coveragesrc
		tk.dna.coveragemax = Math.max( tk.dna.coveragemax, data.dnamax )
		tk.rna.coveragemax = Math.max( tk.rna.coveragemax, data.rnamax )
	})
}






function renderTk( tk, block ) {
	tk.glider.selectAll('*').remove()

	for(const p of tk.subpanels) {
		p.glider
			.attr('transform','translate(0,0)') // it may have been panned
			.selectAll('*').remove()
	}

	client.axisstyle({
		axis: tk.rna.coverageaxisg
			.attr('transform','translate(0,0)')
			.call(
			axisLeft()
				.scale(
					scaleLinear().domain([0,tk.rna.coveragemax]).range([tk.rna.coveragebarh,0])
					)
				.tickValues([0,tk.rna.coveragemax])
			),
		showline:true
	})
	tk.rna.coveragelabel
		.attr('y', tk.rna.coveragebarh/2)

	client.axisstyle({
		axis: tk.dna.coverageaxisg
			.attr('transform','translate(0,'+(tk.rna.coveragebarh+tk.barypad)+')')
			.call(
			axisLeft()
				.scale(
					scaleLinear().domain([0,tk.dna.coveragemax]).range([0,tk.dna.coveragebarh])
					)
				.tickValues([0,tk.dna.coveragemax])
			),
		showline:true
	})
	tk.dna.coveragelabel
		.attr('y', tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh/2 )


	for(const r of tk.regions) {
		tk.glider.append('image')
			.attr('x', r.x)
			.attr('width', r.width)
			.attr('height', tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh )
			.attr('xlink:href', r.coveragesrc)

		// show genes
	}

	resize_label(tk, block)
}








function resize_label(tk, block) {
	tk.leftLabelMaxwidth = 0
	tk.tklabel
		.each(function(){
			tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width)
		})
	tk.dna.coveragelabel
		.each(function(){
			tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width)
		})
	block.setllabel()
}




function set_height(tk, block) {
	// call when track height updates


	tk.height_main = tk.toppad + tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh + tk.bottompad

	block.block_setheight()
}





function makeTk(tk, block) {

	delete tk.uninitialized

	tk.tklabel.text(tk.name)

	if(!tk.barypad) tk.barypad = 0

	if(!tk.rna) tk.rna = {}
	tk.rna.coverageaxisg = tk.gleft.append('g')
	tk.rna.coveragelabel = block.maketklefthandle(tk)
		.text('RNA coverage')
	//if(!tk.rna.coveragemax) tk.rna.coveragemax = 50
	if(!tk.rna.coveragebarh) tk.rna.coveragebarh = 50

	if(!tk.dna) tk.dna = {}
	tk.dna.coverageaxisg = tk.gleft.append('g')
	tk.dna.coveragelabel = block.maketklefthandle(tk)
		.text('DNA coverage')
	tk.dna.coveragemax = 0
	if(!tk.dna.coveragebarh) tk.dna.coveragebarh = 50


/*
	let laby = labyspace + block.labelfontsize
	tk.label_resolution = block.maketklefthandle(tk, laby)
		.attr('class',null)
	laby += labyspace + block.labelfontsize
	*/

	tk.config_handle = block.maketkconfighandle(tk)
		.attr('y',10+block.labelfontsize)
		.on('click',()=>{
			configPanel(tk,block)
		})
	
	if( !tk.asearg ) tk.asearg = {}
	rnabamtk_initparam( tk.asearg )
}





function configPanel(tk,block) {
	tk.tkconfigtip.clear()
		.showunder( tk.config_handle.node() )

}
