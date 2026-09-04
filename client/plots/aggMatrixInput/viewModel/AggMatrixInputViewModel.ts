import type { AggMatrixInputViewState, Section } from './AMIViewModelTypes.ts'
import { validatePlotConfig } from '#plots/aggregateMatrix/AggregateMatrix.ts'
import { isNonDictionaryType } from '#shared/terms.js'

export type { Section, SectionType } from './AMIViewModelTypes.ts'

export class AggMatrixInputViewModel {
	state: AggMatrixInputViewState = {
		availableMethods: [],
		methodsStatus: 'idle',
		methodsError: ''
	}
	private methodTermsKey = ''
	private methodRequestId = 0

	async updateAvailableMethods(config: any, vocabApi: any, signal?: AbortSignal) {
		if (!this.hasTerms(config.rowSections) || !this.hasTerms(config.colSections)) {
			this.methodRequestId++
			this.methodTermsKey = ''
			this.state = { availableMethods: [], methodsStatus: 'idle', methodsError: '' }
			return
		}

		const columns = this.toAxis(config.colSections || [], false)
		const key = Object.values(columns)
			.flatMap(terms => terms.map(wrapper => getTermSelectionKey(wrapper.term)))
			.join('\n')
		if (key == this.methodTermsKey && this.state.methodsStatus == 'ready') return
		this.methodTermsKey = key
		this.state = { ...this.state, methodsStatus: 'loading', methodsError: '' }
		const requestId = ++this.methodRequestId
		try {
			const response = await vocabApi.getAvailableAggregateMatrixMethods(columns, signal)
			if (requestId != this.methodRequestId) return
			if (response?.error) throw new Error(response.error)
			this.state = {
				availableMethods: response?.availableMethods || [],
				methodsStatus: 'ready',
				methodsError: ''
			}
		} catch (error: any) {
			if (requestId != this.methodRequestId) return
			this.state = {
				availableMethods: [],
				methodsStatus: 'error',
				methodsError: error.message || String(error)
			}
		}
	}

	getSectionTermType(section: Section) {
		return section.termType || getTerm(section.terms[0])?.type
	}

	getAggregateMatrixConfig(config: any) {
		return {
			chartType: 'aggregateMatrix',
			rows: this.toAxis(config.rowSections || []),
			columns: this.toAxis(config.colSections || []),
			settings: {
				aggregateMatrix: {
					sizeMethod: config.sizeMethod || '',
					gradientMethod: config.gradientMethod || ''
				}
			}
		}
	}

	getValidationError(config: any) {
		for (const sections of [config.rowSections || [], config.colSections || []]) {
			const names = sections.map(section => (section.name || '').trim())
			if (names.some(name => !name)) return 'Every section requires a name.'
			if (new Set(names).size != names.length) return 'Section names must be unique within each axis.'
			for (const section of sections as Section[]) {
				if (!section.terms.length) continue
				const types = new Set(section.terms.map(item => getTerm(item).type))
				const termType = this.getSectionTermType(section)
				if (types.size != 1 || !termType || !types.has(termType)) return 'Every section must contain exactly one term type.'
				if (!isNonDictionaryType(termType) && section.terms.length != 1) {
					return 'Dictionary sections can contain only one term.'
				}
			}
		}
		if (this.state.methodsError) return `Unable to load aggregate methods: ${this.state.methodsError}`
		if (this.hasTerms(config.rowSections) && this.hasTerms(config.colSections)) {
			if (this.state.methodsStatus != 'ready') return 'Loading compatible aggregate methods.'
			if (this.state.availableMethods.length < 2) return 'Selected column terms do not share at least two aggregate methods.'
			const availableIds = new Set(this.state.availableMethods.map(method => method.id))
			if (config.sizeMethod && !availableIds.has(config.sizeMethod)) return 'The selected size method is not compatible.'
			if (config.gradientMethod && !availableIds.has(config.gradientMethod)) return 'The selected gradient method is not compatible.'
		}
		try {
			validatePlotConfig(this.getAggregateMatrixConfig(config))
			return ''
		} catch (error: any) {
			return error.message || String(error)
		}
	}

	hasTerms(sections: Section[] | undefined) {
		return sections?.some(section => section.terms?.length) === true
	}

	toAxis(sections: Section[], cloneTerms = true) {
		return Object.fromEntries(
			sections.map(section => [
				section.name.trim(),
				section.terms.map(item => toTermWrapper(item, cloneTerms))
			])
		)
	}
}

export function getTerm(item: any) {
	return item?.term || item
}

export function getTermSelectionKey(term: any) {
	return `${term.type}\0${term.assay || ''}\0${term.memberId || ''}\0${term.id || term.gene || term.name}`
}

function toTermWrapper(item: any, clone: boolean) {
	const wrapper = item?.term ? { term: item.term, q: item.q || {} } : { term: item, q: {} }
	return clone ? structuredClone(wrapper) : wrapper
}