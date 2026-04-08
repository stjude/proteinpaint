import type { LlmConfig } from '#types'
import type { Phrase2EntityResult, Entity } from './scaffoldTypes.ts'
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

export async function inferTermObjFromEntity(
	entity: Phrase2EntityResult,
	plotType: string,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[] // redundant (must be fixed)
): Promise<Record<string, TwValue>> {
	const twObjects: Record<string, TwValue> = {}
	if (plotType === 'summary') {
		for (const [key, value] of Object.entries(entity)) {
			const entry = value as [Entity] | undefined
			if (!entry) continue
			const twEntity = entry[0]

			// Non-dic term types should be resolved accordingly,
			if (twEntity.termType !== 'dictionary') {
				const twRes = buildNonDictTermObj(twEntity, genes_list)
				if (!twRes) {
					console.warn(`Skipping key "${key}" — could not build term for type "${twEntity.termType}"`)
					continue
				}
				twObjects[key] = twRes
			} else {
				const refEmbedding = await loadOrBuildEmbeddings(dbPath, llm)
				const match = await findBestMatch(twEntity.phrase, refEmbedding, llm)
				const similarityThreshold = 0.8
				if (match.score < similarityThreshold) {
					// Threshold for "good enough" match, can be tuned
					console.warn(`Low similarity score (${(match.score * 100).toFixed(1)}%) for query "${twEntity.phrase}"`)
				} else {
					console.log(
						`${key}: "${twEntity.phrase}" → best match: id="${match.id}" type="${match.type}" name="${
							match.name
						}" score=${(match.score * 100).toFixed(1)}%`
					)
					console.log('KEY: ', key)
					const term: DictTerm = {
						id: match.id,
						type: match.type,
						name: match.name
					}
					twObjects[key] = { term, phrase: twEntity.phrase }
				}
			}
		}
		return twObjects
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}
