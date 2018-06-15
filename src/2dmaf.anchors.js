import {select as d3select,event as d3event} from 'd3-selection'
import * as client from './client'

export default class Anchors {
	constructor(axiswidth,sp,sample2height,shareheight,sharewidth) {
		this.shareheight = shareheight
		this.sharewidth = sharewidth
		this.settings = {
			visible: true,
			opacity: 0.3,
			x: 0,
			y: 0,
			xOffset: axiswidth+sp+sample2height,
			yOffset: shareheight,
			currX: axiswidth+sp+sample2height,
			currY: shareheight,
			strokeWidth: 5,
			stroke: 'red',
			xarmlen: 25,
		}
	}

	addControls(headerdiv) {
		const anchorbtn = headerdiv.append('button')
			.text('Anchors')
			.on('click',()=>{
				this.anchormenu.showunder(d3event.target)
				this.xInput.property('value', (this.settings.x/this.sharewidth).toFixed(2))
				this.yInput.property('value', (this.settings.y/this.sharewidth).toFixed(2))
			})

		this.anchormenu = new client.Menu({border:'solid 1px black'})
		this.anchormenu.d.style('text-align','center')
		this.addVisibilityToggle()
		this.addCoordInput()
		this.addOpacityInput()
	}

	addVisibilityToggle() {
		this.anchormenu.d.append('div')
			.append('button')
			.style('margin-bottom','10px')
			.html('show | hide')
			.on('click',()=>{
				this.settings.visible = !this.settings.visible
				this.g_anchor.style('display', this.settings.visible ? '' : 'none')
			})
	}

	addCoordInput() {
		const xdiv = this.anchormenu.d.append('div')
		xdiv.append('label').html('X:&nbsp;')
		this.xInput = xdiv.append('input')
		this.xInput.attr('type','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',0)
			.style('width','80px')
			.on('change',()=>{
				this.settings.x = +this.xInput.property('value')*this.sharewidth
				this.settings.currX = this.settings.x + this.settings.xOffset
				this.d_anchor.transition().duration(1000)
					.attr('x1',this.settings.currX)
					.attr('x2',this.settings.currX)
				this.x_anchor.transition().duration(1000)
				.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
			})

		const ydiv = this.anchormenu.d.append('div')
		ydiv.append('label').html('Y:&nbsp;')
		this.yInput = ydiv.append('input')
		this.yInput.attr('type','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',0)
			.style('width','80px')
			.on('change',()=>{
				this.settings.y = +this.yInput.property('value')*this.shareheight
				this.settings.currY = -this.settings.y + this.settings.yOffset
				this.r_anchor.transition().duration(1000)
					.attr('y1',this.settings.currY)
					.attr('y2',this.settings.currY)
				this.x_anchor.transition().duration(1000)
				.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
			})
	}

	addOpacityInput() {
		const opdiv = this.anchormenu.d.append('div')
		opdiv.append('label').html('Opacity:&nbsp;')
		const opInput = opdiv.append('input')
		opInput.attr('type','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',this.settings.opacity)
			.style('width','50px')
			.on('change',()=>{
				this.settings.opacity = opInput.property('value')
				this.g_anchor.style('opacity',this.settings.opacity)
			})
	}

	render(g_anchor) { console.log(this)
		this.g_anchor = g_anchor
						.style('opacity', this.settings.opacity)
						.style('display', this.settings.visible ? '' : 'none')
		
		this.r_anchor = g_anchor.append('line')
						.style('stroke',this.settings.stroke)
						.style('stroke-width',this.settings.strokeWidth)
		
		this.d_anchor = g_anchor.append('line')
						.style('stroke',this.settings.stroke)
						.style('stroke-width',this.settings.strokeWidth)
		
		this.x_anchor = g_anchor.append('g')
						.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
						.style('stroke',this.settings.stroke)
						.style('stroke-width',this.settings.strokeWidth)
						.on('mousedown',()=>{
							const x = d3event.clientX
							const y = d3event.clientY
							let _x=this.settings.currX, _y=this.settings.currY
							
							this.x_anchor
							.on('mousemove',()=>{
								_x = this.settings.currX - x + d3event.clientX
								_y = this.settings.currY - y + d3event.clientY
								this.r_anchor.attr('y1',_y).attr('y2',_y)
								this.d_anchor.attr('x1',_x).attr('x2',_x)
								this.x_anchor.attr('transform','translate('+_x+','+_y+')')
							})
							.on('mouseup',()=>{
								this.x_anchor.on('mousemove',null)
								_x = this.settings.currX - x + d3event.clientX
								_y = this.settings.currY - y + d3event.clientY
								this.settings.x = _x < this.settings.xOffset ? 0 : _x - this.settings.xOffset
								this.settings.y = _y > this.settings.yOffset ? 0 : -(_y - this.settings.yOffset)
								this.settings.currX = this.settings.x + this.settings.xOffset
								this.settings.currY = -this.settings.y + this.settings.yOffset

								this.r_anchor.transition().duration(100)
										.attr('y1',this.settings.currY).attr('y2',this.settings.currY)
								this.d_anchor.transition().duration(100)
										.attr('x1',this.settings.currX).attr('x2',this.settings.currX)
								this.x_anchor.transition().duration(100)
										.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
							})
						})

		// create background for better mousemove capture
		this.x_anchor.append('circle')
			.attr('cx', 0) //this.settings.xarmlen)
			.attr('cy', 0) //this.settings.xarmlen)
			.attr('r', this.settings.xarmlen)
			.style('opacity',0)

		// make an +
		this.x_anchor.append('line')
			.attr('x1',-this.settings.xarmlen)
			.attr('x2',this.settings.xarmlen)
			.attr('y1',0)
			.attr('y2',0)

		this.x_anchor.append('line')
			.attr('x1',0)
			.attr('x2',0)
			.attr('y1',this.settings.xarmlen)
			.attr('y2',-this.settings.xarmlen)
	} 

	setD(y1,y2) {
		this.settings.D = {y1,y2}
		this.d_anchor 
			.attr('x1',this.settings.currX)
			.attr('x2',this.settings.currX)
			.attr('y1',y1)
			.attr('y2',y2)
	}

	setR(x1,x2) {
		this.settings.R = {x1,x2}
		this.r_anchor 
			.attr('x1',x1)
			.attr('x2',x2)
			.attr('y1',this.settings.currY)
			.attr('y2',this.settings.currY)
	}
}
