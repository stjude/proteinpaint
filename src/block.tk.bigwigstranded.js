import {scaleLinear} from 'd3-scale'
import * as d3axis from 'd3-axis'
import * as client from './client'
import {event as d3event} from 'd3-selection'
import {defaultcolor} from './common'
import {format as d3format} from 'd3-format'
import {bigwigconfigpanel} from './block.tk.bigwig'







export function bigwigstrandedfromtemplate(tk,template) {
	if(template.strand1) {
		const s={}
		for(const k in template.strand1) {
			s[k]=template.strand1[k]
		}
		s.scale={}
		if(template.strand1.scale) {
			for(const k in template.strand1.scale) {
				s.scale[k]=template.strand1.scale[k]
			}
		} else {
			s.scale.auto=1
		}
		s.barheight=template.strand1.height || 50
		if(!s.ncolor)  s.ncolor='#BD005E'
		if(!s.ncolor2) s.ncolor2='#5E00BD'
		if(!s.pcolor)  s.pcolor='#005EBD'
		if(!s.pcolor2) s.pcolor2='#FA7D00'

		if(s.normalize) {
		} else {
			// disable by default
			s.normalize = {
				dividefactor:1,
				disable:1
			}
		}
		tk.strand1=s
	}
	if(template.strand2) {
		const s={}
		for(const k in template.strand2) {
			s[k]=template.strand2[k]
		}
		s.scale={}
		if(template.strand2.scale) {
			for(const k in template.strand2.scale) {
				s.scale[k]=template.strand2.scale[k]
			}
		} else {
			s.scale.auto=1
		}
		s.barheight=template.strand2.height || 50
		if(!s.ncolor)  s.ncolor='#BD005E'
		if(!s.ncolor2) s.ncolor2='#5E00BD'
		if(!s.pcolor)  s.pcolor='#005EBD'
		if(!s.pcolor2) s.pcolor2='#FA7D00'

		if(s.normalize) {
		} else {
			// disable by default
			s.normalize = {
				dividefactor:1,
				disable:1
			}
		}
		tk.strand2=s
	}

	tk.height_main = tk.toppad
		+(tk.strand1 ? tk.strand1.barheight : 0)
		+(tk.strand2 ? tk.strand2.barheight : 0)
		+tk.bottompad
}







export function bigwigstrandedmaketk(tk,block) {

	const collectlabelw = []
	tk.tklabel
		.text(tk.name)
		.each(function(){
			collectlabelw.push(this.getBBox().width)
		})
	tk.labforward=block.maketklefthandle(tk)
		.text('Forward')
		.each(function(){
			collectlabelw.push(this.getBBox().width)
		})
	tk.labreverse=block.maketklefthandle(tk)
		.text('Reverse')
		.each(function(){
			collectlabelw.push(this.getBBox().width)
		})

	tk.leftLabelMaxwidth = Math.max(...collectlabelw)

	tk.leftaxis=tk.gleft.append('g').attr('transform','translate('+block.lpad+',0)')
	if(tk.strand1) {
		tk.strand1.img=tk.glider.append('image')
	}
	if(tk.strand2) {
		tk.strand2.img=tk.glider.append('image')
	}

	tk.config_handle = block.maketkconfighandle(tk)
		.on('click',()=>{
			tk.tkconfigtip.clear()
				.showunder(tk.config_handle.node())
			configpanel(tk, block )
		})
}




