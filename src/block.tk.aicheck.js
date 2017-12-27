import {scaleLinear} from 'd3-scale'
import {axisLeft,axisRight} from 'd3-axis'
import * as client from './client'
import {event as d3event} from 'd3-selection'



/*
follows bigwig track, main & subpanel rendered separately
*/





function makeTk(tk,block) {
	tk.img=tk.glider.append('image')

	if(!tk.coveragemax) {
		tk.coveragemax=100
	}

	if(!tk.vafheight) {
		tk.vafheight = 50
	}
	if(!tk.coverageheight) {
		tk.coverageheight = 30
	}
	if(!tk.rowspace) {
		tk.rowspace=5
	}

	tk.tklabel
		.attr('y',20)
		.text(tk.name)
		.each(function(){
			tk.leftLabelMaxwidth = this.getBBox().width
		})

	// left side axes
	tk.Tvafaxis = tk.gleft.append('g')
	tk.Nvafaxis = tk.gleft.append('g')
	tk.aiaxis   = tk.gleft.append('g')
	// left labels
	tk.label_tumor = tk.gleft.append('text')
		.attr('font-family',client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline','central')
		.attr('text-anchor','end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity',.6)
		.text('Tumor')
	tk.label_germline = tk.gleft.append('text')
		.attr('font-family',client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline','central')
		.attr('text-anchor','end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity',.6)
		.text('Germline')
	tk.label_ai = tk.gleft.append('text')
		.attr('font-family',client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline','central')
		.attr('text-anchor','end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity',.6)
		.text('abs(T-G)')
	// right side axes
	tk.Tcovaxis = tk.gright.append('g')
	tk.Ncovaxis = tk.gright.append('g')
	// right labels
	tk.label_tumorcoverage = tk.gright.append('text')
		.attr('font-family',client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline','central')
		.attr('x',10)
		.attr('fill-opacity',.6)
		.text('T coverage')
	tk.label_germlinecoverage = tk.gright.append('text')
		.attr('font-family',client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline','central')
		.attr('x',10)
		.attr('fill-opacity',.6)
		.text('G coverage')

	tk.config_handle = block.maketkconfighandle(tk)
		.on('click',()=>{
			tk.tkconfigtip.clear()
				.showunder( tk.config_handle.node() )
			configPanel( tk, block )
		})
}





function tkarg(tk,block) {
	const a = {
		jwt: block.jwt,
		rglst:block.tkarg_rglst(),
		regionspace:block.regionspace,
		width:block.width,

		coveragemax: tk.coveragemax,

		file:tk.file,
		url:tk.url,
		indexURL:tk.indexURL,
		vafheight:tk.vafheight,
		coverageheight:tk.coverageheight,
		rowspace:tk.rowspace
	}
	return a
}



export function loadTk(tk,block) {
	
	// load main part of track

	if(tk.uninitialized) {
		makeTk(tk,block)
		delete tk.uninitialized
	}

	block.tkcloakon(tk)

	const par=tkarg(tk,block)

	const req = new Request(block.hostURL+'/tkaicheck', {
		method:'POST',
		body:JSON.stringify(par)
	})
	fetch(req)
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw({message:data.error})

		const imgh = tk.vafheight*3 + tk.rowspace*4 + tk.coverageheight*2

		tk.height_main = tk.toppad + imgh + tk.bottompad
		tk.img
			.attr('width',block.width)
			.attr('height', imgh)
			.attr('xlink:href',data.src)

		if(data.coveragemax) {
			tk.coveragemax = data.coveragemax
		}

		if(!data.nodata) {
			const scale=scaleLinear().domain([0,1]).range([tk.vafheight,0])

			let y = 0
			client.axisstyle({
				axis:tk.Tvafaxis
					.attr('transform','translate(0,'+y+')')
					.call(
						axisLeft().scale(scale).tickValues([0,1])
					),
				color:'black',
				showline:true
			})
			tk.label_tumor.attr('y', y+tk.vafheight*3/4)

			y = tk.vafheight+tk.rowspace+tk.coverageheight+tk.rowspace
			client.axisstyle({
				axis:tk.Nvafaxis
					.attr('transform','translate(0,'+y+')')
					.call(
						axisLeft().scale(scale).tickValues([0,1])
					),
				color:'black',
				showline:true
			})
			tk.label_germline.attr('y', y+tk.vafheight/2)

			y = 2*(tk.vafheight+tk.rowspace+tk.coverageheight+tk.rowspace)
			client.axisstyle({
				axis:tk.aiaxis
					.attr('transform','translate(0,'+y+')')
					.call(
						axisLeft().scale(scale).tickValues([0,1])
					),
				color:'black',
				showline:true
			})
			tk.label_ai.attr('y', y+tk.vafheight/2 )

			const scale2=scaleLinear().domain([0,tk.coveragemax]).range([tk.coverageheight,0])

			y = tk.vafheight+tk.rowspace
			client.axisstyle({
				axis:tk.Tcovaxis
					.attr('transform','translate(0,'+y+')')
					.call(
						axisRight().scale(scale2).tickValues([0,tk.coveragemax])
					),
				color:'black',
				showline:true
			})
			tk.label_tumorcoverage.attr('y', y+tk.coverageheight/2)

			y = 2*(tk.vafheight+tk.rowspace)+tk.coverageheight+tk.rowspace
			client.axisstyle({
				axis:tk.Ncovaxis
					.attr('transform','translate(0,'+y+')')
					.call(
						axisRight().scale(scale2).tickValues([0,tk.coveragemax])
					),
				color:'black',
				showline:true
			})
			tk.label_germlinecoverage.attr('y', y+tk.coverageheight/2)
		}
		return null
	})
	.catch(obj=>{
		tk.img.attr('width',1).attr('height',1)
		if(obj.stack) {
			// error
			console.log(obj.stack)
		}
		return obj.message
	})
	.then((errtext)=>{
		block.tkcloakoff(tk, {error:errtext} )
		block.block_setheight()

		// also load subpanels whenever main panel updates
		for(const panel of tk.subpanels) {
			loadTksubpanel( tk, block, panel )
		}
	})
}




export function loadTksubpanel(tk, block, panel) {

	block.tkcloakon_subpanel(panel)
	const par=tkarg(tk, block)

	par.width = panel.width
	par.rglst = [{
		chr:panel.chr,
		start:panel.start,
		stop:panel.stop,
		width:panel.width
	}]
	//delete par.percentile
	//delete par.autoscale

	const req = new Request(block.hostURL+'/tkaicheck', {
		method:'POST',
		body:JSON.stringify(par)
	})
	fetch(req)
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw({message:data.error})

		panel.img
			.attr('width',panel.width)
			.attr('height', tk.vafheight*3 + tk.rowspace*4 + tk.coverageheight*2)
			.attr('xlink:href',data.src)
		return null
	})
	.catch(obj=>{
		panel.img.attr('width',1).attr('height',1)
		if(obj.stack) {
			// error
			console.log(obj.stack)
		}
		return obj.message
	})
	.then(errtext=>{
		block.tkcloakoff_subpanel(panel, {error:errtext} )
	})
}




function configPanel(tk, block) {

	// height
	{
		const row = tk.tkconfigtip.d.append('div')
			.style('margin-bottom','15px')
		row.append('span').html('Coverage max:&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','60px')
			.property('value',tk.coveragemax)
			.on('keyup',()=>{
				if(d3event.code!='Enter') return
				const s=d3event.target.value
				if(s=='') return
				const v=Number.parseInt(s)
				if(Number.isNaN(v) || v<=1) {
					alert('coverage max must be positive integer')
					return
				}
				tk.coveragemax=v
				loadTk( tk, block)
			})
	}
}
