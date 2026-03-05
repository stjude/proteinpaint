import test from 'tape'
import { getVafEntries, hasAnyValidVafEntry } from '#plots/disco/snv/vafTooltip.ts'

test('getVafEntries extracts labeled entries from vafs array', t => {
	const entries = getVafEntries([
		{ id: 'Tumor', refCount: 10, altCount: 2 },
		{ name: 'Relapse', refCount: '8', altCount: '1' }
	] as any)

	t.equal(entries.length, 2, 'Should include both entries with id/name labels')
	t.equal(entries[0].label, 'Tumor', 'Should prefer id as label')
	t.equal(entries[1].label, 'Relapse', 'Should use name as label')
	t.end()
})

test('getVafEntries returns empty when vafs is missing', t => {
	const entries = getVafEntries(undefined)

	t.deepEqual(entries, [], 'Should return no entries without vafs array')
	t.end()
})

test('getVafEntries filters invalid VAF entries', t => {
	const entries = getVafEntries([
		{ id: 'MissingRef', altCount: 2 },
		{ name: 'MissingAlt', refCount: 3 },
		{ refCount: 1, altCount: 1 },
		{ id: 'Valid', refCount: 7, altCount: 2 }
	] as any)

	t.deepEqual(entries, [{ label: 'Valid', refCount: 7, altCount: 2 }], 'Should keep only valid labeled entries')
	t.end()
})

test('hasAnyValidVafEntry accepts mixed vaf input with at least one valid entry', t => {
	const hasAny = hasAnyValidVafEntry([
		{ id: 'Bad', refCount: 'foo', altCount: 2 },
		{ name: 'Good', refCount: '6', altCount: '2' }
	] as any)

	t.equal(hasAny, true, 'Should detect at least one valid vaf entry')
	t.end()
})
