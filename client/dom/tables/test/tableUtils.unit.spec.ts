import tape from 'tape'
import * as d3s from 'd3-selection'
import { isSafeUrl, plainButton, uniqueId } from '../tableUtils'

/*
Tests:
	isSafeUrl: web, mail and relative urls pass; script-running schemes and junk do not
	uniqueId: ids differ, keep their prefix
	plainButton: removes the browser button look and returns the selection
*/

tape('\n', test => {
	test.comment('-***- dom/tables/tableUtils -***-')
	test.end()
})

tape('isSafeUrl: web, mail and relative urls pass; script-running schemes and junk do not', test => {
	for (const url of ['https://example.com', 'http://example.com/a?b=1#c', 'mailto:a@example.com', '/relative', 'page.html', '?q=1', '#top']) {
		test.ok(isSafeUrl(url), `safe: ${url}`)
	}
	for (const url of [
		'javascript:alert(1)',
		'JAVASCRIPT:alert(1)',
		'  javascript:alert(1)',
		'\tjava\nscript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox(1)',
		'file:///etc/passwd',
		'blob:https://example.com/x',
		'ftp://example.com',
		'http://'
	]) {
		test.notOk(isSafeUrl(url), `unsafe: ${JSON.stringify(url)}`)
	}
	test.end()
})

tape('uniqueId: ids differ, keep their prefix', test => {
	const ids = new Set(Array.from({ length: 100 }, () => uniqueId('x')))
	test.equal(ids.size, 100, 'no repeats')
	test.ok(uniqueId('menu').startsWith('sjpp-menu-'), 'keeps the prefix')
	test.notEqual(uniqueId('a').replace('a', ''), uniqueId('b').replace('b', ''), 'a counter is part of the id')
	test.end()
})

tape('plainButton: removes the browser button look and returns the selection', test => {
	const holder = d3s.select('body').append('div')
	const button = plainButton(holder.append('button'))
	const node = button.node() as HTMLButtonElement

	test.equal(node.style.background, 'none', 'no background')
	test.equal(node.style.borderStyle, 'none', 'no border')
	test.equal(node.style.cursor, 'pointer', 'pointer cursor')
	test.equal(button.text('x').node(), node, 'returns the same selection so calls chain')

	if ((test as any)._ok) holder.remove()
	test.end()
})
