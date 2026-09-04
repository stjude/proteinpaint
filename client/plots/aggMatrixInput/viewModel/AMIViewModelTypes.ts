import type { AggregateMethodOption } from '#types'

export type SectionType = 'row' | 'column'
export type Section = { name: string; termType?: string; terms: any[] }

export type AggMatrixInputViewState = {
	availableMethods: AggregateMethodOption[]
	methodsStatus: 'idle' | 'loading' | 'ready' | 'error'
	methodsError: string
}