import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { availableAggregateMethods } from '#types'
import { capitalizeFirstLetter } from '#dom'
import { appInit } from '../termdb/app.js'

const chartType = 'aggMatrixInput'

type SectionType = 'row' | 'column'
type Section = { name: string; terms: any[] }
type SectionView = {
	holder: any
	nameInput: any
	termsHolder: any
	disabledTerms: any[]
	disabledTermIds: string
	termdbApi?: any
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

	constructor(opts:any, api: ComponentApi) {
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

		const axisWrapper = wrapper.append('div').style('display', 'flex').style('margin-bottom', '10px')
		this.dom.sectionHolders = {}
		for (const [type, label] of [
			['row', 'Row'],
			['column', 'Column']
		] as [SectionType, string][]) {
			const axis = axisWrapper
				.append('div')
				.style('margin-right', type === 'row' ? '10px' : '')
				.style('border-right', type === 'row' ? '1px solid #ddd' : '')
			const header = axis.append('div').style('border-bottom', '0.5px solid #ddd').style('padding', '5px')
			header.append('span').style('margin-right', '5px').text(`${label} sections:`)
			header
				.append('button')
				.attr('type', 'button')
				.attr('data-testid', 'sjpp-agg-matrix-add-section-btn')
				.style('border', 'none')
				.style('border-radius', '10px')
				.style('padding', '5px 10px')
				.style('background-color', '#cfe2f3')
				.text('+')
				.on('click', () => this.addSection(type))
			this.dom.sectionHolders[type] = axis.append('div')
		}

		this.dom.submit = wrapper
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
	}

	async main() {
		this.config = this.state.config
		for (const method of ['sizeMethod', 'gradientMethod']) {
			this.dom.methodSelects[method].property('value', this[method] || this.startOpt)
		}

		await this.renderSections('row', this.config.rowSections || [])
		await this.renderSections('column', this.config.colSections || [])

		const allTerms = [...(this.config.rowSections || []), ...(this.config.colSections || [])].flatMap(
			section => section.terms || []
		)
		for (const view of this.sectionViews.values()) {
			const disabledTermIds = allTerms.map(term => term.id || term.name).join('|')
			if (view.disabledTermIds !== disabledTermIds) {
				view.disabledTerms.splice(0, view.disabledTerms.length, ...allTerms)
				view.disabledTermIds = disabledTermIds
				await view.termdbApi?.dispatch({ type: 'app_refresh' })
			}
		}

		const rowCount = (this.config.rowSections || []).reduce((count, section) => count + (section.terms?.length || 0), 0)
		const colCount = (this.config.colSections || []).reduce((count, section) => count + (section.terms?.length || 0), 0)
		const hasValidSectionNames = sections => {
			const names = sections.map(section => (section.name || '').trim())
			return names.every(Boolean) && new Set(names).size === names.length
		}
		const validSectionNames =
			hasValidSectionNames(this.config.rowSections || []) && hasValidSectionNames(this.config.colSections || [])
		const validMethods =
			availableAggregateMethods.some(method => method === this.sizeMethod) &&
			availableAggregateMethods.some(method => method === this.gradientMethod) &&
			this.sizeMethod !== this.gradientMethod
		const enabled = rowCount >= 2 && colCount >= 2 && validSectionNames && validMethods
		this.dom.submit.property('disabled', !enabled).style('cursor', enabled ? 'pointer' : 'default')
	}

	async renderSections(type: SectionType, sections: Section[]) {
		const holder = this.dom.sectionHolders[type]
		for (const [key, view] of this.sectionViews) {
			const index = Number(key.slice(type.length + 1))
			if (key.startsWith(`${type}:`) && index >= sections.length) {
				view.termdbApi?.destroy?.()
				view.holder.remove()
				this.sectionViews.delete(key)
			}
		}

		for (const [index, section] of sections.entries()) {
			const key = `${type}:${index}`
			let view = this.sectionViews.get(key)
			if (!view) {
				view = await this.createSectionView(holder, type, index, section)
				this.sectionViews.set(key, view)
			}
			const hasName = !!(section.name || '').trim()
			view.nameInput
				.property('value', section.name)
				.attr('aria-invalid', hasName ? null : 'true')
				.attr('title', hasName ? null : 'A section name is required')
				.style('border-color', hasName ? null : '#c33')
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

	async createSectionView(holder, type: SectionType, index: number, section: Section): Promise<SectionView> {
		const sectionHolder = holder
			.append('div')
			.attr('data-testid', `sjpp-agg-matrix-${type}-section`)
			.style('margin', '8px 0 0 15px')
			.style('padding', '8px')
		const header = sectionHolder
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '5px')
		const nameId = `sjpp-agg-matrix-${type}-section-name-${this.nextSectionViewId++}`
		header.append('label').attr('for', nameId).text('Section name *:')
		const nameInput = header
			.append('input')
			.attr('id', nameId)
			.attr('data-testid', 'sjpp-agg-matrix-section-name-input')
			.attr('type', 'text')
			.attr('required', true)
			.attr('aria-required', 'true')
			.attr('placeholder', 'Required')
			.on('change', event => this.updateSection(type, index, { name: event.target.value }))
		header
			.append('button')
			.attr('type', 'button')
			.attr('data-testid', 'sjpp-agg-matrix-remove-section-btn')
			.attr('aria-label', `Remove ${type} section`)
			.text('×')
			.on('click', () => this.removeSection(type, index))

		sectionHolder.append('div').attr('data-testid', 'sjpp-agg-matrix-section-term-list').style('margin-left', '10px')
		const termsHolder = sectionHolder.append('div').attr('data-testid', 'sjpp-agg-matrix-section-terms')
		const disabledTerms = [...(this.config.rowSections || []), ...(this.config.colSections || [])].flatMap(
			section => section.terms || []
		)
		const disabledTermIds = disabledTerms.map(term => term.id || term.name).join('|')
		const view: SectionView = { holder: sectionHolder, nameInput, termsHolder, disabledTerms, disabledTermIds }
		view.termdbApi = await appInit({
			holder: termsHolder,
			vocabApi: this.app.vocabApi,
			state: {
				activeCohort: this.state.activeCohort,
				selectedTerms: section.terms || [],
				nav: { header_mode: 'search_only' },
				tree: { usecase: { target: 'aggregateMatrix' } }
			},
			tree: {
				minTermsToSubmit: 1,
				submit_lst: terms => this.updateSection(type, index, { terms })
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

	updateSection(type: SectionType, index: number, edits: Partial<Section>) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		const section = sections[index]
		if (!section) return
		Object.assign(section, edits)
		this.editConfig({ [key]: sections })
	}

	removeSection(type: SectionType, index: number) {
		const key = type === 'row' ? 'rowSections' : 'colSections'
		const sections = structuredClone(this.config[key] || [])
		sections.splice(index, 1)
		this.destroySectionViews(type)
		this.editConfig({ [key]: sections })
	}

	destroySectionViews(type: SectionType) {
		for (const [key, view] of this.sectionViews) {
			if (!key.startsWith(`${type}:`)) continue
			view.termdbApi?.destroy?.()
			view.holder.remove()
			this.sectionViews.delete(key)
		}
	}

	editConfig(config: any) {
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	submit() {
		const toAxis = (sections: Section[]) =>
			Object.fromEntries(
				sections.map(section => [section.name, section.terms.map(term => ({ term: structuredClone(term), q: {} }))])
			)
		this.app.dispatch({
			type: 'app_refresh',
			subactions: [
				{
					type: 'plot_create',
					config: {
						chartType: 'aggregateMatrix',
						rows: toAxis(this.config.rowSections),
						columns: toAxis(this.config.colSections),
						settings: {
							aggregateMatrix: {
								sizeMethod: this.sizeMethod,
								gradientMethod: this.gradientMethod
							}
						}
					}
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
