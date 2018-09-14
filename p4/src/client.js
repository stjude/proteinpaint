import {scaleLinear} from 'd3-scale'
import {select as d3select, selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {transition} from 'd3-transition'




export const font='Arial'
export const textlensf=.6 // to replace n.getBBox().width for detecting filling font size which breaks in chrome


let base_zindex=null




export const domaincolorlst = [ '#8dd3c7', '#bebada', '#fb8072', '#80b1d3', '#E8E89E', "#a6d854", '#fdb462', "#ffd92f","#e5c494","#b3b3b3" ]



export function dofetch (path,arg,isget) {
	const jwt = localStorage.getItem('jwt')
	if(jwt) {
		arg.jwt = jwt
	}
	return fetch(new Request(
		(localStorage.getItem('hostURL')||'') + path,
		{
			method: (isget ? 'GET' : 'POST'),
			body: (arg ? JSON.stringify(arg) : undefined)
		})
	)
	.then(data=>{return data.json()})
}



export function appear(d,display) {
	d.style('opacity',0)
	.style('display',display || 'block')
	.transition().style('opacity',1)
}

export function disappear(d,remove){
	d.style('opacity',1).transition().style('opacity',0).call(()=>{
		if(remove) {
			d.remove()
		} else {
			d.style('display','none').style('opacity',1)
		}
	})
}




export class Menu{
	constructor(arg={}) {

		this.typename = Math.random().toString()

		const body=d3select(document.body)
		body.on('mousedown.menu'+this.typename,()=>{
				this.hide()
			})

		this.d=body.append('div')
			.style('display','none')
			.style('position','absolute')
			.style('background-color','white')
			.style('font-family',font)
			.on('mousedown.menu'+this.typename,()=>{
				d3event.stopPropagation()
			})

		if(base_zindex) {
			this.d.style('z-index',base_zindex+1)
		}

		this.d.style('padding', 'padding' in arg ? arg.padding : '20px')
		if(arg.border) {
			this.d.style('border',arg.border)
		} else {
			this.d.style('box-shadow','0px 2px 4px 1px #999')
		}
		this.offsetX = Number.isInteger(arg.offsetX) ? arg.offsetX : 20
		this.offsetY = Number.isInteger(arg.offsetY) ? arg.offsetY : 20

	}

	clear() {
		this.d.selectAll('*').remove()
		return this
	}

	show(x,y) {
		// show around a given point
		document.body.appendChild(this.d.node())

		this.d.style('display','block')
		const leftx = x+this.offsetX
		const topy  = y+this.offsetY
		const p=this.d.node().getBoundingClientRect()

		if(leftx+p.width > window.innerWidth) {
			if(window.innerWidth-x > p.width) {
				this.d.style('left',null)
					.style('right',(window.innerWidth-x-window.scrollX+this.offsetX)+'px')
			} else {
				// still apply 'left', shift to left instead
				this.d.style('left',(Math.max(0, window.innerWidth-p.width)+window.scrollX)+'px')
					.style('right',null)
			}
		} else {
			this.d.style('left',(leftx+window.scrollX)+'px')
				.style('right',null)
		}
		if(topy+p.height > window.innerHeight) {
			if(window.innerHeight-y > p.height) {
				this.d.style('top',null)
					.style('bottom',(window.innerHeight-y-window.scrollY+this.offsetY)+'px')
			} else {
				// still apply 'top', shift to top instead
				this.d.style('top', (Math.max(0, window.innerHeight-p.height)+window.scrollY)+'px')
					.style('bottom',null)
			}
		} else {
			this.d.style('top', (topy+window.scrollY)+'px')
				.style('bottom',null)
		}

		this.d.transition().style('opacity',1)
		return this
	}

	showunder(dom, yspace) {
		// not well thought of yet
		// this.d should find optimum position around the dom
		const p=dom.getBoundingClientRect()
		this.d
			.style('display','block')
			.style('right',null)
			.style('bottom',null)
			.style('left', (p.left+window.scrollX)+'px')
			.style('top',  (p.top + p.height + window.scrollY + (yspace || 5) )+'px' )
			.transition().style('opacity',1)
		return this
	}

	hide() {
		this.d.style('display','none').style('opacity',0)
		return this
	}

	fadeout() {
		this.d.transition().style('opacity',0).on('end',()=>this.d.style('display','none'))
		return this
	}
}



export function newpane(pm) {
	/*
	parameter

	.setzindex
		quick dirty way to set the global variable base_zindex

	.x
	.y
	.toshrink
		bool
	.close
		callback
	.closekeep
		bool
	.headpad
		header label bar padding

	*/

	if(pm.setzindex) {
		// dirty fix
		base_zindex=pm.setzindex
		return
	}

	const dur=300
	const pp={}
	const body=d3select(document.body)
	pp.pane=body.append('div').attr('class','sja_pane')
		.style('left',(pm.x+window.pageXOffset)+'px')
		.style('top',(pm.y+window.pageYOffset)+'px')
		.style('opacity',0)

	if(base_zindex) {
		// fixed, from embedding instructions
		pp.pane.style('z-index',base_zindex)
	}


	const toprow=pp.pane.append('div')
		.on('mousedown',()=>{
			d3event.preventDefault()
			const oldx=Number.parseInt(pp.pane.style('left')),
				oldy=Number.parseInt(pp.pane.style('top'))
			const x0=d3event.clientX,
				y0=d3event.clientY
			body.on('mousemove',()=>{
				pp.pane.style('left',oldx+d3event.clientX-x0+'px')
					.style('top',oldy+d3event.clientY-y0+'px')
			})
			body.on('mouseup',function(){
				body.on('mouseup',null).on('mousemove',null)
			})
			// order of precedence, among all panes
			document.body.appendChild( pp.pane.node() )
		})

	const butt=toprow.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('padding','4px 10px')
		.style('margin','0px')
		.style('border-right','solid 1px white')
		.style('cursor','default')
		.style('font-size','1.5em')
		.on('mousedown',()=>{
			document.body.dispatchEvent( new Event('mousedown') )
			d3event.stopPropagation()
		})

	if(pm.toshrink) {
		pp.mini=false
		butt.html('&#9473;').on('click',()=>{
			butt.html(pp.mini ? '&#9473;' : '&#9725;')
			if(pp.mini) {
				appear(pp.body)
			} else {
				disappear(pp.body)
			}
			pp.mini=!pp.mini
		})
	} else {
		butt.html('&times;')
		if(pm.close) {
			// custom callback on close button
			butt.on('click',pm.close)
		} else if(pm.closekeep) {
			// hide and keep to bring it on later
			butt.on('click',()=>{
				pp.pane.transition().duration(dur).style('opacity',0).call(()=>pp.pane.style('display','none'))
			})
		} else {
			// close and remove pane from page
			butt.on('click',()=>{
				pp.pane.transition().duration(dur).style('opacity',0).call(()=>pp.pane.remove())
			})
		}
	}

	// where you can write
	pp.header=toprow.append('div')
		.style('display','inline-block')
		.style('font-family',font)
		.style('padding', pm.headpad || '5px 10px')

	pp.body = pp.pane.append('div')
		.style('font-family',font)
		.style('margin-top','10px')

	pp.pane.transition().duration(dur).style('opacity',1)

	return pp
}





export function launch_block ( p ) {
	import('./block').then( _ => {
		_.Block.create( p )
	})
}







export function sayerror(holder,msg) {
	const div=holder.append('div')
		.attr('class','sja_errorbar')
	div.append('div').html(msg)
	div.append('div').html('&#10005;').on('click',()=>{
		disappear(div,true)
	})
}



export function neataxis ( g, fontsize ) {
	g.selectAll('text')
		.attr('font-family', font)
		.attr('font-size', fontsize)
	g.select('path')
		.attr('shape-rendering','crispEdges')
}
