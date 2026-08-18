import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type AppApi, type ComponentApi, type RxComponent } from '#rx'
import { availableAggregateMethods } from '#types'
import { capitalizeFirstLetter, icons } from '#dom'
import { appInit } from '../termdb/app.js'
import { validatePlotConfig } from './aggregateMatrix/AggregateMatrix.ts'

const chartType = 'aggMatrixInput'

type SectionType = 'row' | 'column'
type Section = { name: string; terms: any[] }
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
	nextSectionViewId = 0
	sectionViews = new Map<string, SectionView>()

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = AggMatrixInput.type
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

		this.dom.methodSelects = {}
		for (const method of ['size', 'gradient']) {
			const methodKey = `${method}Method`
			const methodWrapper = wrapper
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
			this.dom.methodSelects[methodKey]
				.selectAll('option')
				.data([this.startOpt, ...availableAggregateMethods])
				.join('option')
				.attr('value', value => value)
				.text(value => value)
		}

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
		for (const method of ['sizeMethod', 'gradientMethod']) {
			this.dom.methodSelects[method].property('value', this[method] || this.startOpt)
		}

		await this.renderSections('row', this.config.rowSections || [])
		await this.renderSections('column', this.config.colSections || [])

		const error = this.getValidationError()
		const enabled = !error
		this.dom.submit.property('disabled', !enabled).style('cursor', enabled ? 'pointer' : 'default')
		this.dom.validationMessage.text(error || '')
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
			const isSubmitted = !!section.terms?.length
			view.nameLabel.style('display', isSubmitted ? 'none' : '')
			view.nameInput
				.property('value', section.name)
				.attr('aria-invalid', hasName ? null : 'true')
				.attr('title', hasName ? null : 'A section name is required')
				.style('border-color', hasName ? null : '#c33')
				.style('display', isSubmitted ? 'none' : '')
			view.displayName.style('display', isSubmitted ? '' : 'none').text(section.name)
			view.editButton.style('display', isSubmitted ? '' : 'none')
			view.holder
				.select('[data-testid="sjpp-agg-matrix-section-term-list"]')
				.selectAll('div')
				.data(section.terms || [], term => term.id || term.name)
				.join('div')
				.attr('data-testid', 'sjpp-agg-matrix-section-term')
				.style('margin', '5px')
				.text(term => term.name || term.id)
			view.termsHolder.style('display', section.terms?.length ? 'none' : '')
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
				selectedTerms: section.terms || [],
				nav: { header_mode: 'search_only' },
				tree: { usecase: { target: 'aggregateMatrix' } }
			},
			tree: {
				//TODO: Cannot disable terms previously used in current tree set up. 
				//Need to investigate why or come up with work around. 
				minTermsToSubmit: 1,
				submit_lst: terms => {
					const name = nameInput.property('value').trim()
					if (!name) {
						nameInput.node().reportValidity()
						return
					}
					this.updateSection(type, idx, { name, terms })
				}
			}
		})
		return view
	}

	addSection(type: SectionType) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		sections.push({ name: '', terms: [] })
		this.editConfig({ [key]: sections })
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
		this.updateSection(type, idx, { terms: [] })
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
		const toAxis = (sections: Section[]) =>
			Object.fromEntries(
				sections.map(section => [
					section.name.trim(),
					section.terms.map(term => (structuredClone(term)))
				])
			)
		return {
			chartType: 'aggregateMatrix',
			rows: toAxis(this.config.rowSections || []),
			columns: toAxis(this.config.colSections || []),
			settings: {
				aggregateMatrix: {
					sizeMethod: this.sizeMethod,
					gradientMethod: this.gradientMethod
				}
			}
		}
	}

	getValidationError() {
		for (const sections of [this.config.rowSections || [], this.config.colSections || []]) {
			const names = sections.map(section => (section.name || '').trim())
			if (names.some(name => !name)) return 'Every section requires a name.'
			if (new Set(names).size !== names.length) return 'Section names must be unique within each axis.'
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
