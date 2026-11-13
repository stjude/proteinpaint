import tape from 'tape'
import { SearchResultHandler as DictionaryHandler, includeResult } from '../handlers/dictionaryTerms.ts'
import { MAX_PROMPT_LENGTH_FOR_OMNISEARCH } from '../constants.ts'

/* Tests
	includeResult()
		- every dataset has a dictionary
	includeInSearch()
		- typing: searched from 3 chars up to the max length; Enter ignores the length gates
	buildRows()
		- ancestors joined; type-less terms are not selectable; undefined -> []
*/

const handler = new DictionaryHandler()
handler.init()
const empty = { dictionaryTerms: [], genes: [], samples: [] }

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/dictionaryTerms -***-')
	t.end()
})

tape('includeResult() every dataset has a dictionary', t => {
	t.equal(includeResult({}), true)
	t.equal(includeResult(undefined), true, 'a missing config is not an error')
	t.end()
})

tape('includeInSearch() typing: below 3 chars is not searched', t => {
	t.equal(handler.includeInSearch({ prompt: 'ri', enter: false }), false)
	t.end()
})

tape('includeInSearch() typing: 3 chars up to the max length is searched', t => {
	t.equal(handler.includeInSearch({ prompt: 'ris', enter: false }), true)
	t.equal(handler.includeInSearch({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH), enter: false }), true)
	t.equal(handler.includeInSearch({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), enter: false }), false)
	t.end()
})

tape('includeInSearch() Enter ignores the length gates', t => {
	t.equal(handler.includeInSearch({ prompt: 'a', enter: true }), true, 'one char on Enter')
	t.equal(handler.includeInSearch({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 10), enter: true }), true)
	t.end()
})

tape('buildRows() maps terms', t => {
	const rows = handler.buildRows({
		...empty,
		dictionaryTerms: [
			{ id: 'sex', name: 'Sex', type: 'categorical', __ancestorNames: ['Demographics', 'Basic'] },
			{ id: 'folder', name: 'Folder' }
		]
	})
	t.equal(rows.length, 2)
	t.equal(rows[0].ancestors, 'Demographics > Basic', 'ancestors are joined')
	t.equal(rows[0].selectable, true, 'a typed term is selectable')
	t.equal(rows[1].selectable, false, 'a term without a type is not selectable')
	t.equal(rows[1].ancestors, '')
	t.deepEqual(handler.buildRows({ ...empty, dictionaryTerms: undefined as any }), [], 'undefined -> []')
	t.end()
})
