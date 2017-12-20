import {event as d3event} from 'd3-selection'
import * as client from './client'
import {axisLeft} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import {rgb as d3rgb} from 'd3-color'
import * as expressionstat from './block.mds.expressionstat'



/*

expression rank track
single-sample mode for mds & custom data, all samples in the same file
requires .sample as 


Yu's ase/outlier is required feature
TODO change into optional, e.g. no such thing for cosmic

TODO seekcoord can seek into subpanels, should eliminate need for regions[]?


*/



const labyspace = 5


export function loadTk( tk, block ) {

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

	// check rank for each region

	const tasks = []

	for(const r of regions) {

		const arg = {
			jwt: block.jwt,
			genome:block.genome.name,
			rglst:[ {chr:r.chr, start:r.start, stop:r.stop} ],
			sample:tk.sample,
		}
		if(tk.iscustom) {
			arg.iscustom=1
			arg.file=tk.file
			arg.url=tk.url
			arg.indexURL=tk.indexURL
		} else {
			arg.dslabel = tk.mds.label
			arg.querykey = tk.querykey
			arg.levelkey = tk.levelkey
			arg.levelvalue = tk.levelvalue
		}
		tasks.push(
			fetch( new Request(block.hostURL+'/mds_expressionrank',{
				method:'POST',
				body:JSON.stringify(arg)
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw({message:data.error})
				if(data.result && data.result.length>0) {
					r.items = data.result
				}
				return
			})
		)
	}

	Promise.all( tasks )

	.then(()=>{
		// any data?
		if( !tk.regions.find( r=>r.items ) ) throw({message:'no data in view range'})
	})

	.catch(err=>{
		if(err.stack) {
			console.log(err.stack)
		}
		return err.message
	})
	.then( errmsg =>{
		renderTk(tk, block)
		block.tkcloakoff(tk, {error:errmsg})
		set_height(tk, block)
	})
}








function renderTk( tk, block ) {
	tk.glider.selectAll('*').remove()
	for(const p of tk.subpanels) {
		p.glider
			.attr('transform','translate(0,0)') // it may have been panned
			.selectAll('*').remove()
	}


	// range of rank value, currently fixed!
	let min_rank = 0
	let max_rank = 100 

	const scale_rank = bar_plot_y(min_rank, max_rank, tk.barheight)

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

			const [y,h] = scale_rank( i.rank )

			expressionstat.measure( i, tk.gecfg )
			const barcolor = expressionstat.ase_color(i, tk.gecfg)


			const tt = d3rgb(barcolor)
			const fillcolor='rgba('+tt.r+','+tt.g+','+tt.b+',.2)'


			// plot bar for this item
			const ig = g.append('g')
				.attr('transform','translate('+x1+',0)')
			ig.append('line')
				.attr('x2',Math.max(2,x2-x1))
				.attr('stroke', barcolor)
				.attr('stroke-width',1)
				.attr('shape-rendering','crispEdges')
				.attr('y1', i.rank>0 ? y : y+h)
				.attr('y2', i.rank>0 ? y : y+h)
			ig.append('rect')
				.attr('y',y)
				.attr('width',Math.max(2, x2-x1))
				.attr('height',h)
				.attr('fill', fillcolor)
				.attr('shape-rendering','crispEdges')
				.on('mouseover',()=>{
					d3event.target.setAttribute('stroke', barcolor)
					tk.tktip.clear()
						.show(d3event.clientX,d3event.clientY)

					const lst=[
						{k:'gene',v:i.gene},
						{k:'rank', v: client.ranksays( i.rank ) },
						{ k: (tk.gecfg.datatype || 'actual value'), v:i.thisvalue }
						]

					const table=client.make_table_2col(tk.tktip.d, lst)
						.style('margin','0px')

					{
						const tr=table.append('tr')
						const td=tr.append('td').attr('colspan',3)
						td.text(i.chr+':'+i.start+'-'+i.stop)
					}
					
					expressionstat.showsingleitem_table( i, tk.gecfg, table )
				})
				.on('mouseout',()=>{
					tk.tktip.hide()
					d3event.target.setAttribute('stroke','')
				})
				.on('click',()=>{
					const pane=client.newpane({x:d3event.clientX,y:d3event.clientY})
					pane.header.text(i.gene+' '+tk.gecfg.datatype)

					const p={
						gene:i.gene,
						chr:i.chr,
						start:i.start,
						stop:i.stop,
						holder:pane.body,
						genome:block.genome,
						jwt:block.jwt,
						hostURL:block.hostURL,
						sample:{name: tk.sample,value:i.thisvalue}
					}

					if(tk.iscustom) {
						p.file=tk.file
						p.url=tk.url
						p.indexURL=tk.indexURL
					} else {
						p.dslabel=tk.mds.label
						p.querykey=tk.querykey
					}

					import('./block.mds.geneboxplot').then(_=>{
						_.init(p)
					})
				})
		}
	}

	tk.rankaxis.label.text('Rank')
	client.axisstyle({
		axis:tk.rankaxis.g.call( axisLeft().scale( scaleLinear().domain([min_rank,max_rank]).range([tk.barheight,0]) ).tickValues([min_rank,max_rank]) ),
		showline:true
	})

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
			tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width )
		})
	block.setllabel()
}




function set_height(tk, block) {
	// call when track height updates
	tk.tklabel.attr('y', tk.barheight/2 - block.labelfontsize/2)
	tk.rankaxis.label.attr('y', tk.barheight/2+block.labelfontsize/2)

	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	block.block_setheight()
}





function makeTk(tk, block) {

	delete tk.uninitialized

	if(tk.iscustom) {
		tk.gecfg = {}
	} else {
		// native track bar color comes from mds config with complicated setting
		tk.gecfg = tk.mds.queries[ tk.querykey ]
	}

	if(!tk.gecfg.itemcolor) {
		tk.gecfg.itemcolor='green'
	}

	expressionstat.init_config( tk.gecfg )

	tk.tklabel.text(tk.name)

	tk.rankaxis = {
		g: tk.gleft.append('g'),
		label: block.maketklefthandle(tk)
			.attr('class',null)
	}

	tk.config_handle = block.maketkconfighandle(tk)
		.attr( 'y', 10+block.labelfontsize )
		.on('click',()=>{
			configPanel(tk,block)
		})
}





function configPanel(tk,block) {
	tk.tkconfigtip.clear()
		.showunder( tk.config_handle.node() )

}
