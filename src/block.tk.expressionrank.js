import {event as d3event} from 'd3-selection'
import * as client from './client'
import {axisLeft,axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'



/*
TODO seekcoord can seek into subpanels, should eliminate need for regions[]?

expression rank track

essentially bedgraph data, but in the form of bedj

each interval is a gene, must have gene name in addition to value

to compare to official dataset fpkm data, gene name is required for querying the sqlite db by gene name


if invalid official dataset or gene name no match, will show bedgraph data instead



JUMP




********************** EXPORTED
loadTk()


********************** INTERNAL



*/



const labyspace = 5

const nomatchcolorbar = '#aaaaaa'
const nomatchcolorfill = 'rgba(170,170,170,.3)'


export function loadTk( tk, block ) {

	block.tkcloakon(tk)
	block.block_setheight()

	Promise.resolve()

	.then(()=>{

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

		// get bedj data for all regions

		const tasks = []

		for(const r of regions) {

			const arg = {
				jwt: block.jwt,
				file:tk.file,
				url:tk.url,
				rglst:[{chr:r.chr, start:r.start, stop:r.stop}]
			}
			tasks.push(
				fetch( new Request(block.hostURL+'/bedjdata',{
					method:'POST',
					body:JSON.stringify(arg)
				}))
				.then(data=>{return data.json()})
				.then(data=>{
					if(data.error) throw({message:data.error})
					if(data.items && data.items.length>0) {
						r.items = data.items
					}
					return
				})
			)
		}
		return Promise.all( tasks )
	})

	.then(()=>{
		return checkRank(tk, block)
	})

	.then(()=>{
		renderTk(tk, block)
	})

	.catch(err=>{
		if(err.stack) {
			console.log(err.stack)
		}
		return err.message
	})
	.then( errmsg =>{
		block.tkcloakoff(tk, {error:errmsg})
		set_height(tk, block)
	})
}





function checkRank(tk, block) {
	return Promise.resolve()
	.then(()=>{
		if(!tk.compareTo || tk.compareTo.length==0) return

		// find out which way to use
		const compare = tk.compareTo[0]

		const genes = new Map()
		const gene2item = {} // k: gene, v: [] of items

		const region2check = []
		// when using bedj, if an region has a gene to check, will check entire region

		for(const r of tk.regions) {
			if(!r.items) continue

			let thisregiontocheck = false

			for(const i of r.items) {
				if(!i.gene && i.value==undefined) continue
				if( compare.cache.has( i.gene ) ) {
					i.rank = compare.cache.get(i.gene)
					// the cached rank maybe undefined! for the gene was queried before and no data found
				} else {
					// no rank for this gene
					genes.set( i.gene,  i.value )

					if(!gene2item[ i.gene ]) {
						gene2item[i.gene] = []
					}
					gene2item[i.gene].push( i )
					thisregiontocheck=true
				}
			}
			if(thisregiontocheck) {
				region2check.push(r.chr+':'+r.start+'-'+r.stop)
			}
		}
		if(genes.size==0) return

		const par = {
			jwt: block.jwt,
			genome: block.genome.name,
			genelst: genes
		}
		if(compare.isdataset) {
			par.dsname= compare.name
			par.queryidx= compare.queryidx
		} else if(compare.isjsonbed) {
			par.isbedj = 1
			par.file = compare.file
			par.url = compare.url
			par.indexURL = compare.indexURL
			par.regions = region2check
		}

		return fetch( new Request( block.hostURL+'/checkrank',{
			method:'POST',
			body:JSON.stringify(par)
		}))
		.then(data=>{return data.json()})
		.then(data=>{
			if(data.error) throw({message:data.error})
			if(data.items) {
				for(const [gene,rank] of data.items) {
					compare.cache.set( gene, rank )
					if(gene2item[gene]) {
						for(const i of gene2item[gene]) {
							i.rank = rank
						}
					}
				}
			}
			// for those genes with no ranking found, still cache such result so it won't be searched second time
			for(const gene in gene2item) {
				if(!compare.cache.has(gene)) {
					compare.cache.set(gene, undefined)
				}
			}
			return
		})
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
	tk.tklabel.attr('y', tk.barheight/2 - block.labelfontsize/2)
	tk.rankaxis.label.attr('y', tk.barheight/2+block.labelfontsize/2)
	tk.rawvalueaxis.label.attr('y', tk.barheight/2+block.labelfontsize/2)

	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	block.block_setheight()
}





function makeTk(tk, block) {

	delete tk.uninitialized

	tk.tklabel.text(tk.name)

	tk.rankaxis = {
		g: tk.gleft.append('g'),
		label: block.maketklefthandle(tk)
			.attr('class',null)
	}
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
}





function configPanel(tk,block) {
	tk.tkconfigtip.clear()
		.showunder( tk.config_handle.node() )

}
