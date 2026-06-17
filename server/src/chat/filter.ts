import { phrase2entitytw, collectLeaves, evaluateFilterTerm } from './utils.ts'
import type { FilterTreeResult } from './scaffoldTypes.ts'
import { getTermObj, isMsgToUser, type Value } from './entity2termObj.ts'
import { resolveToTvs } from './entity2twTvs.ts'
import type { MsgToUser, Entity } from './scaffoldTypes.ts'
import { mayLog } from '#src/helpers.ts'
import type { LlmConfig } from '#types'

/**
 * Convert a natural-language filter phrase into a tvslst object that can be sent to the UI.
 * Pipeline:
 *   1. evaluateFilterTerm() — parse the phrase into a binary AND/OR tree of leaf phrases
 *   2. phrase2entitytw() per leaf — resolve each leaf phrase into an Entity (mirrors the
 *      filter-loop pattern used in phrase2entity.ts)
 *   3. getTermObj() per Entity — resolve each Entity into a Value (mirrors lines 210-219 of
 *      entity2termObj.ts, which does the same conversion for hierCluster filter entities)
 *   4. resolveToTvs() — assemble the Value[] into a final tvslst object
 */
export async function generateFilterTerm(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any,
	dbPath: string,
	genome: any
): Promise<any | MsgToUser> {
	const filterTree: FilterTreeResult = await evaluateFilterTerm(phrase, llm)
	mayLog('generateFilterTerm parsed filter tree:', JSON.stringify(filterTree, null, 2))

	const leafPhrases = collectLeaves(filterTree.tree)
	const filterEntities: Entity[] = []
	for (const leaf of leafPhrases) {
		mayLog('generateFilterTerm evaluating filter leaf:', leaf.phrase)
		const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds, genome)
		if ('type' in filterTw && filterTw.type === 'text') {
			return filterTw as MsgToUser
		}
		const filterEntity = filterTw as Entity
		if (leaf.logicalOperator) filterEntity.logicalOperator = leaf.logicalOperator
		filterEntities.push(filterEntity)
	}

	const filterValues: Value[] = []
	for (const filterTerm of filterEntities) {
		mayLog('generateFilterTerm evaluating filter term:', filterTerm)
		const termObj = await getTermObj('filter', filterTerm, llm, dbPath, genes_list, genome)
		if (isMsgToUser(termObj)) return termObj
		if (!termObj) continue
		if (filterTerm.logicalOperator) termObj.logicalOperator = filterTerm.logicalOperator
		filterValues.push(termObj)
	}

	return await resolveToTvs(filterValues, dbPath, llm)
}
