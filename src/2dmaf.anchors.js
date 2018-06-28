import {select as d3select,event as d3event} from 'd3-selection'
import * as client from './client'

export default class Anchors {
	constructor(opts) {
		this.opts = opts
		this.anchorType = opts.anchorType
		this.shareheight = opts.shareheight
		this.sharewidth = opts.sharewidth
		const x = 'x' in opts ? opts.x : 0
		const y = 'y' in opts ? opts.y : 0
		this.settings = {
			visible: true,
			opacity: 0.3,
			x: x,
			y: y,
			xOffset: opts.axiswidth + opts.sp + opts.sample2height,
			yOffset: opts.shareheight,
			currX: opts.axiswidth + opts.sp + opts.sample2height + x,
			currY: opts.shareheight - y,
			strokeWidth: 'strokeWidth' in opts ? opts.strokeWidth : 5,
			stroke: 'stroke' in opts ? opts.stroke : 'red',
			xarmlen: 'xarmlen' in opts ? opts.xarmlen : 25,
		}
		this.addControls(this.anchorType ? null : this.opts.headerdiv)
	}

	setWrapper(g) {
		this.opts.wrapper = g
	}

	addControls(headerdiv=null) {
		if (headerdiv) {
			const anchorbtn = headerdiv.append('button')
			.text('Anchors')
			.on('click',()=>{
				this.anchormenu.showunder(d3event.target)
				this.xInput.property('value', (this.settings.x/this.sharewidth).toFixed(2))
				this.yInput.property('value', (this.settings.y/this.sharewidth).toFixed(2))
			})
		}

		this.anchormenu = new client.Menu({border:'solid 1px black'})
		this.anchormenu.d.style('text-align','center')
		this.addCoordInput()
		this.addColorInput()
		this.addOpacityInput()
		if (!this.anchorType) this.addSubmitBtns()
		else this.addDeleteBtn()
	}

	addColorInput() {
		const div = this.anchormenu.d.append('div')
		div.append('label').html('Color:&nbsp;')
		this.strokeInput = div.append('input')
		this.strokeInput.attr('this.anchorType','text')
			.property('value',this.settings.stroke)
			.style('width','50px')
	}

	addOpacityInput() {
		const div = this.anchormenu.d.append('div')
		div.append('label').html('Opacity:&nbsp;')
		this.opacityInput = div.append('input')
		this.opacityInput.attr('this.anchorType','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',this.settings.opacity)
			.style('width','50px')
	}

	addSubmitBtns() {
		if (this.anchorType) return
		const div = this.anchormenu.d.append('div')
		div.append('label').html('Add Anchor: ')
		div.append('button').html('R').on('click',()=>{
			new SyncedAnchors(this.getSettings('r'))
			this.anchormenu.hide()
		})
		div.append('button').html('D').on('click',()=>{
			new SyncedAnchors(this.getSettings('d'))
			this.anchormenu.hide()
		})
		div.append('button').html('X').on('click',()=>{
			new SyncedAnchors(this.getSettings('x'))
			this.anchormenu.hide()
		})
		div.append('button').html('synced').on('click',()=>{
			new SyncedAnchors(this.getSettings('synced'))
			this.anchormenu.hide()
		})
	}

	getSettings(anchorType) {
		return Object.assign({},this.opts,{
			anchorType: anchorType,
			opacity: this.opacityInput.property('value'),
			x: this.xInput.property('value')*this.sharewidth,
			y: this.yInput.property('value')*this.shareheight,
			stroke: this.strokeInput.property('value'),
		})
	}

	addCoordInput() {
		const xdiv = this.anchormenu.d.append('div')
		xdiv.append('label').html('X:&nbsp;')
		this.xInput = xdiv.append('input')
		this.xInput.attr('this.anchorType','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',0)
			.style('width','80px')

		const ydiv = this.anchormenu.d.append('div')
		ydiv.append('label').html('Y:&nbsp;')
		this.yInput = ydiv.append('input')
		this.yInput.attr('this.anchorType','number')
			.attr('min',0)
			.attr('max',1)
			.attr('step',0.01)
			.property('value',0)
			.style('width','80px')
	}

