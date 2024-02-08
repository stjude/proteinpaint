export default class MainMenuRender {
	private clickListener: (svg: any) => void

	constructor(clickListener: (svg: any) => void) {
		this.clickListener = clickListener
	}

	render(holder: any, svgDiv: any) {
		holder
			.append('span')
			.style('margin', '10px')
			.style('margin-left', '20px')
			.style('font-family', 'verdana')
			.style('font-size', '28px')
			.style('cursor', 'pointer')
			.style('transition', '0.5s')
			.html('&#8801;')
			.on('click', () => {
				console.log('Menu clicked')
			})
	}
}
