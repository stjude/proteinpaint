import { select } from 'd3-selection'

/*
----EXPORTED----
class BreadcrumbTrail
.opts {
    holder: STR
		required
    crumbs: [{}, {}, ...]
		.label
			required
		.callback
			optional
}


Intended for attribute breadcrumb trail in sandbox header but designed 
for other holders and possible path based trail. 

*/

export class BreadcrumbTrail {
	constructor(opts) {
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			trailDiv: opts.trailDiv || opts.holder.append('div')
		}
		setRenderers(this)
	}

	async main(opts = {}) {
		try {
			return await this.render()
		} catch (e) {
			if (e.stack) console.log(e.stack)
			else throw e
		}
	}
}

function setRenderers(self) {
	self.render = async () => {
		self.crumbs = self.opts.crumbs
		for (const crumb of self.crumbs) {
			crumb.label = crumb.label || crumb.name
		}

		const has_active_crumb = self.crumbs.find(crumb => crumb.inTrail)
		if (!has_active_crumb) self.crumbs[0].inTrail = true

		await self.dom.trailDiv
			.style('margin-left', '5px')
			.style('font-size', '.75em')
			.style('display', 'inline-block')
			.classed('sjpp-breadcrumb-trail', true)
			.selectAll('span')
			.data(self.crumbs)
			.enter()
			.append('span')
			.classed('sjpp-breadcrumb', true)
			.html(crumb => (crumb.link ? `&nbsp> <a href="${crumb.link}">${crumb.label}</a>` : `&nbsp> ${crumb.label}`))
			.style('display', crumb => (crumb.inTrail ? 'inline-block' : 'none'))
			.each(async function (crumb) {
				if (!crumb.inTrail) crumb.inTrail = false
				crumb.div = select(this)
				console.log(crumb)
			})

		const activeCrumbIndex = self.crumbs.findIndex(c => c.active)
		self.update(activeCrumbIndex)
	}

	self.update = (crumbIndex = 0) => {
		self.crumbs.forEach((crumb, i) => {
			/*TODO: Assumes only one breadcrumb in header. 
			Will need to accommodate longer trails.*/
			crumb.inTrail = crumbIndex === i
		})
		self.dom.trailDiv
			.selectAll('span')
			.data(self.crumbs)
			.each(async crumb => {
				crumb.div.style('display', crumb.inTrail ? 'inline-block' : 'none')
			})
	}
}
