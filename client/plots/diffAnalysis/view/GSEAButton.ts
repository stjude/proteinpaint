import { make_radios } from '#dom'

export class GSEAButton {
	constructor(div, tip, interactions, settings, pointData) {
		div
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('padding', '5px')
			.text('Launch Gene Set Enrichment Analysis')
			.on('click', () => {
				tip.clear().showunder(div.node())
				const holder = tip.d.append('div').style('padding', '10px')
				make_radios({
					holder,
					options: [
						{ label: 'Upregulated', value: 'upregulated' },
						{ label: 'Downregulated', value: 'downregulated' },
						{ label: 'Both', value: 'both' }
					],
					styles: { display: 'block' },
					callback: value => {
						tip.hide()
						interactions.launchGSEA(value, settings.foldChangeCutoff, pointData)
					}
				})
			})
	}
}
