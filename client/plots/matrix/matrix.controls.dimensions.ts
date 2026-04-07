export function setDimensionsBtn(self: any, s: any) {
	const l = s.controlLabels
	self.opts.holder
		.append('button')
		.datum({
			label: 'Cell Layout',
			tables: [
				{
					rows: [
						{
							label: 'Grid',
							title:
								'Show grid lines, which creates borders around each matrix cells. ' +
								' Note that grid lines are hidden when the auto-computed width <= 2, or when either the column and row spacing is set to 0.',
							type: 'checkbox',
							boxLabel: 'show',
							// v===true means property('checked') and convert to recognized 'rect' value for dispatch
							// otherwise, compared value to 'rect' to set the current value of the checkbox
							// note: the non-boolean showGrid values allow keeping the hidden value='pattern' option for benchmark tests
							processInput: (v: any) => (v === true ? 'rect' : v === 'rect'),
							chartType: 'matrix',
							settingsKey: 'showGrid',
							colspan: 2,
							align: 'center'
							// for testing/benchmarking
							// type: 'radio',
							// options: [
							// 	{
							// 		label: 'hide',
							// 		value: ''
							// 	},
							// 	{
							// 		label: 'lines',
							// 		value: 'pattern' // needs debugging for when s.rowh or d.colw does not apply to all rows
							// 	},
							// 	{
							// 		label: 'rect',
							// 		value: 'rect'
							// 	}
							// ]
						},
						{
							label: 'Outline Color',
							title: 'Set a border color for the whole matrix',
							type: 'color',
							chartType: 'matrix',
							settingsKey: 'outlineStroke',
							colspan: 2,
							align: 'center'
							//getDisplayStyle: plot => self.parent.settings.matrix.showGrid ? '' : 'none'
						},
						{
							label: 'Beam Color',
							title: 'Set a color for the beam highlighter',
							type: 'color',
							chartType: 'matrix',
							settingsKey: 'beamStroke',
							colspan: 2,
							align: 'center'
							//getDisplayStyle: plot => self.parent.settings.matrix.showGrid ? '' : 'none'
						},
						{
							label: 'Grid Line Color',
							title: 'Set the grid color, equivalent to applying the same border color for each matrix cell',
							type: 'color',
							chartType: 'matrix',
							settingsKey: 'gridStroke',
							colspan: 2,
							align: 'center'
							//getDisplayStyle: plot => self.parent.settings.matrix.showGrid ? '' : 'none'
						},
						{
							label: 'Background Color',
							title: `Set the background color when there are no alterations or annotation data for a ${l.sample}`,
							type: 'color',
							chartType: 'matrix',
							settingsKey: 'cellbg',
							colspan: 2,
							align: 'center'
						},
						{
							label: `Use Canvas If # ${l.sample} Exceeds`,
							title: `Switch from SVG to canvas rendering when the number of ${l.samples} exceeds this number`,
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'svgCanvasSwitch',
							colspan: 2,
							align: 'center',
							width: 60,
							min: 0,
							max: 10000,
							step: 1
						},
						{
							label: 'Canvas Min. Pixel Width',
							title:
								'Set a minimum pixel width for a matrix cell when using canvas, may affect the perceived sharpness of the canvas image',
							type: 'checkbox',
							boxLabel: 'apply',
							chartType: 'matrix',
							settingsKey: 'useMinPixelWidth',
							colspan: 2,
							align: 'center',
							getDisplayStyle: () => (self.parent.settings.matrix.useCanvas ? '' : 'none')
						}
					]
				},
				{
					header: ['Cells', 'Columns', 'Rows'],
					rows: [
						{
							label: 'Row Height',
							title: 'Set the height of a matrix row',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [{ label: 'N/A' }, { settingsKey: 'rowh', min: 8, max: 30, step: 1 }],
							getDisplayStyle(plot: any) {
								return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
							}
						},
						{
							label: 'Min Col. Width',
							title: 'Set the minimum width of the auto-computed matrix column width',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [{ settingsKey: 'colwMin', min: 0.1, max: 16, step: 0.2 }, { label: 'N/A' }]
						},
						{
							label: 'Max Col. Width',
							title: 'Set the maximum width of the auto-computed matrix column width',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [{ settingsKey: 'colwMax', min: 1, max: 24, step: 0.2 }, { label: 'N/A' }]
						},
						{
							label: 'Spacing',
							title: 'Set the column spacing. Note that this will be set to 0 when the auto-computed width < 2.',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [
								{ settingsKey: 'colspace', min: 0, max: 20, step: 1 },
								{ settingsKey: 'rowspace', min: 0, max: 20, step: 1 }
							],
							getDisplayStyle(plot: any) {
								return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
							}
						},
						{
							label: 'Group spacing',
							title: 'Set the spacing between column and row groups.',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [
								self.parent.chartType == 'hierCluster'
									? { label: 'N/A' }
									: { settingsKey: 'colgspace', min: 0, max: 20, step: 1 },
								{ settingsKey: 'rowgspace', min: 0, max: 20, step: 1 }
							]
						}
					]
				},
				{
					header: ['Labels', 'Columns', 'Rows'],
					rows: [
						{
							label: 'Offset',
							title: 'Set the gap between the label text and matrix edge',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [
								{ settingsKey: 'collabelgap', min: 0, max: 20, step: 1 },
								{ settingsKey: 'rowlabelgap', min: 0, max: 20, step: 1 }
							]
						},
						{
							label: 'Spacing',
							title: 'Set the gap between labels',
							type: 'number',
							width: 50,
							align: 'center',
							chartType: 'matrix',
							inputs: [
								{ settingsKey: 'collabelpad', min: 0, max: 20, step: 1 },
								{ settingsKey: 'rowlabelpad', min: 0, max: 20, step: 1 }
							]
						},
						{
							label: 'Min font size',
							title:
								'Set the minimum auto-computed font size for labels. Note that labels will be hidden if the auto-computed values falls below this minimum.',
							type: 'number',
							width: 50,
							align: 'center',
							colspan: 2,
							chartType: 'matrix',
							settingsKey: 'minLabelFontSize',
							min: 0,
							max: 24,
							step: 0.1
						},
						{
							label: 'Max font size',
							title: 'Set the maximum auto-computed font size for labels',
							type: 'number',
							width: 50,
							align: 'center',
							colspan: 2,
							chartType: 'matrix',
							settingsKey: 'maxLabelFontSize',
							min: 0,
							max: 24,
							step: 0.1
						},
						{
							label: 'Group label<br/>position',
							title: 'Set which side of the matrix to display group labels',
							type: 'radio',
							width: 50,
							chartType: 'matrix',
							labelDisplay: 'block',
							getDisplayStyle(plot: any) {
								return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
							},
							inputs: [
								{
									settingsKey: 'collabelpos',
									// switched since settings.collabelpos refers to the individual column label, not group
									options: [
										{ label: 'Top', value: 'bottom', title: `Display ${l.sample} group labels at the bottom` },
										{ label: 'Bottom', value: 'top', title: `Display ${l.sample} group labels on top` }
									]
								},
								{
									settingsKey: 'rowlabelpos',
									// switched since settings.rowlabelpos refers to the individual column label, not group
									options: [
										{
											label: 'Left',
											value: 'right',
											title: `Display gene or variable group labels on the left side`
										},
										{
											label: 'Right',
											value: 'left',
											title: `Display gene or variable group labels on the right side`
										}
									]
								}
							]
						}
					]
				}
			]
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}
