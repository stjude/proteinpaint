import { getCompInit, getInitFxn, copyMerge } from '../common/rx.core'
import { dofetch3 } from '../client'

const defaultState = { isVisible: false, term: null }

export class TdbTermInfo {
	/*
		Will display background information about a term, 
		such as rubric, publication source, description, etc

		opts{}
			.id: INT optional
			.holder: required d3-wrapped DOM element
			.vocabApi: required vocabulary API with a getTermInfo() method
			.state{} optional
				.isVisible: boolean, optional
				.term: {id, ...} optional (may be supplied with either getState() or main({state}))
	*/
	constructor(opts) {
		this.vocabApi = opts.vocabApi || (opts.app && opts.app.vocabApi)
		this.app = opts.app
		this.id = opts.id
		this.type = 'termInfo'
		this.dom = {
			holder: opts.holder.style('margin-left', '25px')
		}
		this.state = Object.assign({}, defaultState, opts.state ? opts.state : {})
		this.api = this
		setRenderers(this)
		this.initUI()
	}

	// if "plugged" into the rx-framework, the app.dispatch will call this
	getState(appState) {
		const config = appState.infos[this.id]
		return {
			isVisible: config && config.isVisible,
			term: config && config.term
		}
	}

	async main(updates = {}) {
		// when this component is used "unplugged" (outside of the rx framework),
		// the parent component must supply an updates.state argument
		if (updates && updates.state) copyMerge(this.state, updates.state)

		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'block')
		const data = await this.vocabApi.getTermInfo(this.state.term.id)
		this.render(data)
	}
}

export const termInfoInit = getCompInit(TdbTermInfo)
export const termInfoUnplugged = getInitFxn(TdbTermInfo)

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

		self.dom.addlInfo = self.dom.holder.append('div')
	}

	self.render = function(data) {
		if (self.state.term.id === 'PGS000001 (MAF>1%)') console.log(56)
		self.dom.tbody.selectAll('*').remove()
		if (data.terminfo.src) {
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
		}

		if (data.terminfo.rubric) {
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

		self.dom.addlInfo.selectAll('*').remove()
		if (data.terminfo.description) {
			const header = self.dom.addlInfo
				.append('div')
				.style('padding-top', '40px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text('Description')
			for (const d of data.terminfo.description) {
				self.renderDetail(d, self.dom.addlInfo.append('div').style('padding-bottom', '3px'))
			}
			self.dom.holder.append('div').style('padding-bottom', '20px')
		}
	}

	self.renderDetail = function(d, div) {
		if (Array.isArray(d.value)) {
			div.append('span').html('<i>' + d.label + '</i>')
			const section = div.append('div').style('padding-left', '20px')
			for (const v of d.value) {
				v.label = '- ' + v.label
				self.renderDetail(v, section.append('div'))
			}
		} else {
			div.html('<i>' + d.label + ':' + '</i>' + '&nbsp;' + d.value)
		}
	}
}
