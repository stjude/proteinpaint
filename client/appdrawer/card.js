import { getInitFxn } from '../rx'
import { rgb } from 'd3-color'
import { openSandbox } from './adSandbox'
import { event } from 'd3-selection'

class AppDrawerCard {
	// handles types 'card' and 'nestedCard'
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.holder = opts.holder
		this.pageArgs = opts.pageArgs
		setInteractivity(this)
		setRenderers(this)
		this.initCard()
	}

	validateOpts(opts) {
		if (!opts.element.name) throw `Card .name is missing`
		if (!opts.element.section) throw `.section is missing for card=${opts.element.name}`
		if (opts.element.type == 'card') {
			if (!opts.element.sandboxJson && !opts.element.sandboxHtml)
				throw `Either .sandboxJson or .sandboxHtml is missing for card=${opts.element.name}`
		}
		if (opts.element.type == 'nestedCard') {
			if (!opts.element.children || opts.element.children.length == 0)
				throw `Missing .children for nested card = ${opts.element.name}`
		}
		if (opts.element.flag) {
			if (!opts.element.flag.text) throw `Missing flag .text for ${opts.element.type} = ${opts.element.name}`

			//ProteinPaint app drawer specific validation
			if (
				(opts.element.flag.text.toUpperCase() == 'NEW' || opts.element.flag.text.toUpperCase() == 'UPDATED') &&
				!opts.element.flag.expireDate
			)
				throw `${opts.element.type} = ${
					opts.element.name
				} flag is ${opts.element.flag.text.toUpperCase()} but .expireDate is missing. Please provide`

			if (opts.element.flag.expireDate) {
				if (opts.element.flag.expireDate >= 0) {
					throw `Flag for ${opts.element.type} = ${opts.element.name} is not a valid date`
				} //TODO add validation for format?
			}
		}
		return opts
	}
}

export const cardInit = getInitFxn(AppDrawerCard)

function setRenderers(self) {
	self.initCard = function() {
		const card = self.holder.append('li')
		if (self.opts.element.type == 'card') {
			card
				.classed('sjpp-track', true)
				/*TODO: 
                1. optional non image card layout
                2. responsiveness of image on window resize 
                    - expand image size on resize
                    - non square, take better use of space
                    - solve problem of cards 'stretching' when only one is available
                */
				.html(
					`<div class="sjpp-track-h"><span style="font-size:14.5px;font-weight:500;">${
						self.opts.element.name
					}</span></div>
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

		self.makeRibbon = function(flag) {
			//only relevant for 'card', not 'nestedCard'
			const ribbon = card
				.append('div')
				.classed('sjpp-app-drawer-card-ribbon', true)
				.style('align-items', 'center')
				.style('justify-content', 'center')

			//*********TODO: move from diagonal to straight on right side */
			const text = flag.text.toUpperCase()
			//Enfore color palette for proteinpaint homepage flags
			const color =
				text == 'BETA'
					? '#418cb5'
					: text == 'NEW'
					? '#1ba176'
					: text == 'UPDATED'
					? 'orange'
					: flag.color
					? flag.color
					: 'red'

			ribbon
				.append('span')
				.text(text) // Need fn in utils to decide black or white text in utils.js
				.style('color', 'white')
				.style('background-color', rgb(color).darker()) // May remove with contrast fn (??)
				.style('height', 'auto')
				.style('width', '100%')
				.style('top', '15%')
				.style('left', '-30%')
				.style('font-size', '11.5px')
				.style('text-transform', 'uppercase')
				.style('text-align', 'center')
		}

		if (self.opts.element.flag) {
			const today = new Date()
			self.opts.element.flagExpireDate = new Date(self.opts.element.flag.expireDate)
			//Allows flags to expire or appear indefinitely
			if (self.opts.element.flagExpireDate > today || self.opts.element.flag.expireDate == undefined)
				self.makeRibbon(self.opts.element.flag)
		}

		card.on('click', async () => {
			event.stopPropagation()
			self.opts.pageArgs.apps_off()
			await openSandbox(self.opts.element, self.opts.pageArgs)
		})
	}
}

function setInteractivity(self) {}
