import * as rx from '../common/rx.core'
import { dofetch3 } from '../client'

class TdbTermInfo {
	constructor(app, opts) {
		this.type = 'termInfo'
		this.id = opts.id
		this.app = app
		this.api = rx.getComponentApi(this)
		this.dom = {
			holder: opts.holder
		}
		setRenderers(this)
		this.initUI()
	}

	getState(appState) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${sub.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const config = appState.tree.plots[this.id]
		return {
			isVisible: config.settings.termInfo.isVisible,
			term: config.term
		}
	}

	async main() {
		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'block')
		const data = await this.app.vocabApi.getTermInfo(this.state.term.id)
		this.render(data)
	}
}

export const termInfoInit = rx.getInitFxn(TdbTermInfo)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.holder
			.attr('class', 'term_info_div')
			.style('width', '80vh')
			.style('padding-bottom', '20px')
			.style('display', 'block')

		self.dom.tbody = self.dom.holder
			.append('table')
			.style('white-space', 'normal')
			.append('tbody')
	}

	self.render = function(data) {
		self.dom.tbody.selectAll('*').remove()
		for (let s of data.terminfo.src) {
			const source_td = self.dom.tbody
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

		const grade_td = self.dom.tbody
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
