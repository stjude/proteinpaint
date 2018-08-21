import {event as d3event} from 'd3-selection'
import * as client from './client'
import {axisLeft,axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'



/*
TODO seekcoord can seek into subpanels, should eliminate need for regions[]?

on the fly ase track
runs off RNA bam and VCF


JUMP




********************** EXPORTED
loadTk()


********************** INTERNAL



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

	for(let i=block.startidx; i<=block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
		})
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const [idx,r] of block.subpanels.entries()) {
			regions.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx:idx,
			})
		}
	}

	tk.regions = regions

	try {

		for(const r of regions) {
			await getdata_region( r, tk, block )
		}

		renderTk( tk, block )

		block.tkcloakoff( tk )

	} catch(e) {
		tk.height_main = tk.height = 100
		block.tkcloakoff( tk, {error: (e.message||e)})
	}


	set_height(tk, block)
}




function getdata_region ( r, tk, block ) {
	const arg = {
		genome: block.genome.name,
		rnabamfile: tk.rnabamfile,
		rnabamurl: tk.rnabamurl,
		rnabamindexURL: tk.rnabamindexURL,
		vcffile: tk.vcffile,
		vcfurl: tk.vcfurl,
		vcfindexURL: tk.vcfindexURL,
		chr:r.chr,
		start:r.start,
		stop:r.stop
	}
	return client.dofetch('ase', arg )
	.then(data=>{
		if(data.error) throw data.error
		r.items = data.items
	})
}






function renderTk( tk, block ) {
	tk.glider.selectAll('*').remove()
	for(const p of tk.subpanels) {
		p.glider
			.attr('transform','translate(0,0)') // it may have been panned
			.selectAll('*').remove()
	}

	let hasrankvalue = false
	let hasrawvalue = false

	// range of rank value, currently fixed!
	let min_rank = 0
	let max_rank = 100 
	// range of raw value, in case not using rank or gene name not identified
	let min_rawvalue = 0
	let max_rawvalue = 0
	for(const r of tk.regions) {
		if(!r.items) {
			// no items for this region
			continue
		}
		for(const i of r.items) {
			if(i.rank!=undefined) {
				hasrankvalue = true
			} else if(i.value!=undefined) {
				hasrawvalue = true
				if(min_rawvalue>i.value) {
					min_rawvalue=i.value
				} else if(max_rawvalue<i.value) {
					max_rawvalue=i.value
				}
			}
		}
	}

	const scale_rank = bar_plot_y(min_rank, max_rank, tk.barheight)
	const scale_rawvalue = bar_plot_y(min_rawvalue, max_rawvalue, tk.barheight)

	// render
	for(const r of tk.regions) {
		if(!r.items) continue

		// where to create new shapes
		const g = r.subpanelidx!=undefined ? tk.subpanels[r.subpanelidx].glider : tk.glider
		
		for(const i of r.items) {

			const startcoord = Math.max(r.start, i.start)
			const stopcoord  = Math.min(r.stop, i.stop)

			let x1, x2 // px position

			if(r.subpanelidx!=undefined) {
				// subpanel cannot be reverse
				x1 = (startcoord-r.start) * r.exonsf
				x2 = (stopcoord-r.start) * r.exonsf
			} else {
				// main panel can be reverse, so need to bother with this
				const a = block.seekcoord( r.chr, startcoord )[0]
				const b = block.seekcoord( r.chr, stopcoord  )[0]
				if(!a || !b) continue
				x1 = Math.min(a.x,b.x)
				x2 = Math.max(a.x,b.x)
			}

			let value=null,
				y,
				h,
				fillcolor,
				barcolor
			if(i.rank!=undefined) {
				value = i.rank;
				[y,h] = scale_rank(value)
				fillcolor = value>=0 ? tk.pcolorfill : tk.ncolorfill
				barcolor  = value>=0 ? tk.pcolorbar : tk.ncolorbar
			} else if(i.value!=undefined) {
				value = i.value;
				[y, h] = scale_rawvalue(value)
				fillcolor = nomatchcolorfill
				barcolor = nomatchcolorbar
			}

			if(value==null) {
				// no value for this item??
				continue
			}

			// plot bar for this item
			const ig = g.append('g')
				.attr('transform','translate('+x1+',0)')
			ig.append('line')
				.attr('x2',Math.max(2,x2-x1))
				.attr('stroke', barcolor)
				.attr('stroke-width',1)
				.attr('shape-rendering','crispEdges')
				.attr('y1', value>0 ? y : y+h)
				.attr('y2', value>0 ? y : y+h)
			ig.append('rect')
				.attr('y',y)
				.attr('width',Math.max(2, x2-x1))
				.attr('height',h)
				.attr('fill', fillcolor)
				.attr('shape-rendering','crispEdges')
				.on('mouseover',()=>{
					d3event.target.setAttribute('stroke',barcolor)
					tk.tktip.clear()
						.show(d3event.clientX,d3event.clientY)
					let ranksays
					if(i.rank==undefined) {
						ranksays='?'
					} else if(i.rank==100) {
						ranksays='highest'
					} else if(i.rank==0) {
						ranksays='lowest'
					} else if(i.rank>=50) {
						ranksays='high&nbsp;<span style="color:#858585">'+i.rank+'%</span>'
					} else {
						ranksays='low&nbsp;<span style="color:#858585">'+i.rank+'%</span>'
					}
					const lst=[
						{k:'rank',v:ranksays},
						{k:'gene',v:i.gene},
						{ k: (tk.valuename || 'actual value'), v:i.value }
						]
					client.make_table_2col(tk.tktip.d, lst)
						.style('margin','0px')
				})
				.on('mouseout',()=>{
					tk.tktip.hide()
					d3event.target.setAttribute('stroke','')
				})
		}
	}

	if(hasrankvalue) {
		tk.rankaxis.label.text('Rank')
		client.axisstyle({
			axis:tk.rankaxis.g.call( axisLeft().scale( scaleLinear().domain([min_rank,max_rank]).range([tk.barheight,0]) ).tickValues([min_rank,max_rank]) ),
			showline:true
		})
	} else {
		tk.rankaxis.label.text('')
		tk.rankaxis.g.selectAll('*').remove()
	}
	if(hasrawvalue) {
		tk.rawvalueaxis.label.text('Actual value')
		client.axisstyle({
			axis:tk.rawvalueaxis.g.call( axisRight().scale( scaleLinear().domain([min_rawvalue,max_rawvalue]).range([tk.barheight,0]) ).tickValues([min_rawvalue,max_rawvalue]) ),
			showline:true
		})
	} else {
		tk.rawvalueaxis.label.text('')
		tk.rawvalueaxis.g.selectAll('*').remove()
	}

	resize_label(tk, block)
}





function bar_plot_y(min, max, tkh) {
	// works for both raw value and zscore
	return (v)=>{
		if(min<0) {
			if(max<=0) {
				// all negative, span is from 0 to min
				return [ 0, Math.max(1,tkh * v / min) ]
			}
			// min <0, max>0
			const fs = tkh / (max-min)
			if(v>0) return [ fs*(max-v), Math.max(1,fs*v) ]
			return [ fs*max, Math.max(1,fs*(-v)) ]
		}
		// min is 0
		const fs = tkh / max
		return [ fs*(max-v), Math.max(1,fs*v) ]
	}
}




function resize_label(tk, block) {
	tk.leftLabelMaxwidth = 0
	tk.tklabel
		.each(function(){
			tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width)
		})
	block.setllabel()
}




function set_height(tk, block) {
	// call when track height updates
	//tk.tklabel.attr('y', tk.barheight/2 - block.labelfontsize/2)
	//tk.rankaxis.label.attr('y', tk.barheight/2+block.labelfontsize/2)
	//tk.rawvalueaxis.label.attr('y', tk.barheight/2+block.labelfontsize/2)

	//tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	block.block_setheight()
}





function makeTk(tk, block) {

	delete tk.uninitialized

	tk.tklabel.text(tk.name)

/*
	tk.rawvalueaxis = {
		g:tk.gright.append('g')
			.attr('transform','translate(-10,0)'),
		label: block.maketkconfighandle(tk)
			.attr('class',null)
	}

	if(tk.compareTo) {
		for(const c of tk.compareTo) {
			c.cache = new Map()
		}
	}

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
}





function configPanel(tk,block) {
	tk.tkconfigtip.clear()
		.showunder( tk.config_handle.node() )

}
