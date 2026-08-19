import tape from 'tape'
import * as d3s from 'd3-selection'
import { dtsnvindel, dtcnv, dtfusionrna } from '#shared/common.js'
import { mayShowRememberedGvQ } from '../rememberedGvQ.ts'

/* test sections

renders the remembered settings of a term
orders the settings by the selected mutation type
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

/* a grouping of one or more dt terms, as it is remembered: a customset whose group filters
carry the dt term of each tvs, see trimGvQForCache() in shared/utils/src/terms.ts */
function getQ(dtTerms: { dt: number; origin?: string }[]) {
	return {
		type: 'custom-groupset',
		customset: {
			groups: [
				{
					name: 'Group 1',
					filter: {
						type: 'tvslst',
						join: 'and',
						in: true,
						lst: dtTerms.map(t => ({ type: 'tvs', tvs: { term: { id: 'dt', ...t }, values: [] } }))
					}
				}
			]
		}
	}
}

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

tape('orders the settings by the selected mutation type', test => {
	// built for another mutation type than the one selected below, and remembered more recently
	const cnvEntry = { label: 'CNV groups', q: getQ([{ dt: dtcnv }]) }
	const snvindelEntry = { label: 'Somatic SNV/indel groups', q: getQ([{ dt: dtsnvindel, origin: 'somatic' }]) }
	const allelicEntry = { label: 'Bi-allelic / Mono-allelic', q: getQ([{ dt: dtsnvindel }, { dt: dtcnv }]) }
	const remembered = [cnvEntry, snvindelEntry, allelicEntry]
	const getLabels = (holder: any) =>
		holder
			.selectAll('.sja_menuoption')
			.nodes()
			.map((n: any) => n.textContent)

	{
		const holder = getHolder()
		mayShowRememberedGvQ({
			holder,
			vocabApi: getVocabApi(remembered),
			term,
			mutationType: { dt: dtsnvindel, origin: 'somatic' },
			skipLabel: 'Continue with SNV/indel (somatic)',
			callback: () => {}
		})
		test.deepEqual(
			getLabels(holder),
			['Somatic SNV/indel groups', 'CNV groups', 'Bi-allelic / Mono-allelic', 'Continue with SNV/indel (somatic)'],
			'should lead with the setting built for the selected mutation type, keeping the rest in order'
		)
		test.equal(
			document.activeElement,
			holder.selectAll('.sja_menuoption').nodes()[0],
			'should focus the leading setting'
		)
		holder.remove()
	}

	{
		// a mutation type spanning two dts, as the Bi/mono-allelic groupset does
		const holder = getHolder()
		mayShowRememberedGvQ({
			holder,
			vocabApi: getVocabApi(remembered),
			term,
			mutationType: { dts: [dtsnvindel, dtcnv] },
			skipLabel: 'Continue with Bi/mono-allelic',
			callback: () => {}
		})
		test.deepEqual(
			getLabels(holder)[0],
			'Bi-allelic / Mono-allelic',
			'should lead with the setting filtering by the same dts as a multi-dt mutation type'
		)
		holder.remove()
	}

	{
		const holder = getHolder()
		mayShowRememberedGvQ({
			holder,
			vocabApi: getVocabApi(remembered),
			term,
			mutationType: { dt: dtfusionrna },
			skipLabel: 'Continue with Fusion RNA',
			callback: () => {}
		})
		test.deepEqual(
			getLabels(holder),
			['Continue with Fusion RNA', 'CNV groups', 'Somatic SNV/indel groups', 'Bi-allelic / Mono-allelic'],
			'should lead with the mutation type when nothing was remembered for it'
		)
		test.equal(
			document.activeElement,
			holder.selectAll('.sja_menuoption').nodes()[0],
			'should focus the way to continue with the mutation type'
		)
		test.equal(
			holder.selectAll('[data-testid="sjpp-genevariant-rememberedQ"]').size(),
			3,
			'should still mark only the remembered settings'
		)
		holder.remove()
	}

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
