import * as client from './client'
import * as common from './common'
import {axisLeft,axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'



/*
obj:
.holder
.legendtable
.genome {}
.dslabel


********************** EXPORTED
init()
********************** INTERNAL
initdataset
validatePlot_initDom
loadPlot
doPlot

*/



const radius=3



export async function init (obj,holder, debugmode) {
	/*
	holder
	genome
	dslabel

	*/

	if(debugmode) {
		window.obj = obj
	}

	obj.plots = []

	obj.menu = new client.Menu({padding:'5px'})
	obj.tip = new client.Menu({padding:'5px'})

	obj.errordiv = holder.append('div')
		.style('margin','10px')

	obj.sayerror = e=>{
		client.sayerror(obj.errordiv, typeof(e)=='string' ? e : e.message)
		if(e.stack) console.log(e.stack)
	}

	///////////// following are tests

	obj.plotdiv = holder.append('div')
		.style('margin','20px')
	obj.legendtable = holder.append('table')
		.style('border-spacing','5px')

	try {

		//await initdataset( obj )

		if( obj.plotlist) {
			if(!Array.isArray(obj.plotlist)) throw '.plotlist should be array'
			for(const p of obj.plotlist) {
				const plot = validatePlot_initDom( p, obj )
				loadPlot( plot, obj )
			}
		}

	} catch(e) {
		obj.sayerror('Cannot make plot: '+(e.message||e))
		return
	}
}





function initdataset (obj) {
	const par = {
		genome: obj.genome.name,
		dslabel: obj.dslabel,
		init: 1,
	}
	return client.dofetch('mdssurvivalplot', par)
	.then(data=>{
		if(data.error) throw data.error
		if(!data.plottypes) throw 'plottypes[] missing'
		obj.plottypes = {}
		for(const a of data.plottypes) {
			obj.plottypes[ a.key ] = a
		}
	})
}



function doPlot( plot, obj ) {
	/*
	make one plot
	.samplesets[]
		.name
		.steps[]
			.x/y
			.censored[]
	*/
	const colorfunc = scaleOrdinal(schemeCategory10)

	let maxx = 0
	for(const curve of plot.samplesets) {
		curve.color = colorfunc( curve.name )
		for(const s of curve.steps) {
			maxx = Math.max(maxx, s.x)
		}
	}

	plot.svg.selectAll('*').remove()
	// curves
	{
		const g = plot.svg.append('g')
			.attr('transform','translate('+(plot.yaxisw+plot.yaxispad)+','+(plot.toppad)+')')
		for(const curve of plot.samplesets) {
			const ticks = []
			const pathd = ['M 0 0']
			for(const s of curve.steps) {
				pathd.push('H '+(plot.width*s.x/maxx))
				const y = plot.height * (s.y+s.drop)
				pathd.push('V '+ y)
				if(s.censored) {
					const y = plot.height * s.y
					for(const c of s.censored) {
						const x = plot.width*c/maxx
						ticks.push('M '+(x-plot.censorticksize/2)+' '+(y-plot.censorticksize/2)
							+' l '+plot.censorticksize+' '+plot.censorticksize
							+' M '+(x+plot.censorticksize/2)+' '+(y-plot.censorticksize/2)
							+' l -'+plot.censorticksize+' '+plot.censorticksize
							)
					}
				}
			}
			g.append('path')
				.attr('d', pathd.join(' '))
				.attr('stroke',curve.color)
				.attr('fill','none')
			if(ticks.length) {
				g.append('path')
					.attr('d', ticks.join(' '))
					.attr('stroke', curve.color)
					.attr('fill','none')
			}
		}
	}
	// y axis
	{
		const g = plot.svg.append('g')
			.attr('transform','translate('+(plot.yaxisw)+','+(plot.toppad)+')')
		client.axisstyle({
			axis: g.call( axisLeft().scale(
				scaleLinear().domain([0,1]).range([plot.height,0])
				)
			),
			showline:1,
			fontsize:plot.tickfontsize,
		})
		plot.svg.append('g')
			.attr('transform','translate('+(plot.labfontsize)+','+(plot.toppad+plot.height/2)+')')
			.append('text')
			.text('Survival')
			.attr('font-size',plot.labfontsize)
			.attr('transform','rotate(-90)')
	}
	// x axis
	{
		const g = plot.svg.append('g')
			.attr('transform','translate('+(plot.yaxisw+plot.yaxispad)+','+(plot.toppad+plot.height+plot.xaxispad)+')')
		client.axisstyle({
			axis: g.call( axisBottom().scale(
				scaleLinear().domain([0,maxx]).range([0,plot.width])
				)
			),
			showline:1,
			fontsize:plot.tickfontsize
		})
		plot.svg.append('text')
			.text('Years')
			.attr('x', plot.yaxisw+plot.yaxispad+plot.width/2)
			.attr('y', plot.toppad+plot.height+plot.xaxispad+plot.xaxish)
	}
	plot.svg
		.attr('width', plot.yaxisw+plot.yaxispad+plot.width+plot.rightpad)
		.attr('height', plot.toppad+plot.height+plot.xaxispad+plot.xaxish)

	// legend
	if(plot.samplesets.length>1) {
		plot.legend.d_curves.selectAll('*').remove()
		for(const c of plot.samplesets) {
			plot.legend.d_curves.append('div')
				.style('margin','3px')
				.html('<span style="background:'+c.color+'">&nbsp;&nbsp;</span> '+c.name)
		}
	}
}




function loadPlot (plot, obj) {
	const par = {
		genome: obj.genome.name,
		dslabel: obj.dslabel,
		type: plot.type,
		samplerule: plot.samplerule,
	}
	client.dofetch('mdssurvivalplot', par)
	.then(data=>{
		if(data.error) throw data.error
		if(!data.samplesets) throw 'samplesets[] missing'
		plot.samplesets = data.samplesets
		doPlot( plot, obj )
	})
	.catch(e=>{
		obj.sayerror(e)
	})
}



function validatePlot_initDom( p, obj ) {
	if(!p.type) throw '.type missing from a plot'
	if(!p.samplerule) throw '.samplerule{} missing from a plot'
	if(!p.samplerule.full) throw '.samplerule.full{} missing from a plot'
	if(p.samplerule.full.byattr) {
		if(!p.samplerule.full.key) throw '.samplerule.full.key missing from a plot'
		if(!p.samplerule.full.value) throw '.samplerule.full.value missing from a plot'
	} else {
		throw 'unknown rule for samplerule.full for a plot'
	}

	const plot = {
		type: p.type,
		samplerule: p.samplerule,
		width: 500,
		height: 500,
		toppad:10,
		rightpad:10,
		xaxispad:10,
		yaxispad:10,
		xaxish: 40,
		yaxisw: 65,
		censorticksize:6,
		tickfontsize:14,
		labfontsize:15,
		d: obj.plotdiv.append('div').style('margin','20px'),
		legend:{}
	}

	if(plot.name) {
		plot.d.append('div')
			.text(plot.name)
			.style('margin','10px')
	}


	// legend
	if(p.samplerule.full.byattr) {
		plot.d.append('div')
			.style('margin','10px')
			.text( p.samplerule.full.key+': '+p.samplerule.full.value )
	} else {
		// new samplerule for full set
	}

	if(p.samplerule.set) {
		// to fill in curve legend after doing plot
		plot.legend.d_curves = plot.d.append('div')
			.style('margin','10px')
	}

	plot.svg = plot.d.append('svg')

	obj.plots.push( plot )
	return plot
}












