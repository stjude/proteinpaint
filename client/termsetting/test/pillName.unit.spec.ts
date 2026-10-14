import tape from 'tape'
import { getPillNameDefault } from '../utils.ts'

/*
The term pill renders getPillNameDefault() with .html(), and a term name can come from a
shared URL, so markup characters in it must show as literal text.

test sections:
	- getPillNameDefault: short and truncated names
*/

tape('\n', test => {
	test.comment('-***- termsetting/getPillNameDefault -***-')
	test.end()
})

function render(html: string) {
	const div = document.createElement('div')
	div.innerHTML = html
	return div
}

tape('getPillNameDefault: short and truncated names', test => {
	const name = `<img src="x"> Tom & 'Jerry'`

	const full = render(getPillNameDefault({ opts: {} }, { name }))
	test.equal(full.querySelector('img'), null, 'should not create an element without abbrCutoff')
	test.equal(full.textContent, name, 'should show the literal name without abbrCutoff')

	const short = render(getPillNameDefault({ opts: { abbrCutoff: 50 } }, { name }))
	test.equal(short.textContent, name, 'should show the literal name when under abbrCutoff')

	const cut = render(getPillNameDefault({ opts: { abbrCutoff: 10 } }, { name }))
	test.equal(cut.querySelector('img'), null, 'should not create an element when truncated')
	test.equal(cut.querySelector('label')?.title, name, 'title should hold the full literal name')
	test.equal(cut.textContent, name.substring(0, 10) + '...', 'should show the literal truncated name')
	test.end()
})
