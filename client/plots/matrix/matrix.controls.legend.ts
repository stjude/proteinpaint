export function setLegendBtn(self: any, s: any) {
	self.opts.holder
		.append('button')
		.style('margin', '2px 0')
		.datum({
			label: 'Legend Layout',
			rows: [
				//ontop: false,
				{
					label: 'Font Size',
					title: 'Set the font size for the legend text',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'fontsize'
				},
				{
					label: 'Line Height',
					title: 'Set the line height for a legend group',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'lineh'
				},
				{
					label: 'Icon Height',
					title: 'Set the icon height for a legend item',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'iconh'
				},
				{
					label: 'Icon Width',
					title: 'Set the icon width for a legend item',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'iconw'
				},
				/*{
					label: 'Bottom margin',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'padbtm'
				},*/
				{
					label: 'Item Left Pad',
					title: 'Set a left margin for each legend item',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'padx'
				},
				{
					label: 'Left Margin',
					title: 'Set a left margin for the whole legend',
					type: 'number',
					chartType: 'legend',
					settingsKey: 'padleft'
				},
				{
					label: 'Left Indent',
					title:
						`Set a left margin for the first legend item in each group, and should be set to the length of the longest group label.` +
						` The left indent will align the legend group label text to the right.`,
					type: 'number',
					chartType: 'legend',
					settingsKey: 'hangleft'
				},
				{
					label: 'Item Layout',
					title:
						'Option to separate each legend item into a new line, instead of a horizontal layout in the same line.',
					type: 'checkbox',
					chartType: 'legend',
					settingsKey: 'linesep',
					boxLabel: 'Line separated'
				}
			]
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}
