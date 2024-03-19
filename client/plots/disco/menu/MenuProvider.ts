import { Menu } from '#dom/menu'

export default class MenuProvider {
	static create(): Menu {
		const menu = new Menu({ padding: 5 })
		menu.d.style('border', '1px solid #FFF').style('position', 'absolute').style('z-index', 1001)

		return menu
	}
}
