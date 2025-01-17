export class ItemToolTip {
	constructor(item, g, tip) {
		g.on('mouseover', () => {
			tip.clear().showunder(g.node())
			tip.d.append('div').style('padding', '3px').text(item.label)
		})
		g.on('mouseout', () => {
			tip.hide()
		})
	}
}
