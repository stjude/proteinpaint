import tape from 'tape'
import { DictionaryHandler } from '../handlers/dictionary.ts'
import { MAX_PROMPT_LENGTH_FOR_OMNISEARCH } from '../handlers/constants.ts'

/* Tests
	plan()
		- typing: searched from 3 chars up to the max length; Enter ignores the length gates
		- the request always carries includeDict (true or false)
	buildRows()
		- ancestors joined; type-less terms are not selectable; undefined -> []
*/

const handler = new DictionaryHandler()
handler.init()
const empty = { dictionaryTerms: [], genes: [], samples: [] }

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/dictionary -***-')
	t.end()
})

tape('plan() typing: below 3 chars is not searched', t => {
	const plan = handler.plan({ prompt: 'ri', enter: false })
	t.equal(plan.active, false)
	t.deepEqual(plan.request, { includeDict: false }, 'the flag is sent as false so the server skips it')
	t.end()
})

tape('plan() typing: 3 chars up to the max length is searched', t => {
	t.deepEqual(handler.plan({ prompt: 'ris', enter: false }), { active: true, request: { includeDict: true } })
	t.equal(handler.plan({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH), enter: false }).active, true)
	t.equal(handler.plan({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), enter: false }).active, false)
	t.end()
})

tape('plan() Enter ignores the length gates', t => {
	t.equal(handler.plan({ prompt: 'a', enter: true }).active, true, 'one char on Enter')
	t.equal(handler.plan({ prompt: 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 10), enter: true }).active, true)
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
