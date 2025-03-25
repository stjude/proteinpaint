import type { TermWrapper, Term } from '#types'
import type { MassAppApi, MassState } from '#mass/types/mass'
import { termsettingInit } from '#termsetting'
import { select } from 'd3-selection'
import type { MultiTermWrapperDom, MultiTermWrapperUIOpts } from './types/MultiTermWrapperEditUI'

/** Creates a UI for users to select pills and edit the term
 * before submitting or dispatching an action.
 *
 * If editing the pill is not needed, use termdb.appInit() instead.
 *
 * The caller is responsible for handling the returned terms.
 * (i.e. any app actions). */
export class MultiTermWrapperEditUI {
	readonly type = 'multiTermEditUI'
	app: MassAppApi
	buttonLabel: string
	callback: (terms: any) => void
	customInputs?: object
	disable_terms: Term[]
	dom: MultiTermWrapperDom
	headerText: string
	maxNum: number
	state?: MassState
	twList: TermWrapper[]
	update: any
	constructor(opts: MultiTermWrapperUIOpts) {
		this.app = opts.app
		this.callback = opts.callback
		const holder = opts.holder.attr('data-testid', 'sjpp-multi-tw-edit-ui')
		const header = holder
			.append('div')
			.attr('data-testid', 'sjpp-edit-ui-header')
			.style('display', 'block')
			.style('padding', '10px')
		const tws = holder.append('div').style('display', 'block').style('margin-left', '10px')
		const submitDiv = holder
			.append('div')
			.attr('data-testid', 'sjpp-edit-ui-submit')
			.style('display', 'block')
			.style('padding', '10px')
			.style('margin-left', '5px')
		this.dom = {
			holder,
			header,
			tws,
			submitBtn: submitDiv.append('button').style('display', 'inline-block'),
			footer: submitDiv
				.append('div')
				.attr('data-testid', 'sjpp-edit-ui-footer')
				.style('display', 'inline-block')
				.style('margin-left', '10px')
		}
		this.twList = opts.twList || []
		this.buttonLabel = opts.buttonLabel || 'Submit'
		this.maxNum = opts.maxNum || Infinity
		this.headerText = opts.headerText || ''
		this.customInputs = opts.customInputs || {}
		this.disable_terms = opts.disable_terms || []
		if (opts.state) this.state = opts.state

		setRenderers(this)
	}

	async renderUI() {
		this.dom.header.style('font-style', 'italic').style('opacity', 0.7).text(this.headerText)

		this.dom.submitBtn.text(this.buttonLabel).on('click', () => {
			this.callback(this.twList)
		})

		this.update(this)
	}

	async getNewPill(d, div) {
		//Do not allow users to select the same term more than once
		//Combine with specified disable_terms from the caller
		const disable_terms = [...this.disable_terms, ...this.twList.map(tw => tw.term)]
		const _opts = {
			abbrCutoff: 50,
			debug: this.app.opts?.debug,
			disable_terms,
			genomeObj: this.app.opts.genome,
			holder: div,
			menuOptions: '!replace',
			numericEditMenuVersion: ['continuous', 'discrete'],
			placeholder: 'Add term',
			vocabApi: this.app.vocabApi,
			callback: (tw: any) => {
				/** Make a copy of the twList. When the edit UI is opened
				 * with a list of terms, the object is sealed.*/
				const twListCopy = this.twList.slice(0)
				const idx = twListCopy.findIndex(t => t.$id === d.tw.$id)
				if (idx !== -1 && !tw?.term) {
					twListCopy.splice(idx, 1)
				} else if (idx == -1) {
					tw.$id = d.tw.$id
					twListCopy.push(tw)
				} else twListCopy[idx] = tw
				this.twList = twListCopy
				this.update(this)
			}
		} as any

		if (this.state) {
			_opts.activeCohort = this.state.activeCohort
		}

		if (this.app.opts?.genome) {
			_opts.genomeObj = this.app.opts.genome
		}
		const termsettingOpts = Object.assign({}, _opts, this.customInputs)
		const pill = await termsettingInit(termsettingOpts)
		return pill
	}

	async renderTerm(d, numericOpts = false) {
		if (!d?.pill) return
		const pillOps = this.getPillOpts(d, numericOpts)
		await d.pill.main(pillOps)
	}

	getPillOpts(d, numericOpts) {
		const pillOps: any = {
			term: d.tw.term,
			q: d.tw.q
		}
		if (d.tw.$id) pillOps.$id = d.tw.$id
		if (this.state) {
			pillOps.activeCohort = this.state.activeCohort
			pillOps.filter = this.state?.termfilter?.filter
		}
		if (numericOpts) {
			pillOps.numericEditMenuVersion = ['continuous', 'discrete']
		}
		return pillOps
	}
}

function setRenderers(self) {
	self.update = () => {
		self.dom.tws.selectAll('div').remove()
		const twListCopy = self.twList.map(tw => {
			return { tw }
		})

		if (twListCopy.length < self.maxNum) {
			/** Insert a blank tw to trigger a new termsetting init
			 * until limit is reached */
			twListCopy.push({ tw: { $id: Math.random().toString() } } as any)
		}
		const tws = self.dom.tws.selectAll(':scope>.sjpp-edit-ui-pill').data(twListCopy, d => d.tw?.$id)
		tws.exit().remove()
		tws.each(self.renderTerm)
		tws.enter().append('div').attr('class', 'sjpp-edit-ui-pill').each(self.addTerm)

		self.dom.submitBtn.property('disabled', self.twList.length == 0)
		self.dom.footer.text(`${self.twList.length} terms selected`)
	}

	self.addTerm = async function (d) {
		const div = select(this)
		d.pill = await self.getNewPill(d, div)
		self.renderTerm(d, true)
	}
}
