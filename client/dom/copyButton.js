import { Menu } from './menu'

/*
Creates a copy button with the clipboard icon in the top right corner of a div

------EXPORTED------
copyButton()
    - div
        *** May need to include white-space:normal & word-wrap:break-word in div for styling
    - selector: STR - class, id, or elm
	- attr: STR - element attribute, if defined then attribute value will be copied, otherwise inner text will be copied
*/

export default function copyButton(div, selector, attr) {
	const tip = new Menu({ padding: '5px' })
	const btn = div
		.append('button')
		.attr('type', 'button')
		.style('cursor', 'pointer')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('float', 'right')
		.style('padding', '0px 0px 2px 2px')
		.style('z-index', 1)
		.html('&#128203;')
		.on('click', async () => {
			// copies attribute or text from specified element
			const elem = document.querySelector(selector)
			const copy = attr ? elem.getAttribute(attr) : elem.innerText
			await navigator.clipboard.writeText(copy)
			//Tooltip briefly displays a '✓' to let the user know the text is copied
			tip.clear().showunder(btn.node())
			tip.d.append('div').html('&#10003;')
			setTimeout(() => {
				tip.hide()
			}, 1000)
		})
		.on('mouseenter', () => {
			//Slight lightening of the clipboard icon on hover
			btn.style('opacity', 0.75)
		})
		.on('mouseleave', () => {
			btn.style('opacity', 1)
		})
	return btn
}
