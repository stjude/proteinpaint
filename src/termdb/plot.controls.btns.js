import { getInitFxn } from '../common/rx.core'

class TdbControlsTopBar {
	constructor(opts) {
		this.dom = {
			holder: opts.holder,
			burger_div: opts.holder.append('div'),
			button_bar: opts.holder.append('div')
		}

		this.features = {
			burgerbtn: burgerBtnInit({
				holder: this.dom.burger_div,
				callback: opts.callback
			})
			/*svgbtn: svgBtnInit({
				id: opts.id,
				holder: this.dom.button_bar.append('div'),
				callback: () => console.log('TODO: download callback')
			}),
			infobtn: infoBtnInit({
				id: opts.id,
				holder: this.dom.button_bar.append('div'),
				callback: () => console.log('TODO: infobtn callback')
			})*/
		}
	}

	main(state, isOpen) {
		this.dom.button_bar.style('display', isOpen ? 'inline-block' : 'block').style('float', isOpen ? 'right' : 'none')
		if (!state) return
		const plot = state.config
		for (const name in this.features) {
			this.features[name].main(isOpen, plot)
		}
	}
}

export const topBarInit = getInitFxn(TdbControlsTopBar)

function setInteractivity(self) {
	self.toggleVisibility = isVisible => {
		self.isVisible = isVisible
		self.main()
	}
}

function burgerBtnInit(opts) {
	const self = {
		dom: {
			btn: opts.holder
				.style('margin', '10px')
				.style('margin-left', '20px')
				.style('font-family', 'verdana')
				.style('font-size', '28px')
				.style('cursor', 'pointer')
				.style('transition', '0.5s')
				.html('&#8801;')
				.on('click', opts.callback)
		}
	}

	const api = {
		main(isOpen) {
			self.dom.btn.style('display', isOpen ? 'inline-block' : 'block')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function svgBtnInit(opts) {
	const self = {
		plotTypes: ['barchart', 'boxplot', 'scatter'],
		dom: {
			btn: opts.holder
				.style('margin', '10px')
				.style('margin-top', '15px')
				.style('margin-left', '24px')
				.style('font-family', 'verdana')
				.style('font-size', '18px')
				.style('cursor', 'pointer')
				.html('&#10515;')
				.on('click', opts.callback)
		}
	}

	const api = {
		main(isOpen, plot) {
			self.dom.btn.style('display', isOpen ? 'inline-block' : 'block')

			//show tip info for download button based on visible plot/table
			const currviews = plot.settings.currViews
			if (self.plotTypes.some(view => currviews.includes(view))) {
				self.dom.btn.attr('title', 'Download plot image')
			} else if (currviews.includes('table')) {
				self.dom.btn.attr('title', 'Download table data')
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function infoBtnInit(app, opts, controls) {
	const self = {
		table_flag: false,
		dom: {
			btn: opts.holder
				// TO-DO: put the conditional display back in using app.getState()
				.style('display', 'none') //controls.plot.term && controls.plot.term.term.hashtmldetail ? "inline-block" : "none")
				.style('margin', '10px')
				.style('font-family', 'verdana')
				.style('font-size', '18px')
				.style('font-weight', 'bold')
				.style('cursor', 'pointer')
				.attr('title', 'Grade Details')
				.html('&#9432;')
				.on('click', self.displayInfo)
		},
		async displayInfo() {
			let info_div

			if (!self.table_flag) {
				//query server for term_info
				const args = [
					'genome=' +
						controls.plot.obj.genome.name +
						'&dslabel=' +
						controls.plot.obj.mds.label +
						'&getterminfo=1&tid=' +
						controls.plot.term.term.id
				]
				let data
				try {
					data = await client.dofetch2('/termdb?' + args.join('&'))
					if (data.error) throw data.error
				} catch (e) {
					window.alert(e.message || e)
				}

				//create term_info table
				info_div = controls.plot.dom.viz
					.append('div')
					.attr('class', 'term_info_div')
					.style('width', '80vh')
					.style('padding-bottom', '20px')
					.style('display', 'block')
					.append('table')
					.style('white-space', 'normal')
					.append('tbody')

				self.make_table(info_div, data)
			} else {
				info_div = controls.plot.dom.viz.selectAll('.term_info_div')
			}

			//display term_info under the plot
			info_div.style('display', info_div.style('display') == 'block' ? 'none' : 'block')
		},
		// populate table for term_info when info button clicked
		make_table(info_div, data) {
			self.table_flag = true

			for (let s of data.terminfo.src) {
				const source_td = info_div
					.append('tr')
					.append('td')
					.style('padding', '5px 0')

				source_td
					.append('div')
					.style('font-weight', 'bold')
					.text('Source')

				source_td
					.append('div')
					.style('margin-left', '20px')
					.text(s.pub)

				source_td
					.append('div')
					.style('margin-left', '20px')
					.html(s.title + ':&nbsp;<i>' + s.section + '</i>')
			}

			const grade_td = info_div
				.append('tr')
				.append('td')
				.style('padding', '5px 0')
				.append('div')
				.style('font-weight', 'bold')
				.text('Grading Rubric')
				.append('ol')
				.style('margin', '0px')

			for (let grade of data.terminfo.rubric) {
				grade_td
					.append('li')
					.style('font-weight', 'normal')
					.text(grade)
			}
		}
	}

	const api = {
		main(isOpen, plot) {
			if (plot.term && plot.term.term.hashtmldetail) {
				info_btn
					.style('display', isOpen ? 'inline-block' : 'block')
					.style('margin-top', isOpen ? '15px' : '20px')
					.style('margin-right', isOpen ? '15px' : '10px')
					.style('margin-left', isOpen ? '15px' : '24px')
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}
