import tape from 'tape'
import {
	bundleCheck,
	checkBundleVersion,
	compareVersions,
	getBundleStatus,
	isVersion,
	notifyChunkLoadError,
	showBundleNotice
} from '../bundleVersion.ts'

/* list of tests

isVersion()
compareVersions()
getBundleStatus()
showBundleNotice()
checkBundleVersion()
notifyChunkLoadError()

*/

const noticeSelector = '.sja_pp_bundle_notice'

function removeNotices() {
	for (const elem of document.querySelectorAll(noticeSelector)) elem.remove()
}

tape('\n', function (test) {
	test.comment('-***- bundleVersion -***-')
	test.end()
})

tape('isVersion()', test => {
	test.equal(isVersion('2.215.0'), true, 'should accept a version')
	test.equal(isVersion('2.211.1-0'), true, 'should accept a prerelease version')
	test.equal(isVersion('___current-proteinpaint-client-version___'), false, 'should reject an unreplaced placeholder')
	test.equal(isVersion(undefined), false, 'should reject a missing version')
	test.end()
})

tape('compareVersions()', test => {
	test.equal(compareVersions('2.215.0', '2.215.0'), 0, 'should equal the same version')
	test.equal(compareVersions('2.211.1-0', '2.211.1'), 0, 'should ignore a prerelease suffix')
	test.equal(compareVersions('2.9.0', '2.10.0'), -1, 'should compare numerically, not as strings')
	test.equal(compareVersions('3.0.0', '2.215.9'), 1, 'should compare the major version first')
	test.end()
})

tape('getBundleStatus()', test => {
	test.equal(getBundleStatus('2.214.0', '2.215.0'), 'outdated', 'should detect an outdated page')
	test.equal(getBundleStatus('2.215.0', '2.214.0'), 'ahead', 'should detect a page that is ahead of the server')
	test.equal(getBundleStatus('2.215.0', '2.215.0'), 'same', 'should detect a matching version')
	test.equal(getBundleStatus('2.215.0', undefined), 'unknown', 'should be unknown without a served version')
	test.end()
})

tape('showBundleNotice()', test => {
	removeNotices()
	showBundleNotice('outdated')
	showBundleNotice('ahead')
	const notices = document.querySelectorAll(noticeSelector)
	test.equal(notices.length, 1, 'should reuse an existing notice')
	const notice = notices[0] as HTMLElement
	test.equal(notice.dataset.status, 'ahead', 'should update the notice status')
	test.equal(notice.querySelectorAll('button').length, 1, 'should only have a dismiss button when the page is ahead')
	showBundleNotice('outdated')
	const buttons = notice.querySelectorAll('button')
	test.deepEqual(
		[...buttons].map(b => b.textContent),
		['Reload', '×'],
		'should have reload and dismiss buttons for an outdated page'
	)
	buttons[1].click()
	test.equal(document.querySelectorAll(noticeSelector).length, 0, 'should remove the notice when dismissed')
	test.end()
})

tape('checkBundleVersion()', test => {
	removeNotices()
	const enabled = bundleCheck.enabled
	bundleCheck.enabled = false
	checkBundleVersion('2.214.0', '2.215.0')
	test.equal(document.querySelectorAll(noticeSelector).length, 0, 'should not notify when not enabled')
	bundleCheck.enabled = true
	checkBundleVersion('2.215.0', '2.215.0')
	test.equal(document.querySelectorAll(noticeSelector).length, 0, 'should not notify for a matching version')
	checkBundleVersion('2.214.0', '2.215.0')
	const notice = document.querySelector(noticeSelector) as HTMLElement
	test.equal(notice?.dataset.status, 'outdated', 'should notify for an outdated page')
	bundleCheck.enabled = enabled
	removeNotices()
	test.end()
})

tape('notifyChunkLoadError()', async test => {
	removeNotices()
	const origFetch = window.fetch
	const requested: string[] = []
	window.fetch = (async url => {
		requested.push(url)
		return { json: async () => ({ versionInfo: { clientVersion: '2.215.0' } }) }
	}) as any
	try {
		await notifyChunkLoadError({ request: 'https://pp.test/base/bin/123.abcd1234.proteinpaint.js' }, '2.214.0')
		test.deepEqual(requested, ['https://pp.test/base/healthcheck'], 'should request the healthcheck of the chunk host')
		let notice = document.querySelector(noticeSelector) as HTMLElement
		test.equal(notice?.dataset.status, 'outdated', 'should notify for an outdated page')

		window.fetch = (async () => {
			throw new Error('network error')
		}) as any
		await notifyChunkLoadError({ request: 'https://pp.test/bin/123.abcd1234.proteinpaint.js' }, '2.214.0')
		notice = document.querySelector(noticeSelector) as HTMLElement
		test.equal(notice?.dataset.status, 'unknown', 'should show a generic notice when the healthcheck fails')
	} finally {
		window.fetch = origFetch
		removeNotices()
	}
	test.end()
})