export function bigwigstrandedload(tk,block) {
	if(!tk.strand1) {
		tk.height_main = 50
		block.tkcloakoff(tk, {error:tk.name+': forward strand track missing'})
		block.block_setheight()
		return
	}
	if(!tk.strand2) {
		tk.height_main = 50
		block.tkcloakoff(tk, {error:tk.name+': reverse strand track missing'})
		block.block_setheight()
		return
	}
	block.tkcloakon(tk)

	Promise.resolve()
	.then(()=>{

		const par = block.tkarg_q(tk.strand1)
		par.name=tk.name+' forward strand'

		return requestdata( par, tk, block)
		.then(data=>{
			if(data.error) throw('forward strand error: '+data.error)
			tk.strand1.img
				.attr('width',block.width)
				.attr('height',tk.strand1.barheight)
				.attr('xlink:href',data.src)
			if(block.pannedpx!=undefined) {
				// offset panned distance
				tk.strand1.img.attr('x',-block.pannedpx)
			}
			if(data.minv!=undefined) {
				tk.strand1.scale.min=data.minv
			}
			if(data.maxv!=undefined) {
				tk.strand1.scale.max=data.maxv
			}
			tk.strand1.nodata=data.nodata
		})

	})
	.then(()=>{

		const par=block.tkarg_q(tk.strand2)
		par.name=tk.name+' reverse strand'

		return requestdata( par, tk, block )
		.then(data=>{
			if(data.error) throw('reverse strand error: '+data.error)
			tk.strand2.img
				.attr('width',block.width)
				.attr('height',tk.strand2.barheight)
				.attr('y',tk.strand1.barheight)
				.attr('xlink:href',data.src)
			if(data.minv!=undefined) {
				tk.strand2.scale.min=data.minv
			}
			if(data.maxv!=undefined) {
				tk.strand2.scale.max=data.maxv
			}
			tk.strand2.nodata=data.nodata
		})
	})
	.then(()=>{
		tk.strand1.img.attr('x',0) // shift back
		block.tkcloakoff(tk,{})
		tk.leftaxis.selectAll('*').remove()
		const minvalue=tk.strand2.nodata ? 0 : tk.strand2.scale.min
		const maxvalue=tk.strand1.nodata ? 0 : tk.strand1.scale.max
		const scale=scaleLinear()
			.domain([minvalue, 0, maxvalue ])
			.range([tk.strand1.barheight+tk.strand2.barheight, tk.strand1.barheight, 0])
		client.axisstyle({
			axis:tk.leftaxis.call(
				d3axis.axisRight().scale(scale).tickFormat(d3format('r')).tickValues([minvalue, 0, maxvalue])
			),
			color:'black',
			showline:true
		})
		tk.height_main = tk.toppad+tk.strand1.barheight+tk.strand2.barheight+tk.bottompad
		tk.labforward.transition().attr('y',tk.strand1.barheight/2)
		tk.labreverse.transition().attr('y',tk.strand1.barheight+tk.strand2.barheight/2)
		block.block_setheight()
	})
	.catch(err=>{
		tk.strand1.img.attr('x',0) // shift back
		tk.height_main = 50
		block.tkcloakoff(tk, {error: ( typeof(err)=='string' ? err : err.message )})
		if(err.stack) console.log(err.stack)
		block.block_setheight()
	})
}




function requestdata(par, tk, block) {
	par.jwt = block.jwt
	return fetch( new Request(block.hostURL+'/tkbigwig',{
		method:'POST',
		body:JSON.stringify(par)
	}))
	.then(data=>{return data.json()})
}




function configpanel(tk, block ) {
	const holder=tk.tkconfigtip.d
	{
		const div=client.labelbox({
			holder:holder,
			margin:'0px 0px 15px 0px',
			label:'Forward'
		})
		const obj=bigwigconfigpanel(tk.strand1, block, div, ()=>bigwigstrandedload(tk,block))
		obj.ncolor.row.remove()
		obj.dotplot.row.remove()
		if(obj.ncolor2.row) {
			obj.ncolor2.row.remove()
		}
		obj.pcolor.lab.text('Color')
		if(obj.pcolor2.lab) {
			obj.pcolor2.lab.text('Beyond threshold')
		}
	}
	{
		const div=client.labelbox({
			holder:holder,
			label:'Reverse'
		})
		const obj=bigwigconfigpanel(tk.strand2, block, div, ()=>bigwigstrandedload(tk,block))
		obj.pcolor.row.remove()
		obj.dotplot.row.remove()
		if(obj.pcolor2.row) {
			obj.pcolor2.row.remove()
		}
		obj.ncolor.lab.text('Color')
		if(obj.ncolor2.lab) {
			obj.ncolor2.lab.text('Beyong threshold')
		}
	}
}
