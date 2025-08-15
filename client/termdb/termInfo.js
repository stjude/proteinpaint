import { getCompInit, getInitFxn, copyMerge } from '../rx'

const defaultState = { isVisible: false, term: null }

class TdbTermInfo {
	/*
		Will display background information about a term, 
		such as rubric, publication source, description, etc

		opts{}
			.content_holder: required d3-wrapped DOM element
				****TODO: Create menu on the fly if content_holder is not supplied****
			
			.icon_holder: optional, creates information icon for terms
			
			.vocabApi: 
				- for termInfoInit(), required as opts.vocabApi
				- for termInfoComp(), required as part of opts.app
				- a vocabulary API that has a getTermInfo() method
			
			.state{} optional, see defaultState value above
				.isVisible: boolean, optional
				.term: {id, ...} optional (may be supplied with either getState() or main({state}))
	*/
	constructor(opts) {
		this.vocabApi = opts.vocabApi || (opts.app && opts.app.vocabApi)
		this.state = Object.assign({}, defaultState, opts.state ? opts.state : {})
		this.api = this
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

function setRenderers(self) {
	self.initUI = function (opts) {
		self.dom = {
			content_holder: opts.content_holder
				.style('margin-left', '25px')
				.attr('class', 'term_info_div')
				.style('display', self.state.isVisible ? 'block' : 'none')
				//.style('width', '100vh')
				.style('white-space', 'normal')
				.style('padding-bottom', '20px'),

			//Term information/description
			details: opts.content_holder.append('div'),

			tbody: opts.content_holder.append('table').append('tbody'),

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
				.attr('aria-label', 'Term Information')
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

	self.render = function (data) {
		if (!data?.terminfo) {
			// guard against invalid data returned by server
			self.dom.details.append('div').style('margin-top', '10px').text('No definition found.')
			return
		}
		self.dom.tbody.selectAll('*').remove()
		if (data.terminfo.src) {
			for (let s of data.terminfo.src) {
				const source_td = self.dom.tbody.append('tr').append('td').style('padding', '5px 0')

				source_td.append('div').style('font-weight', 'bold').text('Source')

				source_td.append('div').style('margin-left', '20px').text(s.pub)

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
				grade_td.append('li').style('font-weight', 'normal').text(grade)
			}
		}
		//Term information/description
		self.dom.details.selectAll('*').remove()
		if (data.terminfo.description) {
			const header = self.dom.details
				.append('div')
				.style('padding-top', '20px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text('Description')
			for (const d of data.terminfo.description) {
				self.renderDetail(d, self.dom.details.append('div').style('padding-bottom', '3px'))
			}
		}
	}

	self.renderDetail = function (d, div) {
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
	self.toggleDescription = function () {
		self.state.isVisible = !self.state.isVisible
		self.main({ isVisible: self.state.isVisible })
	}
}
