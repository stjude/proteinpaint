import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type AppApi, type ComponentApi, type RxComponent } from '#rx'
import { capitalizeFirstLetter, icons } from '#dom'
import { appInit } from '../../termdb/app.js'
import { validatePlotConfig } from '../aggregateMatrix/AggregateMatrix.ts'
import { isNonDictionaryType } from '#shared/terms.js'
import {
	AggMatrixInputViewModel,
	getTerm,
	getTermSelectionKey
} from './viewModel/AggMatrixInputViewModel.ts'
import type { Section, SectionType } from './viewModel/AMIViewModelTypes.ts'

const chartType = 'aggMatrixInput'

type SectionView = {
	holder: any
	nameLabel: any
	nameInput: any
	displayName: any
	editButton: any
	termsHolder: any
	termdb?: AppApi
}

class AggMatrixInput extends PlotBase implements RxComponent {
	static type = chartType

	type: string
	config: any
	startOpt = '-- Select --'
	nextSectionViewId = 0
	sectionViews = new Map<string, SectionView>()
	viewModel = new AggMatrixInputViewModel()

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = AggMatrixInput.type

		//opts.header is the sandbox header
        if (opts.header) opts.header.text(`AGGREGATE MATRIX`).style('font-size', '0.9em')
	}

	getState(appState) {
		const config = appState.plots.find(plot => plot.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config, activeCohort: appState.activeCohort }
	}

	async init() {
		const wrapper = this.opts.holder
			.append('div')
			.style('padding', '10px')
			.attr('data-testid', 'sjpp-agg-matrix-input-wrapper')

		const axisWrapper = wrapper
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
			.style('gap', '12px')
			.style('margin-bottom', '10px')
		this.dom.sectionHolders = {}
		for (const [type, label] of [
			['row', 'Row'],
			['column', 'Column']
		] as [SectionType, string][]) {
			const axis = axisWrapper.append('div')
			const header = axis.append('div').style('border-bottom', '0.5px solid #ddd').style('padding', '5px')
			header.append('span').style('margin-right', '5px').text(`${label} sections:`)
			header
				.append('button')
				.attr('type', 'button')
				.attr('data-testid', 'sjpp-agg-matrix-add-section-btn')
				.style('border', 'none')
				.style('border-radius', '12px')
				.style('padding', '6px 10px')
				.style('background-color', '#cfe2f3')
				.text(`Add ${type} section`)
				.on('click', () => this.addSection(type))
			this.dom.sectionHolders[type] = axis.append('div')
		}

		this.dom.methodsHolder = wrapper.append('div').style('display', 'none')
		this.dom.methodSelects = {}
		for (const method of ['size', 'gradient']) {
			const methodKey = `${method}Method`
			const methodWrapper = this.dom.methodsHolder
				.append('div')
				.style('margin', '5px')
				.style('display', 'inline-flex')
				.style('align-items', 'center')
			methodWrapper
				.append('label')
				.attr('for', `sjpp-agg-matrix-${method}-method-select`)
				.style('margin-right', '5px')
				.text(`${capitalizeFirstLetter(method)} method:`)
			this.dom.methodSelects[methodKey] = methodWrapper
				.append('select')
				.attr('id', `sjpp-agg-matrix-${method}-method-select`)
				.attr('name', `sjpp-agg-matrix-${method}-method-select`)
				.on('change', event => {
					this.editConfig({ [methodKey]: event.target.value === this.startOpt ? '' : event.target.value })
				})
		}

		const submitWrapper = wrapper.append('div').style('margin-top', '12px')
		this.dom.submit = submitWrapper
			.append('button')
			.attr('data-testid', 'sjpp-agg-matrix-submit-btn')
			.attr('type', 'button')
			.property('disabled', true)
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '5px 10px')
			.style('font-size', '0.9em')
			.text('Submit')
			.on('click', () => this.submit())
		this.dom.validationMessage = submitWrapper
			.append('div')
			.attr('role', 'status')
			.style('color', '#b33')
			.style('font-size', '0.9em')
			.style('margin-top', '6px')
	}

	async main() {
		this.config = this.state.config

		await this.renderSections('row', this.config.rowSections || [])
		await this.renderSections('column', this.config.colSections || [])
		this.dom.methodsHolder.style('display', 'none')
		await this.viewModel.updateAvailableMethods(this.config, this.vocabApi, this.api?.getAbortSignal())
		if (this.viewModel.state.methodsStatus == 'ready') {
			this.renderMethodSelects()
			this.dom.methodsHolder.style('display', '')
		}

		const error = this.viewModel.getValidationError(this.config)
		const enabled = !error
		this.dom.submit.property('disabled', !enabled).style('cursor', enabled ? 'pointer' : 'default')
		this.dom.validationMessage.text(error || '')
	}

	renderMethodSelects() {
		for (const methodKey of ['sizeMethod', 'gradientMethod']) {
			const otherMethod = methodKey == 'sizeMethod' ? this.config.gradientMethod : this.config.sizeMethod
			this.dom.methodSelects[methodKey]
				.selectAll('option')
				.data([{ id: this.startOpt, label: this.startOpt }, ...this.viewModel.state.availableMethods], method => method.id)
				.join('option')
				.attr('value', method => method.id)
				.property('disabled', method => method.id != this.startOpt && method.id == otherMethod)
				.text(method => method.label)
			this.dom.methodSelects[methodKey].property('value', this.config[methodKey] || this.startOpt)
		}
	}

	async renderSections(type: SectionType, sections: Section[]) {
		const holder = this.dom.sectionHolders[type]
		for (const key of this.sectionViews.keys()) {
			const idx = Number(key.slice(type.length + 1))
			if (key.startsWith(`${type}:`) && idx >= sections.length) {
				this.destroySectionView(type, idx)
			}
		}

		for (const [idx, section] of sections.entries()) {
			const key = `${type}:${idx}`
			let view = this.sectionViews.get(key)
			if (!view) {
				view = await this.createSectionView(holder, type, idx, section)
				this.sectionViews.set(key, view)
			}
			const hasName = !!(section.name || '').trim()
			const termType = this.viewModel.getSectionTermType(section)
			const isDictionary = !!termType && !isNonDictionaryType(termType)
			view.nameLabel.style('display', isDictionary ? 'none' : '')
			view.nameInput
				.property('value', section.name)
				.attr('aria-invalid', hasName ? null : 'true')
				.attr('title', hasName ? null : 'A section name is required')
				.style('border-color', hasName ? null : '#c33')
				.style('display', isDictionary ? 'none' : '')
			view.displayName.style('display', isDictionary ? '' : 'none').text(section.name)
			view.editButton.style('display', isDictionary ? '' : 'none')
			view.holder
				.select('[data-testid="sjpp-agg-matrix-section-term-list"]')
				.selectAll('div')
				.data(section.terms || [], term => term.term?.id || term.id || term.term?.name || term.name)
				.join('div')
				.attr('data-testid', 'sjpp-agg-matrix-section-term')
				.style('margin', '5px')
				.text(term => term.term?.name || term.name || term.term?.id || term.id)
			view.termsHolder.style('display', isDictionary ? 'none' : '')
			holder.node().appendChild(view.holder.node())
		}
	}

	async createSectionView(holder, type: SectionType, idx: number, section: Section): Promise<SectionView> {
		const sectionHolder = holder
			.append('div')
			.attr('data-testid', `sjpp-agg-matrix-${type}-section`)
			.style('margin', '10px 0')
			.style('padding', '10px')
			.style('border', '1px solid #eee')
			.style('border-radius', '5px')
		const header = sectionHolder
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '5px')
		const nameId = `sjpp-agg-matrix-${type}-section-name-${this.nextSectionViewId++}`
		const nameLabel = header.append('label').attr('for', nameId).text('Section name *:')
		const nameInput = header
			.append('input')
			.attr('id', nameId)
			.attr('data-testid', 'sjpp-agg-matrix-section-name-input')
			.attr('type', 'text')
			.attr('required', true)
			.attr('aria-required', 'true')
			.attr('placeholder', 'Required')
			.on('change', event => this.updateSection(type, idx, { name: event.target.value }))
		const displayName = header.append('strong').style('display', 'none')
		const editButton = header
			.append('button')
			.attr('type', 'button')
			.attr('data-testid', 'sjpp-agg-matrix-edit-section-btn')
			.attr('aria-label', `Edit ${type} section`)
			.style('display', 'none')
			.style('border', 'none')
			.style('background', 'transparent')
			.style('padding', '3px')
		icons.pencil(editButton, {
			title: `Edit ${type} section`,
			handler: () => this.editSection(type, idx)
		})
		header
			.append('button')
			.attr('type', 'button')
			.attr('data-testid', 'sjpp-agg-matrix-remove-section-btn')
			.attr('aria-label', `Remove ${type} section`)
			.text('×')
			.on('click', () => this.removeSection(type, idx))

		sectionHolder.append('div').attr('data-testid', 'sjpp-agg-matrix-section-term-list').style('margin-left', '10px')
		const termsHolder = sectionHolder.append('div').attr('data-testid', 'sjpp-agg-matrix-section-terms')
		const view: SectionView = {
			holder: sectionHolder,
			nameLabel,
			nameInput,
			displayName,
			editButton,
			termsHolder
		}
		view.termdb = await appInit({
			holder: termsHolder,
			vocabApi: this.app.vocabApi,
			state: {
				activeCohort: this.state.activeCohort,
				selectedTerms: [],
				allowedTermTypes: this.viewModel.getSectionTermType(section)
					? [this.viewModel.getSectionTermType(section)!]
					: undefined,
				nav: { header_mode: 'search_only' },
				tree: { usecase: { target: 'aggregateMatrix' } }
			},
			tree: { click_term: term => this.selectSectionTerm(type, idx, term, nameInput) }
		})
		return view
	}

	addSection(type: SectionType) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		sections.push({ name: '', termType: undefined, terms: [] })
		this.editConfig({ [key]: sections })
	}

	selectSectionTerm(type: SectionType, idx: number, selected: any, nameInput: any) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const section: Section | undefined = this.config[key]?.[idx]
		if (!section) return
		const selectedItems: any[] = Array.isArray(selected) ? selected : [selected]
		const selectedTerms: any[] = selectedItems.map(getTerm)
		if (!selectedTerms.length) return
		if (selectedTerms.some(term => !term?.type)) throw new Error('Selected term has no type')

		const selectedType = selectedTerms[0].type
		if (selectedTerms.some(term => term.type != selectedType)) {
			this.dom.validationMessage.text('A section can only contain one term type.')
			return
		}
		const sectionTermType = this.viewModel.getSectionTermType(section)
		if (sectionTermType && sectionTermType != selectedType) {
			this.dom.validationMessage.text(`A section can only contain ${sectionTermType} terms.`)
			return
		}

		if (!isNonDictionaryType(selectedType)) {
			const term = selectedTerms[0]
			this.destroySectionView(type, idx)
			this.updateSection(type, idx, {
				name: term.name || term.id,
				termType: term.type,
				terms: [selectedItems[0]]
			})
			return
		}

		const name = nameInput.property('value').trim()
		if (!name) {
			nameInput.node().reportValidity()
			return
		}
		const terms = [...(section.terms || [])]
		const termKeys = new Set(terms.map(item => getTermSelectionKey(getTerm(item))))
		for (const [index, term] of selectedTerms.entries()) {
			const termKey = getTermSelectionKey(term)
			if (termKeys.has(termKey)) continue
			termKeys.add(termKey)
			terms.push(selectedItems[index])
		}
		this.destroySectionView(type, idx)
		this.updateSection(type, idx, { name, termType: selectedType, terms })
	}

	updateSection(type: SectionType, idx: number, edits: Partial<Section>) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		const section = sections[idx]
		if (!section) return
		Object.assign(section, edits)
		this.editConfig({ [key]: sections })
	}

	editSection(type: SectionType, idx: number) {
		this.destroySectionView(type, idx)
		this.updateSection(type, idx, { name: '', termType: undefined, terms: [] })
	}

	destroySectionView(type: SectionType, idx: number) {
		const key = `${type}:${idx}`
		const view = this.sectionViews.get(key)
		if (!view) return
		view.termdb?.destroy?.()
		view.holder.remove()
		this.sectionViews.delete(key)
	}

	removeSection(type: SectionType, idx: number) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		sections.splice(idx, 1)
		this.destroySectionViews(type)
		this.editConfig({ [key]: sections })
	}

	destroySectionViews(type: SectionType) {
		for (const [key, view] of this.sectionViews) {
			if (!key.startsWith(`${type}:`)) continue
			view.termdb?.destroy?.()
			view.holder.remove()
			this.sectionViews.delete(key)
		}
	}

	editConfig(config: any) {
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	submit() {
		const config = this.viewModel.getAggregateMatrixConfig(this.config)
		validatePlotConfig(config)
		this.app.dispatch({
			type: 'app_refresh',
			subactions: [
				{
					type: 'plot_create',
					config
				},
				{ type: 'plot_delete', id: this.id }
			]
		})
	}
}

export const AggMatrixInputInit = getCompInit(AggMatrixInput)
export const componentInit = AggMatrixInputInit

export async function getPlotConfig(opts) {
	const config = {
		chartType,
		hidePlotFilter: true,
		rowSections: [],
		colSections: []
	}
	return copyMerge(config, opts)
}
