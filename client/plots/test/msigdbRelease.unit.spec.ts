import tape from 'tape'
import {
	LEGACY_MSIGDB_RELEASE,
	currentMsigdbRelease,
	msigdbReleaseOptions,
	plotMsigdbRelease
} from '../msigdbRelease.ts'

/*
Tests:
	msigdbReleaseOptions() lists the genome's releases, the current one first
	plotMsigdbRelease() gives a new plot the current release
	plotMsigdbRelease() keeps the release a saved plot recorded
	plotMsigdbRelease() gives a plot saved before releases the legacy release
	plotMsigdbRelease() falls back to the current release on a genome without the legacy one
*/

const both = {
	termdbs: {
		msigdb: { release: '2026.2.Hs' },
		msigdb_2023_2: { release: LEGACY_MSIGDB_RELEASE }
	}
}
const currentOnly = { termdbs: { msigdb: { release: '2026.2.Hs' } } }
const noReleases = { termdbs: { msigdb: {} } }

tape('\n', test => {
	test.comment('-***- plots/msigdbRelease specs -***-')
	test.end()
})

tape("msigdbReleaseOptions() lists the genome's releases, the current one first", test => {
	test.deepEqual(
		msigdbReleaseOptions(both).map(o => o.value),
		['2026.2.Hs', LEGACY_MSIGDB_RELEASE],
		'current release first'
	)
	test.equal(msigdbReleaseOptions(both)[0].label, '2026.2.Hs (current)', 'the current release is labeled')
	test.deepEqual(msigdbReleaseOptions(noReleases), [], 'no options when the genome lists no releases')
	test.equal(currentMsigdbRelease(noReleases), undefined, 'no current release then')
	test.end()
})

tape('plotMsigdbRelease() gives a new plot the current release', test => {
	test.equal(plotMsigdbRelease(both, undefined), '2026.2.Hs', 'new plot, no saved settings')
	test.equal(plotMsigdbRelease(noReleases, undefined), undefined, 'no release to give: the server uses its current db')
	test.end()
})

tape('plotMsigdbRelease() keeps the release a saved plot recorded', test => {
	test.equal(plotMsigdbRelease(both, { msigdbRelease: '2026.2.Hs' }), '2026.2.Hs', 'saved on the current release')
	test.equal(
		plotMsigdbRelease(both, { msigdbRelease: LEGACY_MSIGDB_RELEASE }),
		LEGACY_MSIGDB_RELEASE,
		'saved on the legacy release'
	)
	test.end()
})

tape('plotMsigdbRelease() gives a plot saved before releases the legacy release', test => {
	test.equal(plotMsigdbRelease(both, {}), LEGACY_MSIGDB_RELEASE, 'saved settings without a release')
	test.end()
})

tape('plotMsigdbRelease() falls back to the current release on a genome without the legacy one', test => {
	test.equal(plotMsigdbRelease(currentOnly, {}), '2026.2.Hs', 'legacy release not offered by this genome')
	test.end()
})
