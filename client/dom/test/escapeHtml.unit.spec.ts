import tape from 'tape'
import { escapeHtml } from '../escapeHtml'

/*
test sections:
	- escapeHtml: each special character
	- escapeHtml: element and attribute contexts
	- escapeHtml: non-string input
*/

tape('\n', test => {
	test.comment('-***- dom/escapeHtml -***-')
	test.end()
})

tape('escapeHtml: each special character', test => {
	test.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;', 'should escape all five special characters')
	test.equal(escapeHtml('&lt;'), '&amp;lt;', 'should escape & first so an existing entity stays literal')
	test.equal(escapeHtml('plain text'), 'plain text', 'should leave plain text unchanged')
	test.end()
})

tape('escapeHtml: element and attribute contexts', test => {
	const text = `<img src="x"> Tom & 'Jerry'`
	const div = document.createElement('div')
	div.innerHTML = `<span title="${escapeHtml(text)}">${escapeHtml(text)}</span>`
	test.equal(div.querySelector('img'), null, 'should not create an element from the text')
	test.equal(div.textContent, text, 'should show the literal text')
	test.equal(div.querySelector('span')?.title, text, 'should keep the literal text in a double-quoted attribute')
	test.end()
})

tape('escapeHtml: non-string input', test => {
	test.equal(escapeHtml(12 as any), '12', 'should stringify a number')
	test.end()
})