	addDeleteBtn() {
		if (!this.anchorType) return
		const div = this.anchormenu.d.append('div')
		div.append('button').html('Delete').on('click',()=>{
			this.g_anchor.remove()
			this.anchormenu.hide()
		})
	}
}

class SyncedAnchors extends Anchors {
	constructor(opts) {
		super(opts)
		this.render()
		
		this.strokeInput.on('change',()=>{
			this.settings.stroke = this.strokeInput.property('value')
			this.g_anchor.style('stroke',this.settings.stroke)
			this.anchormenu.hide()
		})
		
		this.opacityInput.on('change',()=>{
			this.settings.opacity = input.property('value')
			this.g_anchor.style('opacity',this.settings.opacity)
			this.anchormenu.hide()
		})
		
		this.xInput.on('change',()=>{
			this.settings.x = +this.xInput.property('value')*this.sharewidth
			this.settings.currX = this.settings.x + this.settings.xOffset
			if (this.d_anchor) {
				this.d_anchor.transition().duration(1000)
				.attr('x1',this.settings.currX)
				.attr('x2',this.settings.currX)
			}
			if (this.x_anchor) {
				this.x_anchor.transition().duration(1000)
				.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
			}
			this.anchormenu.hide()
		})
		
		this.yInput.on('change',()=>{
			this.settings.y = +this.yInput.property('value')*this.shareheight
			this.settings.currY = -this.settings.y + this.settings.yOffset
			if (this.r_anchor) {
				this.r_anchor.transition().duration(1000)
					.attr('y1',this.settings.currY)
					.attr('y2',this.settings.currY)
			}
			if (this.x_anchor) {
				this.x_anchor.transition().duration(1000)
				.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
			}
			this.anchormenu.hide()
		})
	}

	render() {
		this.g_anchor = this.opts.wrapper.append('g')
			.style('stroke',this.settings.stroke)
			.style('opacity', this.settings.opacity)
			.style('display', this.settings.visible ? '' : 'none')
			.style('stroke-width',this.settings.strokeWidth)
			.on('click', this.anchorType=='synced' ? null : ()=>{
				this.anchormenu.showunder(d3event.target)
			})

		this.renderD()
		this.renderR()
		this.renderX()
	} 

	renderD() {
		if (!['synced','d'].includes(this.anchorType)) return
		this.d_anchor = this.g_anchor.append('line')
		const o = this.opts
		this.updateD(o.shareheight+o.sp2, o.shareheight+o.sample1height)
	}

	updateD(y1,y2) {
		if (!['synced','d'].includes(this.anchorType)) return
		this.settings.D = {y1,y2}
		this.d_anchor 
			.attr('x1',this.settings.currX)
			.attr('x2',this.settings.currX)
			.attr('y1',y1)
			.attr('y2',y2)
	}

	renderR() {
		if (!['synced','r'].includes(this.anchorType)) return
		this.r_anchor = this.g_anchor.append('line')
		const o = this.opts 
		this.updateR(o.axiswidth+o.sp, o.sample2height+o.sp)
	}

	updateR(x1,x2) {
		if (!['synced','r'].includes(this.anchorType)) return
		this.settings.R = {x1,x2}
		this.r_anchor 
			.attr('x1',x1)
			.attr('x2',x2)
			.attr('y1',this.settings.currY)
			.attr('y2',this.settings.currY)
	}

	renderX() {
		if (!['synced','x'].includes(this.anchorType)) return
		this.x_anchor = this.g_anchor.append('g')
			.attr('transform','translate('+this.settings.currX+','+this.settings.currY+')')
		this.bindXDrag()

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

	bindXDrag() {
		if (!['synced'].includes(this.anchorType)) return
		this.x_anchor
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
					if (_x==this.settings.currX && _y==this.settings.currY) {
						this.g_anchor.remove()
						return
					}

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
				.on('mouseleave',()=>{
					this.x_anchor.on('mousemove',null)
				})
			})
	}
}
