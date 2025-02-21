import { make_radios } from '#dom'

export function gseaMenu(tip, interactions, settings, pointData) {
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
}
