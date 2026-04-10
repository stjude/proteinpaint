import type { LlmConfig } from '#types'
import type {
	SummaryPhrase2EntityResult,
	Phrase2EntityResult,
	Entity,
	FilterTreeResultEntity,
	FilterTreeNodeEntity
} from './scaffoldTypes.ts'
import { loadOrBuildEmbeddings, findBestMatch } from './semanticSearch.ts'
import { extractGenesFromPrompt } from './utils.ts'

interface DictTerm {
	id: string
	type: string
	name: string
}

interface GeneTerm {
	gene: string
	type: string
}

interface MethTerm {
	chr: string
	startPos: number
	endPos: number
	type: string
}

type Term = DictTerm | GeneTerm | MethTerm

interface TwValue {
	term: Term
	phrase: string
}

function buildNonDictTermObj(twEntity: Entity, genes_list: string[]): TwValue | undefined {
	switch (twEntity.termType) {
		case 'geneExpression': {
			const relevant_genes = extractGenesFromPrompt(twEntity.phrase, genes_list)
			const twResult: GeneTerm = {
				gene: relevant_genes.length > 0 ? relevant_genes[0] : 'UNKNOWN_GENE',
				type: twEntity.termType
			}
			return { term: twResult, phrase: twEntity.phrase }
		}
		case 'dnaMethylation': {
			return undefined
		}
		case 'geneVariant': {
			return undefined
		}
		case 'proteomeAbundance': {
			return undefined
		}
		default: {
			console.warn(`Unrecognized termType "${twEntity.termType}" for phrase "${twEntity.phrase}".`)
			return undefined
		}
	}
}

async function getTermObj(
	key: string,
	twEntity: Entity,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[]
): Promise<TwValue | undefined> {
	// Non-dic term types should be resolved accordingly,
	if (twEntity.termType !== 'dictionary') {
		const twRes = buildNonDictTermObj(twEntity, genes_list)
		if (!twRes) {
			console.warn(`Skipping ${key} — could not build term for type "${twEntity.termType}"`)
			return undefined
		}
		return twRes
	} else {
		const refEmbedding = await loadOrBuildEmbeddings(dbPath, llm)
		const match = await findBestMatch(twEntity.phrase, refEmbedding, llm)
		const similarityThreshold = 0.8
		if (match.score < similarityThreshold) {
			// Threshold for "good enough" match, can be tuned
			console.warn(`Low similarity score (${(match.score * 100).toFixed(1)}%) for query "${twEntity.phrase}"`)
		} else {
			console.log(
				`${key}: "${twEntity.phrase}" → best match: id="${match.id}" type="${match.type}" name="${match.name}" score=${(
					match.score * 100
				).toFixed(1)}%`
			)
			console.log('KEY: ', key)
			const term: DictTerm = {
				id: match.id,
				type: match.type,
				name: match.name
			}
			return { term, phrase: twEntity.phrase }
		}
	}
}

/** Recursively collect all leaf Entity values from a FilterTreeNodeEntity */
function collectLeafEntities(node: FilterTreeNodeEntity): Entity[] {
	if ('leaf' in node) return [node.leaf]
	return [
		...collectLeafEntities(node.left as FilterTreeNodeEntity),
		...collectLeafEntities(node.right as FilterTreeNodeEntity)
	]
}

export async function inferTermObjFromEntity(
	entity: Phrase2EntityResult,
	plotType: string,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[] // redundant (must be fixed)
): Promise<Record<string, TwValue | TwValue[]>> {
	const twObjects: Record<string, TwValue | TwValue[]> = {}
	if (plotType === 'summary') {
		const summaryEntity = entity as SummaryPhrase2EntityResult
		for (const [key, value] of Object.entries(summaryEntity)) {
			// need special handling for filters, since they can be more complex and nested than other term types
			if (key === 'filter') {
				const filterResult = value as FilterTreeResultEntity | undefined
				if (!filterResult) continue

				const leafEntities = collectLeafEntities(filterResult.tree)
				const filterValues: TwValue[] = []
				for (const filterTerm of leafEntities) {
					console.log('Evaluating filter term:', filterTerm)
					const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list)
					if (!termObj) {
						continue
					}
					filterValues.push(termObj)
				}
				twObjects[key] = filterValues
				continue
			}

			// For other keys (tw1, tw2, tw3), we expect a single Entity in the array
			const entry = value as [Entity] | undefined
			if (!entry) continue
			const twEntity = entry[0]
			const termObj = await getTermObj(key, twEntity, llm, dbPath, genes_list)
			if (!termObj) {
				continue
			}
			twObjects[key] = termObj
		}
		return twObjects
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}
