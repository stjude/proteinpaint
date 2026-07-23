type DefaultGseaParams = {
	genome: string
}

type DapParams = {
	organism: string
	assay: string
	cohort: string
}

export type ProteomeDAPGseaParams = DefaultGseaParams & {
	dapParams: DapParams
	dslabel: string
}

export type ScctGseaParams = DefaultGseaParams & {
	genes: string[]
	fold_change: number[]
	genes_length: number
}

export type OtherTermTypesGseaParams = DefaultGseaParams & {
	cacheId: string
	daRequest: any
	genes_length: number
	dslabel: string
}

export type GseaParams = ProteomeDAPGseaParams | ScctGseaParams | OtherTermTypesGseaParams

export function isValidGseaParams(value: any): value is GseaParams {
	return isProteomeDAPGseaParams(value) || isScctGseaParams(value) || isOtherTermTypesGseaParams(value)
}

export function isProteomeDAPGseaParams(value: unknown): value is ProteomeDAPGseaParams {
	if (!value || typeof value !== 'object') return false
	const p = value as Record<string, unknown>
	const d: any = p.dapParams as DapParams
	return (
		typeof p.genome === 'string' &&
		typeof p.dslabel === 'string' &&
		d &&
		typeof d.organism === 'string' &&
		typeof d.assay === 'string' &&
		typeof d.cohort === 'string'
	)
}

export function isScctGseaParams(value: unknown): value is ScctGseaParams {
	if (!value || typeof value !== 'object') return false
	const p = value as Record<string, unknown>
	return (
		typeof p.genome === 'string' &&
		Array.isArray(p.genes) &&
		p.genes.every(g => typeof g === 'string') &&
		Array.isArray(p.fold_change) &&
		p.fold_change.every(fc => typeof fc === 'number') &&
		typeof p.genes_length === 'number'
	)
}

export function isOtherTermTypesGseaParams(value: unknown): value is OtherTermTypesGseaParams {
	if (!value || typeof value !== 'object') return false
	const p = value as Record<string, unknown>
	return (
		typeof p.genome === 'string' &&
		typeof p.cacheId === 'string' &&
		'daRequest' in p &&
		typeof p.genes_length === 'number' &&
		typeof p.dslabel === 'string'
	)
}
