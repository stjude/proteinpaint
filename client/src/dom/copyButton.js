import { Menu } from './menu'

/*
Creates a copy button with the clipboard icon in the top right corner of a div

------EXPORTED------
copyButton()
    - div
        *** May need to include white-space:normal & word-wrap:break-word in div for styling
    - selector: STR - class, id, or elm
*/

export default function copyButton(div, selector) {
	const tip = new Menu({ padding: '5px' })
	const btn = div
		.append('button')
		.attr('type', 'button')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('float', 'right')
		.style('padding', '0px 0px 2px 2px')
		.style('z-index', 1)
		.html('&#128203;')
		.on('click', async () => {
			//Copies text only from a specified element
			const copy = document.querySelector(selector).innerText
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
