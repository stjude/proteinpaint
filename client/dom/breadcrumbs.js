import { sayerror } from '#dom/error'

/*
----EXPORTED----
class BreadcrumbTrail
.opts {
    holder: STR
    crumbs: [{}, {}, ...] - must include .label or .name in object
    crumbsCallback: f => {callback applied to every crumb/link for click events}
}


Intended for attribute breadcrumb trail in sandbox header but designed 
for other holders and possible path based trail. 

*/

export class BreadcrumbTrail {
	constructor(opts) {
		this.opts = opts
		this.dom = {
			holder: opts.holder
		}
		setInteractivity(this)
		setRenderers(this)
	}

	async main() {
		this.breadcrumbs = this.opts.crumbs
		try {
			for (const [i, crumb] of this.breadcrumbs.entries()) {
				crumb.inTrail = false
				if (this.opts.crumbsCallback) crumb.callback = this.opts.crumbsCallback
			}
			this.render()
		} catch (e) {
			if (e.stack) console.log(e.stack)
			else throw e
		}
	}
}

function setRenderers(self) {
	const trailDiv = self.dom.holder.append('div')
	self.render = () => {
		trailDiv
			.style('margin-left', '5px')
			.style('font-size', '.75em')
			.style('display', 'inline-block')
			.classed('sjpp-sandbox-breadcrumb-trail', true)
			.selectAll('span')
			.data(self.breadcrumbs)
			.enter()
			.append('span')
			// .append(d => (d.callback ? 'a' : 'span'))
			.text(d => ` > ${d.label}`)
			.style('display', d => (d.inTrail ? 'inline-block' : 'none'))
		// .on('click', (event, d) => {
		//     if (d.callback) d.callback()
		//     else if (d.inTrail == true) self.removeCrumb(d)
		// })
	}

	self.updateTrail = () => {
		trailDiv.selectAll('span').remove()
		trailDiv
			.selectAll('span')
			.data(self.breadcrumbs)
			.enter()
			.append('span')
			.text(d => ` > ${d.label}`)
			.style('display', d => (d.inTrail ? 'inline-block' : 'none'))
	}
}

function setInteractivity(self) {
	self.addCrumb = crumb => {
		const foundCrumb = crumb.label
			? self.breadcrumbs.find(c => c.label == crumb.label)
			: self.breadcrumbs.find(c => c.label == crumb.name)
		if (typeof foundCrumb == 'object') foundCrumb.inTrail = true
		else
			self.breadcrumbs.push({
				inTrail: true,
				label: crumb.label || crumb.name
			})
	}

	self.removeCrumb = crumb => {
		const foundCrumb = crumb.label
			? self.breadcrumbs.find(c => c.label == crumb.label)
			: self.breadcrumbs.find(c => c.label == crumb.name)
		if (typeof foundCrumb == 'object') foundCrumb.inTrail = false
	}
}
