import { getCompInit, getInitFxn, copyMerge } from '../common/rx.core'
import { dofetch3 } from '../client'

const defaultState = { isVisible: false, term: null }

class TdbTermInfo {
	/*
		Will display background information about a term, 
		such as rubric, publication source, description, etc

		opts{}
			.content_holder: required d3-wrapped DOM element
			.icon_holder: optional, creates information icon for terms
			.vocabApi: required vocabulary API with a getTermInfo() method
			.state{} optional, see defaultState value above
				.isVisible: boolean, optional
				.term: {id, ...} optional (may be supplied with either getState() or main({state}))
	*/
	constructor(opts) {
		this.vocabApi = opts.vocabApi || (opts.app && opts.app.vocabApi)
		;(this.state = Object.assign({}, defaultState, opts.state ? opts.state : {})), (this.api = this)
		setInteractivity(this)
		setRenderers(this)
		this.initUI(opts)
	}

	/*
		state: replace 1 or more state values by attribute key
	*/
	async main(state = {}) {
		copyMerge(this.state, state)
		this.dom.content_holder.style('display', this.state.isVisible ? 'block' : 'none')
		this.dom.icon_holder
			.style('background-color', this.state.isVisible ? 'darkgray' : 'transparent')
			.style('color', this.state.isVisible ? 'white' : '#797a7a')
		if (!this.state.isVisible) return
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
	self.initUI = function(opts) {
		self.dom = {
			content_holder: opts.content_holder
				.style('margin-left', '25px')
				.attr('class', 'term_info_div')
				.style('display', self.state.isVisible ? 'block' : 'none')
				.style('width', '80vh')
				.style('padding-bottom', '20px'),

			addlInfo: opts.content_holder.append('div'),

			tbody: opts.content_holder
				.append('table')
				.style('white-space', 'normal')
				.append('tbody'),

			//Information icon button div. Term description appears in content_holder
			icon_holder: opts.icon_holder
				.style('margin', '1px 0px 1px 5px')
				.style('padding', '2px 5px')
				.style('font-family', 'Times New Roman')
				.style('font-size', '14px')
				.style('font-weight', 'bold')
				.style('cursor', 'pointer')
				.style('background-color', 'transparent')
				.style('color', '#797a7a')
				.style('align-items', 'center')
				.style('justify-content', 'center')
				.style('border', 'none')
				.style('border-radius', '3px')
				.attr('title', 'Term Information')
				.html('&#9432;')
				.on('mouseenter', () => {
					if (self.state.isVisible == true) return
					self.dom.icon_holder.style('color', 'blue')
				})
				.on('mouseleave', () => {
					if (self.state.isVisible == true) return
					self.dom.icon_holder.style('color', '#797a7a')
				})
				.on('click', self.toggleDescription)
		}
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

function setInteractivity(self) {
	/*toggles the term description div by changing the state. The change in state triggers
	multiple style changes via .main*/
	self.toggleDescription = function() {
		self.state.isVisible = !self.state.isVisible
		self.main({ isVisible: self.state.isVisible })
	}
}
