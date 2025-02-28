import type { TermWrapper } from '#types'
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
		const _opts = {
			abbrCutoff: 50,
			//Do not allow users to select the same term more than once
			disable_terms: this.twList.map(tw => tw.term.id),
			holder: div,
			placeholder: 'Add term',
			menuOptions: '!replace',
			vocabApi: this.app.vocabApi,
			numericEditMenuVersion: ['continuous', 'discrete'],
			callback: (tw: any) => {
				const idx = this.twList.findIndex(t => t.$id === d.$id)
				if (!tw?.term) {
					this.twList.splice(idx, 1)
				} else if (idx == -1) {
					tw.$id = d.$id
					this.twList.push(tw)
				} else this.twList[idx] = tw
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

	async renderTerm(tw) {
		if (!tw?.pill) return
		const pillOps = {
			term: tw.term,
			q: tw.q
		} as any
		if (this.state) {
			pillOps.activeCohort = this.state.activeCohort
			pillOps.filter = this.state?.termfilter?.filter
		}
		await tw.pill.main(pillOps)
	}
}

function setRenderers(self) {
	self.update = () => {
		self.dom.tws.selectAll('div').remove()
		const twListCopy = self.twList.slice()

		if (twListCopy.length < self.maxNum) {
			/** Insert a blank tw to trigger a new termsetting init
			 * until limit is reached */
			twListCopy.push({ tw: { $id: Math.random().toString() } } as any)
		}
		const tws = self.dom.tws.selectAll(':scope>.sjpp-edit-ui-pill').data(twListCopy, tw => tw.tw?.$id)
		tws.exit().remove()
		tws.each(self.renderTerm)
		tws.enter().append('div').attr('class', 'sjpp-edit-ui-pill').each(self.addTerm)
	}

	self.addTerm = async function (tw) {
		const div = select(this)
		tw.pill = await self.getNewPill(tw, div)
		self.renderTerm(tw)
	}
}
