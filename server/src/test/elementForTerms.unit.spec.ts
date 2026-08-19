import tape from 'tape'
import { resolveElementEntryForTerms } from '../mds3.init.js'

/*
Which element matrix answers dnaMethylation TERM queries on a dataset with no CpG-level
.file. Worth pinning down because every failure here is SILENT: picking the wrong matrix
still returns numbers, just for a different set of genomic features than the user meant.
The mmrf case below is the one that motivated the explicit config -- declaration order puts
eqtm_block (55k specialised blocks) ahead of allccre (267k, every cCRE class).
*/

tape('resolveElementEntryForTerms() - explicit elementForTerms wins over declaration order', t => {
	const q = {
		elementForTerms: 'allccre',
		promoter: { file: '/p.h5' },
		elements: {
			eqtm_block: { file: '/e.h5' },
			allccre: { file: '/a.h5' }
		}
	}
	t.equal(resolveElementEntryForTerms(q)?.file, '/a.h5', 'named entry is chosen, not the first declared')
	t.end()
})

tape('resolveElementEntryForTerms() - mmrf shape without the explicit key falls to eqtm_block', t => {
	// Documents WHY mmrf sets elementForTerms: without it the default picks the first
	// non-promoter entry, which is the narrower matrix.
	const q = {
		promoter: { file: '/p.h5' },
		elements: {
			eqtm_block: { file: '/e.h5' },
			allccre: { file: '/a.h5' }
		}
	}
	t.equal(resolveElementEntryForTerms(q)?.file, '/e.h5', 'first non-promoter entry by declaration order')
	t.end()
})

tape('resolveElementEntryForTerms() - promoter-only dataset still resolves', t => {
	t.equal(resolveElementEntryForTerms({ promoter: { file: '/p.h5' } })?.file, '/p.h5', 'legacy .promoter key')
	t.equal(
		resolveElementEntryForTerms({ elements: { promoter: { file: '/p2.h5' } } })?.file,
		'/p2.h5',
		'promoter declared inside .elements'
	)
	t.end()
})

tape('resolveElementEntryForTerms() - nothing configured yields undefined, not a throw', t => {
	// The caller uses undefined to leave q.get unset, which keeps the term type unavailable.
	// Throwing here would take down dataset init instead.
	t.equal(resolveElementEntryForTerms({}), undefined, 'empty query object')
	t.equal(resolveElementEntryForTerms({ elements: {} }), undefined, 'empty elements map')
	t.equal(resolveElementEntryForTerms({ elements: { x: {} } }), undefined, 'entry without a file is not usable')
	t.end()
})

tape('resolveElementEntryForTerms() - elementForTerms naming an unconfigured entry throws', t => {
	// Loud on purpose: a typo here would otherwise silently fall through to a different
	// matrix and every methylation term would quietly report the wrong features.
	t.throws(
		() => resolveElementEntryForTerms({ elementForTerms: 'nope', elements: { allccre: { file: '/a.h5' } } }),
		/elementForTerms/,
		'unknown key is rejected'
	)
	t.end()
})
