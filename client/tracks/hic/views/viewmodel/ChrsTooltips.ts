import { Menu } from '../../../../src/client'

export class ChrsTooltips {
	private chrx_tip: Menu
	private chry_tip: Menu

	constructor() {
		this.chrx_tip = new Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
		this.chry_tip = new Menu({ border: 'solid 1px #ccc', padding: '0px', offsetX: 0, offsetY: 0 })
	}
	render(img: any, chrx: string, chry: string) {
		const p = img.node().getBoundingClientRect()

		this.chrx_tip
			.clear()
			.show(p.left, p.top)
			.d.style('top', null)
			.style('bottom', window.innerHeight - p.top - window.pageYOffset + 'px')
			.text(chrx)

		this.chry_tip
			.clear()
			.show(p.left, p.top)
			.d.style('left', null)
			.style('right', document.body.clientWidth - p.left - window.pageXOffset + 'px')
			.text(chry)
	}
}
