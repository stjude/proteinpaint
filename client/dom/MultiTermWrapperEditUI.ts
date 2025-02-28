import type { TermWrapper } from '#types'
import type { MassAppApi, MassState } from '#mass/types/mass'
import { termsettingInit } from '#termsetting'
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
	}

	async renderUI() {
		this.dom.header.style('font-style', 'italic').style('opacity', 0.7).text(this.headerText)

		this.dom.submitBtn.text(this.buttonLabel).on('click', () => {
			this.callback(this.twList)
		})

		this.update()
	}

	async update() {
		this.dom.tws.selectAll('div').remove()
		const twListCopy = this.twList.slice()

		if (twListCopy.length < this.maxNum) {
			/** Insert a blank tw to trigger a new termsetting init
			 * until limit is reached */
			twListCopy.push({ id: Math.random().toString() } as any)
		}

		for (const tw of twListCopy) {
			const div = this.dom.tws.append('div').style('display', 'inline-block').style('margin-right', '5px')
			const pill = await this.getNewPill(div)
			this.renderTerm(tw, pill)
		}
	}

	async getNewPill(div) {
		const _opts = {
			abbrCutoff: 50,
			//Do not allow users to select the same term more than once
			disable_terms: this.twList.map(tw => tw.term.id),
			holder: div,
			menuLayout: 'horizontal',
			placeholder: 'Add term',
			vocabApi: this.app.vocabApi,
			numericEditMenuVersion: ['continuous', 'discrete'],
			callback: (tw: TermWrapper) => {
				this.twList.push(tw)
				this.update()
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

	async renderTerm(tw, pill) {
		const pillOps = {
			term: tw.term,
			q: tw.q
		} as any
		if (this.state) {
			pillOps.activeCohort = this.state.activeCohort
			pillOps.filter = this.state?.termfilter?.filter
		}
		await pill.main(pillOps)
	}
}
