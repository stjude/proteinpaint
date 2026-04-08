import type { LlmConfig } from '#types'
import type { SummaryPhrase2EntityResult, InferEntity } from './scaffoldTypes.ts'
import { loadOrBuildEmbeddings, findBestMatch } from './semanticSearch.ts'

export async function inferTermObjFromEntity(
	entity: SummaryPhrase2EntityResult,
	type: string,
	llm: LlmConfig,
	dbPath: string
) {
	if (type === 'summary') {
		const store = await loadOrBuildEmbeddings(dbPath, llm)
		const results: Record<string, { id: string; name: string; score: number }> = {}

		const fields: (keyof SummaryPhrase2EntityResult)[] = ['tw1', 'tw2', 'tw3', 'filter']
		for (const field of fields) {
			const entry = entity[field] as [InferEntity] | undefined
			if (!entry) continue
			const inferEntity = entry[0]
			if (inferEntity.termType !== 'dictionary') continue
			const match = await findBestMatch(inferEntity.phrase, store, llm)
			console.log(
				`${field}: "${inferEntity.phrase}" → best match: id="${match.id}" name="${match.name}" score=${(
					match.score * 100
				).toFixed(1)}%`
			)
			results[field] = match
		}

		return results
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}
