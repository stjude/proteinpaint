export default class DownloadButtonRenderer {
	private downloadClickListener: (svg: any) => void

	constructor(downloadClickListener: (svg: any) => void) {
		this.downloadClickListener = downloadClickListener
	}

	render(holder: any, svgDiv: any) {
		holder
			.append('span')
			.append('button')
			.style('margin', '2px 0 2px 30px')
			.text('Download image')
			.on('click', () => {
				const svg = svgDiv.select('svg').node()
				this.downloadClickListener(svg)
			})
	}
}
