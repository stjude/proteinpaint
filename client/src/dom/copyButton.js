import { Menu } from './menu'

/*
------EXPORTED------
copyButton()
    - div
    - selector: STR - class or id of element
*/

export default function copyButton(div, selector) {
	const tip = new Menu({ padding: '5px' })
	const btn = div
		.append('button')
		.attr('type', 'button')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('float', 'right')
		.style('z-index', 1)
		.html('&#128203;')
		.on('click', async () => {
			const copy = document.querySelector(selector).innerText
			await navigator.clipboard.writeText(copy)
			tip.clear().showunder(btn.node())
			tip.d.append('div').html('&#10003;')
			setTimeout(() => {
				tip.hide()
			}, 1000)
		})
	return btn
}
