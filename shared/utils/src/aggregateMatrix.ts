import { CATEGORICAL, FLOAT, GENE_EXPRESSION, GENE_VARIANT, INTEGER, PSEUDOBULK, SSGSEA } from '#types'
import { isNonDictionaryType } from './terms.js'

/** Term types that can be rows or columns of the aggregate matrix.
 * Every type here is exercised, as both a row and a column, by
 * server/src/test/aggregateMatrix.request.integration.spec.ts. Add a type here only with a test for it. */
export const AGG_MATRIX_TERM_TYPES: string[] = [CATEGORICAL, INTEGER, FLOAT, GENE_EXPRESSION, SSGSEA, GENE_VARIANT]

/** Term types accepted for rows. */
export const AGG_MATRIX_ROW_TYPES: string[] = AGG_MATRIX_TERM_TYPES

/** Term types accepted for columns. Pseudobulk columns read precomputed values from dataset files, so
 * they must be the only kind of column in the matrix and their rows must be genes (geneExpression terms). */
export const AGG_MATRIX_COLUMN_TYPES: string[] = [...AGG_MATRIX_TERM_TYPES, PSEUDOBULK]

type AxisName = 'rows' | 'columns'

/** Validate one axis of the aggregate matrix, that is, a map of section names to term wrappers.
 *
 * - Every section has a name and at least one term wrapper ({ term, q }); bare terms are not accepted.
 * - Every term in a section has the same, supported term type.
 * - A section of a dictionary type (e.g. categorical, float) holds one term, which expands into its categories
 *   or bins. A section of a non-dictionary type (e.g. geneExpression, geneVariant) holds many terms, one
 *   row or column each.
 *
 * Throws an Error that describes the first problem found.
 * @param allowEmpty permit an axis without sections, e.g. when only asking which methods are available */
export function validateAggMatrixAxis(axis: any, name: AxisName, allowEmpty = false) {
	if (!axis || typeof axis != 'object' || Array.isArray(axis)) throw new Error(`invalid .${name}`)
	const sections = Object.entries<any>(axis)
	if (!sections.length && !allowEmpty) throw new Error(`invalid .${name}: no sections`)
	const allowedTypes = name == 'rows' ? AGG_MATRIX_ROW_TYPES : AGG_MATRIX_COLUMN_TYPES
	for (const [section, terms] of sections) {
		if (!section.trim()) throw new Error(`every .${name} section requires a name`)
		if (!Array.isArray(terms) || !terms.length) throw new Error(`invalid .${name}[${section}]`)
		if (terms.some(tw => !tw?.term || typeof tw.term != 'object')) {
			throw new Error(`${name} section '${section}' must contain term wrappers, such as { term, q }`)
		}
		const types = new Set(terms.map(tw => tw.term.type))
		if (types.size != 1 || types.has(undefined)) {
			throw new Error(`${name} section '${section}' must contain one term type`)
		}
		const termType = terms[0].term.type
		if (!allowedTypes.includes(termType)) {
			throw new Error(`${name} section '${section}' has unsupported term type '${termType}'`)
		}
		if (!isNonDictionaryType(termType) && terms.length != 1) {
			throw new Error(`${name} dictionary section '${section}' must contain one term`)
		}
	}
}

/** Validate the rows and columns of an aggregate matrix, and the combinations of their term types. */
export function validateAggMatrixAxes(rows: any, columns: any) {
	validateAggMatrixAxis(rows, 'rows')
	validateAggMatrixAxis(columns, 'columns')
	const columnTypes = new Set(Object.values<any[]>(columns).flatMap(terms => terms.map(tw => tw.term.type)))
	if (!columnTypes.has(PSEUDOBULK)) return
	if (columnTypes.size > 1) {
		throw new Error('pseudobulk columns cannot be combined with other column term types')
	}
	const rowTypes = new Set(Object.values<any[]>(rows).flatMap(terms => terms.map(tw => tw.term.type)))
	if (rowTypes.size != 1 || !rowTypes.has(GENE_EXPRESSION)) {
		throw new Error(`pseudobulk columns require ${GENE_EXPRESSION} rows`)
	}
}
