import { getCompInit, getInitFxn, copyMerge } from '../common/rx.core'
import { dofetch3 } from '../client'

const defaultState = { isVisible: false, term: null }

class TdbTermInfo {
	/*
		Will display background information about a term, 
		such as rubric, publication source, description, etc

		opts{}
			.holder: required d3-wrapped DOM element
			.vocabApi: required vocabulary API with a getTermInfo() method
			.state{} optional, see defaultState value above
				.isVisible: boolean, optional
				.term: {id, ...} optional (may be supplied with either getState() or main({state}))
	*/
	constructor(opts) {
		this.vocabApi = opts.vocabApi || (opts.app && opts.app.vocabApi)
		this.state = Object.assign({}, defaultState, opts.state ? opts.state : {})
		this.dom = {
			holder: opts.holder.style('display', 'none').style('margin-left', '25px')
		}
		this.api = this
		setRenderers(this)
		this.initUI()
	}

	/*
		state: replace 1 or more state values by attribute key
	*/
	async main(state = {}) {
		copyMerge(this.state, state)

		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'block')
		const data = await this.vocabApi.getTermInfo(this.state.term.id)
		this.render(data)
	}
}

export const termInfoInit = getInitFxn(TdbTermInfo)

/* 
	rx-pluggable version: 
	- extend a class instead of using a parent wrapper component
	- reference in parentComponent.components for this to get notified of state changes,
	- the parentComponent does NOT have to call termInfoInstance.main(...)
	- rx will automatically detect if this component needs to update/rerender
*/
class TdbTermInfoComp extends TdbTermInfo {
	/*
	opts:
		same as the constructor opts plus these attributes
		.id: INT
			- optional, to be used to get this component's state
	*/
	constructor(opts) {
		super(opts)
		this.type = 'termInfo'
		this.mainArg = 'state'
	}

	getState(appState) {
		const config = appState.infos[this.id]
		return {
			isVisible: config && config.isVisible,
			term: config && config.term
		}
	}
}

export const termInfoComp = getCompInit(TdbTermInfoComp)

function setRenderers(self) {
	self.initUI = function() {
		self.dom.holder
			.attr('class', 'term_info_div')
			.style('display', self.state.isVisible ? 'block' : 'none')
			.style('width', '80vh')
			.style('padding-bottom', '20px')

		self.dom.tbody = self.dom.holder
			.append('table')
			.style('white-space', 'normal')
			.append('tbody')

		self.dom.addlInfo = self.dom.holder.append('div')
	}

	self.render = function(data) {
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
				.style('padding-top', '30px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text('Description')
			for (const d of data.terminfo.description) {
				self.renderDetail(d, self.dom.addlInfo.append('div').style('padding-bottom', '3px'))
			}
			self.dom.addlInfo.append('div').style('padding-bottom', '20px')
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
