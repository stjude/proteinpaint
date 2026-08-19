import tape from 'tape'
import * as d3s from 'd3-selection'
import { mayShowRememberedGvQ } from '../rememberedGvQ.ts'

/* test sections

renders the remembered settings of a term
picks a setting, or declines them
renders nothing when there is nothing to offer

The search handler exercises this through a real gene search, see ./geneVariant.integration.spec.ts.
These cover the contract that any other gene-picking UI depends on.
*/

const term = { type: 'geneVariant', name: 'BCR', genes: [{ kind: 'gene', gene: 'BCR', name: 'BCR' }] }

const lst = [
	{ label: 'BCR-ABL1 fusion / Others', q: { type: 'custom-groupset', customset: { groups: [{ name: 'BCR-ABL1' }] } } },
	{ label: 'BCR-JAK2 fusion / Others', q: { type: 'custom-groupset', customset: { groups: [{ name: 'BCR-JAK2' }] } } }
]

// only a host app whose store remembers these defines getGvQLst(), see remember_gvq() in client/mass/store.ts
function getVocabApi(remembered?: any[]) {
	return remembered ? { getGvQLst: () => structuredClone(remembered) } : {}
}

function getHolder() {
	return d3s.select('body').append('div')
}

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/rememberedGvQ -***-')
	test.end()
})

tape('renders the remembered settings of a term', test => {
	const holder = getHolder()
	const shown = mayShowRememberedGvQ({
		holder,
		vocabApi: getVocabApi(lst),
		term,
		skipLabel: 'Continue without one',
		callback: () => {}
	})

	test.equal(shown, true, 'should report that the caller must wait for a choice')
	test.equal(holder.style('display'), 'block', 'should show the holder')
	const options: any[] = holder.selectAll('.sja_menuoption').nodes()
	test.deepEqual(
		options.map((n: any) => n.textContent),
		['BCR-ABL1 fusion / Others', 'BCR-JAK2 fusion / Others', 'Continue without one'],
		'should offer each setting, then the way to decline them'
	)
	test.equal(
		holder.selectAll('[data-testid="sjpp-genevariant-rememberedQ"]').size(),
		2,
		'should mark only the remembered settings'
	)
	test.ok(
		options.every((n: any) => n.getAttribute('tabindex') == '0' && n.getAttribute('role') == 'button'),
		'should make every option keyboard operable'
	)
	test.equal(document.activeElement, options[0], 'should focus the most recent setting')

	options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
	test.equal(document.activeElement, options[2], 'should wrap when arrowing past the first option')

	holder.remove()
	test.end()
})

tape('picks a setting, or declines them', test => {
	const picked: any[] = []
	const holder = getHolder()
	mayShowRememberedGvQ({
		holder,
		vocabApi: getVocabApi(lst),
		term,
		skipLabel: 'Continue without one',
		callback: q => {
			picked.push(q)
		}
	})
	const options: any[] = holder.selectAll('.sja_menuoption').nodes()

	options[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	test.deepEqual(picked[0], lst[1].q, 'should call back with the q of the picked setting')

	options[2].click()
	test.equal(picked[1], undefined, 'should call back with nothing when the settings are declined')

	holder.remove()
	test.end()
})

tape('renders nothing when there is nothing to offer', test => {
	const holder = getHolder()
	test.equal(
		mayShowRememberedGvQ({ holder, vocabApi: getVocabApi(), term, skipLabel: 'x', callback: () => {} }),
		false,
		'should offer nothing in a host app that does not remember settings'
	)
	test.equal(
		mayShowRememberedGvQ({ holder, vocabApi: getVocabApi([]), term, skipLabel: 'x', callback: () => {} }),
		false,
		'should offer nothing when the term has none remembered'
	)

	// the same holder is reused as the user picks one gene after another
	mayShowRememberedGvQ({ holder, vocabApi: getVocabApi(lst), term, skipLabel: 'x', callback: () => {} })
	mayShowRememberedGvQ({ holder, vocabApi: getVocabApi(), term, skipLabel: 'x', callback: () => {} })
	test.equal(holder.selectAll('.sja_menuoption').size(), 0, 'should clear options left from a previous gene')
	test.equal(holder.style('display'), 'none', 'should hide the holder again')

	holder.remove()
	test.end()
})
