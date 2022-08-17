import { getInitFxn } from '../rx'
import { rgb } from 'd3-color'
import { openSandbox } from './ad.sandbox'

class AppDrawerCard {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.holder = opts.holder
		setInteractivity(this)
		setRenderers(this)
	}

	validateOpts(opts) {
		if (!opts.element.name) throw `Card name is missing`
		if (!opts.element.section) throw `.section is missing for card=${opts.element.name}`
		if (opts.element.type == 'card') {
			if (!opts.element.sandboxJson && !opts.element.sandboxHtml)
				throw `Either .sandboxJson or .sandboxHtml is missing for card=${opts.element.name}`
		}
		if (opts.element.type == 'nestedCard') {
			if (!opts.element.children) throw `Missing .children for nested card = ${opts.element.name}`
		}

		return opts
	}
}

export const cardInit = getInitFxn(AppDrawerCard)

function setInteractivity(self) {}

function setRenderers(self) {
	const card = self.holder.append('li')
	//TODO solve problem of cards 'stretching' when only on is available.
	if (self.opts.element.type == 'card') {
		card.classed('sjpp-track', true).html(
			`<div class="sjpp-track-h"><span style="font-size:14.5px;font-weight:500;">${self.opts.element.name}</span></div>
                ${
									self.opts.element.description
										? `<span class="sjpp-track-blurb" style="cursor:default">${self.opts.element.description}</span></div>`
										: ''
								}
                <span class="sjpp-track-image"><img src="${self.opts.element.image}" alt="${
				self.opts.element.description
			}"></img></span>
                </div>`
		)
	} else if (self.opts.element.type == 'nestedCard') {
		card.classed('sjpp-app-drawer-card', true).html(
			`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">${self.opts.element.name}</p>
            <p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">${self.opts.element.description}</p>`
		)
	}

	self.makeRibbon = function(card, text, color) {
		const ribbonDiv = card
			.append('div')
			.classed('sjpp-app-drawer-card-ribbon', true)
			.style('align-items', 'center')
			.style('justify-content', 'center')

		//*********TODO: move from diagonal to straight on right side */
		ribbonDiv
			.append('span')
			.text(text)
			.style('color', 'white')
			.style('background-color', rgb(color).darker())
			.style('height', 'auto')
			.style('width', '100%')
			.style('top', '15%')
			.style('left', '-30%')
			.style('font-size', '11.5px')
			.style('text-align', 'center')
	}

	self.opts.element.isBeta == true ? self.makeRibbon(card, 'BETA', '#418cb5') : ''

	if (self.opts.element.updateFlagExpireDate || self.opts.element.newFlagExpireDate) {
		const today = new Date()
		const update = new Date(self.opts.element.updateFlagExpireDate)
		const newtrack = new Date(self.opts.element.newFlagExpireDate)

		if (update > today) self.makeRibbon(card, 'UPDATED', 'orange')
		if (newtrack > today) self.makeRibbon(card, 'NEW', '#1ba176')
	}
}
