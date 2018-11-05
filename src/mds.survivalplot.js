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
initplot_dom
doplot
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
		await initdataset( obj )
	} catch(e) {
		obj.sayerror('Cannot initiate: '+(e.message||e))
		return
	}

	initplot_justtest( obj )
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
			obj.plottypes[ a.name ] = a
		}
	})
}



function doplot( plot, obj ) {
	/*
	make one plot
	.samplesets[]
		.name
		.steps[]
			.x/y
			.censored[]
	*/
	let maxx = 0
	for(const curve of plot.samplesets) {
		for(const s of curve.steps) {
			maxx = Math.max(maxx, s.x)
		}
	}
	plot.svg.selectAll('*').remove()
	// curves
	{
		const g = plot.svg.append('g')
			.attr('transform','translate('+(plot.yaxisw+plot.yaxispad)+','+(plot.toppad)+')')
		const ticks = []
		for(const curve of plot.samplesets) {
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
				.attr('stroke','black')
				.attr('fill','none')
			if(ticks.length) {
				g.append('path')
					.attr('d', ticks.join(' '))
					.attr('stroke','black')
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
}




function initplot_justtest (obj) {

	const plot = initplot_dom( obj )

	// just test
	plot.type = 'Event-free survival'
	plot.samplerule = {
		full: {
			byattr:1,
			key: 'primary subtype',
			value: 'PAX5 P80R',
		},
	}

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
		doplot( plot, obj )
	})
	.catch(e=>{
		obj.sayerror(e)
	})
}



function initplot_dom (obj) {
	const plot = {
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
	}
	plot.svg = plot.d.append('svg')
	obj.plots.push( plot )
	return plot
}












