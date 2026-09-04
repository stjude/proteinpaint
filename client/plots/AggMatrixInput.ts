import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type AppApi, type ComponentApi, type RxComponent } from '#rx'
import type { AggregateMethodOption } from '#types'
import { capitalizeFirstLetter, icons } from '#dom'
import { appInit } from '../termdb/app.js'
import { validatePlotConfig } from './aggregateMatrix/AggregateMatrix.ts'
import { isNonDictionaryType } from '#shared/terms.js'

const chartType = 'aggMatrixInput'

type SectionType = 'row' | 'column'
type Section = { name: string; termType?: string; terms: any[] }
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
	sizeMethod = ''
	gradientMethod = ''
	availableMethods: AggregateMethodOption[] = []
	methodsReady = false
	methodsError = ''
	methodTermsKey = ''
	methodRequestId = 0
	nextSectionViewId = 0
	sectionViews = new Map<string, SectionView>()

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
				.on('change', async event => {
					this[methodKey] = event.target.value === this.startOpt ? '' : event.target.value
					await this.main()
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
		await this.updateAvailableMethods()
		this.renderMethodSelects()

		const error = this.getValidationError()
		const enabled = !error
		this.dom.submit.property('disabled', !enabled).style('cursor', enabled ? 'pointer' : 'default')
		this.dom.validationMessage.text(error || '')
	}

	async updateAvailableMethods() {
		if (!this.hasTerms(this.config.rowSections) || !this.hasTerms(this.config.colSections)) {
			this.methodRequestId++
			this.methodTermsKey = ''
			this.availableMethods = []
			this.methodsReady = false
			this.methodsError = ''
			this.dom.methodsHolder.style('display', 'none')
			return
		}

		this.dom.methodsHolder.style('display', '')
		const columnSections = this.toAxis(this.config.colSections || [], false)
		const key = (this.config.colSections || [])
			.flatMap(section => section.terms.map(term => getTermSelectionKey(term.term || term)))
			.join('\n')
		if (key == this.methodTermsKey && this.methodsReady) return
		this.methodTermsKey = key
		this.methodsReady = false
		this.methodsError = ''
		const requestId = ++this.methodRequestId
		try {
			const response = await this.vocabApi!.getAvailableAggregateMatrixMethods(
				columnSections,
				this.api?.getAbortSignal()
			)
			if (requestId != this.methodRequestId) return
			if (response?.error) throw new Error(response.error)
			this.availableMethods = response?.availableMethods || []
			this.methodsReady = true
			const ids = new Set(this.availableMethods.map(method => method.id))
			if (!ids.has(this.sizeMethod)) this.sizeMethod = ''
			if (!ids.has(this.gradientMethod)) this.gradientMethod = ''
		} catch (error: any) {
			if (requestId != this.methodRequestId) return
			this.availableMethods = []
			this.methodsError = error.message || String(error)
		}
	}

	renderMethodSelects() {
		for (const methodKey of ['sizeMethod', 'gradientMethod']) {
			const otherMethod = methodKey == 'sizeMethod' ? this.gradientMethod : this.sizeMethod
			this.dom.methodSelects[methodKey]
				.selectAll('option')
				.data([{ id: this.startOpt, label: this.startOpt }, ...this.availableMethods], method => method.id)
				.join('option')
				.attr('value', method => method.id)
				.property('disabled', method => method.id != this.startOpt && method.id == otherMethod)
				.text(method => method.label)
			this.dom.methodSelects[methodKey].property('value', this[methodKey] || this.startOpt)
		}
	}

	hasTerms(sections: Section[] | undefined) {
		return sections?.some(section => section.terms?.length) === true
	}

	async renderSections(type: SectionType, sections: Section[]) {
		const holder = this.dom.sectionHolders[type]
		for (const [key, view] of this.sectionViews) {
			const idx = Number(key.slice(type.length + 1))
			if (key.startsWith(`${type}:`) && idx >= sections.length) {
				view.termdb?.destroy?.()
				view.holder.remove()
				this.sectionViews.delete(key)
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
			const termType = this.getSectionTermType(section)
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
				allowedTermTypes: this.getSectionTermType(section) ? [this.getSectionTermType(section)!] : undefined,
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
		const selectedTerms = (Array.isArray(selected) ? selected : [selected]).map(item => item.term || item)
		if (!selectedTerms.length) return
		if (selectedTerms.some(term => !term?.type)) throw new Error('Selected term has no type')

		const selectedType = selectedTerms[0].type
		if (selectedTerms.some(term => term.type != selectedType)) {
			this.dom.validationMessage.text('A section can only contain one term type.')
			return
		}
		const sectionTermType = this.getSectionTermType(section)
		if (sectionTermType && sectionTermType != selectedType) {
			this.dom.validationMessage.text(`A section can only contain ${sectionTermType} terms.`)
			return
		}

		if (!isNonDictionaryType(selectedType)) {
			const term = selectedTerms[0]
			this.destroySectionView(type, idx)
			this.updateSection(type, idx, { name: term.name || term.id, termType: term.type, terms: [term] })
			return
		}

		const name = nameInput.property('value').trim()
		if (!name) {
			nameInput.node().reportValidity()
			return
		}
		const terms = [...(section.terms || [])]
		const termKeys = new Set(terms.map(item => getTermSelectionKey(item.term || item)))
		for (const term of selectedTerms) {
			const termKey = getTermSelectionKey(term)
			if (termKeys.has(termKey)) continue
			termKeys.add(termKey)
			terms.push(term)
		}
		this.destroySectionView(type, idx)
		this.updateSection(type, idx, { name, termType: selectedType, terms })
	}

	getSectionTermType(section: Section) {
		return section.termType || (section.terms[0]?.term || section.terms[0])?.type
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

	getAggregateMatrixConfig() {
		return {
			chartType: 'aggregateMatrix',
			rows: this.toAxis(this.config.rowSections || []),
			columns: this.toAxis(this.config.colSections || []),
			settings: {
				aggregateMatrix: {
					sizeMethod: this.sizeMethod,
					gradientMethod: this.gradientMethod
				}
			}
		}
	}

	toAxis(sections: Section[], cloneTerms = true) {
		return Object.fromEntries(
			sections.map(section => [
				section.name.trim(),
				cloneTerms ? section.terms.map(term => structuredClone(term)) : section.terms
			])
		)
	}

	getValidationError() {
		for (const sections of [this.config.rowSections || [], this.config.colSections || []]) {
			const names = sections.map(section => (section.name || '').trim())
			if (names.some(name => !name)) return 'Every section requires a name.'
			if (new Set(names).size !== names.length) return 'Section names must be unique within each axis.'
			for (const section of sections as Section[]) {
				if (!section.terms.length) continue
				const types = new Set(section.terms.map(item => (item.term || item).type))
				const termType = this.getSectionTermType(section)
				if (types.size != 1 || !termType || !types.has(termType)) return 'Every section must contain exactly one term type.'
				if (!isNonDictionaryType(termType) && section.terms.length != 1) {
					return 'Dictionary sections can contain only one term.'
				}
			}
		}
		if (this.methodsError) return `Unable to load aggregate methods: ${this.methodsError}`
		if (this.hasTerms(this.config.rowSections) && this.hasTerms(this.config.colSections)) {
			if (!this.methodsReady) return 'Loading compatible aggregate methods.'
			if (this.availableMethods.length < 2) return 'Selected column terms do not share at least two aggregate methods.'
			const availableIds = new Set(this.availableMethods.map(method => method.id))
			if (this.sizeMethod && !availableIds.has(this.sizeMethod)) return 'The selected size method is not compatible.'
			if (this.gradientMethod && !availableIds.has(this.gradientMethod)) return 'The selected gradient method is not compatible.'
		}
		try {
			validatePlotConfig(this.getAggregateMatrixConfig())
			return ''
		} catch (error: any) {
			return error.message || String(error)
		}
	}

	submit() {
		const config = this.getAggregateMatrixConfig()
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

function getTermSelectionKey(term: any) {
	return `${term.type}\0${term.assay || ''}\0${term.memberId || ''}\0${term.id || term.gene || term.name}`
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
