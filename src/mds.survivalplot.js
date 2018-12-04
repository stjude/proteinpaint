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
obj{}
.genome
.mds
.plotlist[]
.geneexpression{}
	.gene{}
		name/chr/start/stop
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

	obj.uidiv = holder.append('div')
		.style('margin','20px')
	obj.plotdiv = holder.append('div')
		.style('margin','20px')
	obj.legendtable = holder.append('table')
		.style('border-spacing','5px')

	try {

		await init_next( obj )

	} catch(e) {
		if(e.stack) console.log(e.stack)
		obj.sayerror('Cannot make plot: '+(e.message||e))
	}
}




async function init_next( obj ) {
/* feel free to throw
*/

	await initdataset( obj )

	if( obj.plotlist) {
		/*
		show plots rightaway
		no ui for creating plot
		*/
		if(!Array.isArray(obj.plotlist)) throw '.plotlist should be array'
		for(const p of obj.plotlist) {
			const plot = validatePlot_initDom( p, obj )
			loadPlot( plot, obj )
		}
		return
	}

	init_plotmaker( obj )
}




function initdataset (obj) {
	const par = {
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		init: 1,
	}
	return client.dofetch('mdssurvivalplot', par)
	.then(data=>{
		if(data.error) throw data.error
		if(!data.plottypes) throw 'plottypes[] missing'
		obj.plottypes = data.plottypes
		obj.samplegroupings = data.samplegroupings
	})
}



function init_plotmaker( obj ) {
/*
init ui for plot maker
each time it runs it should create a plot
*/
	const p = {
		samplerule:{
			full:{}
		},
	}

	const div = obj.uidiv.append('div')
		.style('margin','20px')

	if(obj.plottypes.length==1) {
		p.type = obj.plottypes[0].key
	} else {
		const s = div
			.append('div')
			.style('margin-bottom','10px')
			.append('select')
			.on('change',()=>{
				p.type = d3event.target.options[ d3event.target.selectedIndex].value
			})
		for(const t of obj.plottypes) {
			s.append('option')
				.text(t.name)
				.property('value', t.key)
		}
		p.type = obj.plottypes[0].key
	}

	if(obj.geneexpression) {
		/*
		expression cutoff
		*/
		p.samplerule.set = {
			genevaluepercentilecutoff:1,
			cutoff: 50,
			gene: obj.geneexpression.gene,
			chr: obj.geneexpression.chr,
			start: obj.geneexpression.start,
			stop: obj.geneexpression.stop
		}
		const row = div.append('div')
			.style('margin-bottom','10px')
		row.append('span')
			.html('Divide samples by '+obj.geneexpression.gene+' expression&nbsp;')

		const s = row.append('select')
			.on('change',()=>{
				const o = d3event.target.options[ d3event.target.selectedIndex]
				if(o.median) {
					p.samplerule.set.genevaluepercentilecutoff=1
					p.samplerule.set.cutoff=50
					delete p.samplerule.set.genevaluequartile
				} else if(o.quartile){
					p.samplerule.set.genevaluequartile=1
					delete p.samplerule.set.genevaluepercentilecutoff
					delete p.samplerule.set.cutoff
				}
			})

		s.append('option')
			.text('median (group=2)')
			.property('median',1)
		s.append('option')
			.text('quartile (group=4)')
			.property('quartile',1)

		// other percentile
	}

	if(obj.samplegroupings) {

		// default setting
		p.samplerule.full.byattr = 1
		p.samplerule.full.key = obj.samplegroupings[0].key
		p.samplerule.full.value = obj.samplegroupings[0].values[0].value

		const row = div.append('div')
			.style('margin-bottom','20px')

		row.append('span')
			.html('Use samples from&nbsp;')

		const attr2select = {}

		const s = row.append('select')
			.style('margin-right','5px')
			.on('change',()=>{
				for(const k in attr2select) {
					attr2select[ k ].style('display','none')
				}
				const o = d3event.target.options[ d3event.target.selectedIndex ]
				if(o.useall) {
					p.samplerule.full.useall = 1
					delete p.samplerule.full.byattr
					return
				}
				delete p.samplerule.full.useall
				p.samplerule.full.byattr = 1
				p.samplerule.key = o.key
				const s3 = attr2select[ o.key ]
				s3.style('display', 'inline')
				p.samplerule.full.value = s3.node().options[ s3.node().selectedIndex ].innerHTML
			})

		for(const [i,attr] of obj.samplegroupings.entries() ) {

			s.append('option')
				.text(attr.label)
				.property('key', attr.key)

			const s2 = row.append('select')
				.on('change',()=>{
					p.samplerule.full.value = d3event.target.options[d3event.target.selectedIndex].value
				})

			attr2select[ attr.key ] = s2
			if(i>0) {
				// initially only show the first
				s2.style('display','none')
			}

			for(const v of attr.values) {
				s2.append('option')
					.text(v.value+' (n='+v.count+')')
					.property('value',v.value)
			}
		}

		s.append('option')
			.text('all samples')
			.property('useall',1)

	} else {
		p.samplerule.full.useall = 1
	}

	div.append('button')
		.text('Make plot')
		.on('click',()=>{

			// do things hard way
			obj.plots = []
			obj.plotdiv.selectAll('*').remove()

			try {
				const plot = validatePlot_initDom( p, obj)
				loadPlot( plot, obj)
			} catch(e) {
				if(e.stack) console.log(e.stack)
				obj.sayerror(e.message || e)
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
			.attr('font-size', plot.labfontsize)
			.text( obj.plottypes.find(i=>i.key==plot.type).timelabel )
			.attr('x', plot.yaxisw+plot.yaxispad+plot.width/2)
			.attr('y', plot.toppad+plot.height+plot.xaxispad+plot.xaxish-3)
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
		dslabel: obj.mds.label,
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

	if(p.samplerule.full.useall) {
	} else if(p.samplerule.full.byattr) {
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












