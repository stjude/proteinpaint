import { select } from 'd3-selection'
import { VocabApi } from '#shared/types/index'
import { GeneExpressionTermSettingInstance, GeneExpressionTW } from '#shared/types/terms/geneExpression'

/*
 */

// self is the termsetting instance
export function getHandler(self: GeneExpressionTermSettingInstance) {
	return {
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			return { text: self.q.exclude?.length ? 'matching variants' : 'any variant class' }
		},

		//validateQ(data: Q) {},

		async showEditMenu(div: Element) {
			await makeEditMenu(self, div)
		}
	}
}

const idPrefix = `_geneExpression_AUTOID_${+new Date()}_`
let id = 0

export function fillTW(tw: GeneExpressionTW, vocabApi?: VocabApi) {
	if (!('id' in tw)) tw.id = idPrefix + id++

	{
		// apply optional ds-level configs for this specific term
		const c = vocabApi?.termdbConfig.customTwQByType?.geneExpression
		if (c) {
			Object.assign(tw.q, c.default || {}, tw.q)
		}
	}
}

function makeEditMenu(self: GeneExpressionTermSettingInstance, _div: any) {
	const div = _div.append('div').style('padding', '5px').style('cursor', 'pointer')
	// todo
}
