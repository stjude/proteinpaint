export default [
	{
		label: 'Core',
		settings: [
			{
				key: 'svgw',
				label: 'SVG width',
				example: 1300,
				description: 'The width of the SVG.'
			},
			{
				key: 'minHits',
				label: 'Minimum Hits',
				example: 5,
				description: 'Only display genes with this minimum number of hits.'
			},
			{
				key: 'sampletypes',
				label: 'Visible Sample Types',
				example: 'DIAGNOSIS',
				description: 'Show only sample types that match one of these comma-separated values.'
			} /*,{
		key: "numSamples", 
		label: "Combine Samples", 
		example: 0,
		//min: 0,
		//max: 1,
		//description: "The maximum number of samples to display."
			//+ " If 0, the samples will be combined in one Disco plot."
		type: 'radio',
		name: 'sjcharts-disco-numSamples',
		options: [{
			key: "numSamples",
			id: 'sjcharts-disco-numSamples-0',
			value: 0,
			label: 'Yes'
		},{
			key: "numSamples",
			id: 'sjcharts-disco-numSamples-0',
			value: 1,
			label: 'No'
		}]
	}*/,
			{
				key: 'innerRadius',
				label: 'Inner Radius',
				example: 200,
				description: 'The inner radius to use for the core circle.'
			},
			{
				key: 'hiddenChromosomes',
				label: 'Hide Chromosomes',
				example: '',
				description: 'Hide comma-separated list of chromosomes'
			}
		]
	},
	{
		label: 'Genes',
		settings: [
			{
				key: 'gene.alwaysLabel',
				label: 'Always label',
				example: 'RELA,MYC,MYCN',
				description: 'Always show the label for these comma-separated list of genes.'
			},
			{
				key: 'gene.filterOut',
				label: 'Filter out',
				example: 'C11orf95',
				description: 'Do not render any of these comma-separated genes.'
			} /*,{
		key: "gene.queryPositions", 
		label: "Query positions",
		example: false,
		description: "Use the portal database to fill-in missing gene chromosome and start/end information."
	}*/
		]
	},
	{
		label: 'Labels',
		settings: [
			{
				key: 'label.colorBy',
				label: 'Label color',
				example: 'variant-class',
				type: 'select',
				name: 'sjcharts-disco-label-colorBy',
				description: 'Option to color a label by mutation class, defaults to black #000',
				options: [
					{
						key: 'label.colorBy',
						value: 'layer',
						label: 'Layer'
					},
					{
						key: 'label.colorBy',
						value: 'variant-class',
						label: 'Class'
					}
				]
			},
			{
				key: 'label.fontSize',
				label: 'Label Font-Size',
				example: 10,
				description: 'The font-size to use for the outermost labels.'
			} /*,{
		key: "gene.minHitsForLabel", 
		label: "Minimum hits for label",
		example: 5,
		description: "Only display labels for variants with this minimum number of hits."
	}*/,
			{
				key: 'label.uncollide',
				label: 'Uncollide',
				example: true,
				description: 'Move labels to avoid collisions.'
			}
		]
	},
	{
		label: 'SNV-Indels',
		settings: [
			{
				key: 'showSNVs',
				label: 'Show',
				example: true,
				description: 'Show or hide the SNV track.'
			},
			{
				key: 'snv.byClassWidth',
				label: 'By class width',
				example: 10,
				description:
					'Create a separate layer with this width for each snv-indel class (set to 0 to disable; will override snv.width if >0).'
			},
			{
				key: 'snv.width',
				label: 'Width',
				example: 30,
				description: 'The width of the SNV-Indel track (overriden if by-class-width is >0).'
			},
			{
				key: 'snv.minHits',
				label: 'Minimum Hits',
				example: 5,
				description: 'Only display SNV-indels with this minimum number of hits.'
			},
			{
				key: 'snv.minHitsForLabel',
				label: 'Minimum hits for label',
				example: 5,
				description: 'Only display labels for SNV-indel variants with this minimum number of hits.'
			},
			{
				key: 'snv.unit',
				label: 'Unit',
				example: 'pct',
				description: 'What unit to use when scaling the snv bars',
				type: 'select',
				name: 'sjcharts-disco-snv-unit',
				options: [
					{
						key: 'snv.unit',
						value: 'pct',
						label: 'Percent'
					},
					{
						key: 'snv.unit',
						value: 'abs',
						label: 'Absolute'
					},
					{
						key: 'snv.unit',
						value: 'log',
						label: 'Log(e)'
					}
				]
			},
			{
				key: 'snv.labelFill',
				label: 'Label color',
				example: '#00f',
				description: 'Label color for SNV variants.'
			}
		]
	},
	{
		label: 'Copy Number',
		settings: [
			{
				key: 'showCNVs',
				label: 'Show',
				example: true,
				description: 'Show or hide the copy-number track.'
			},
			{
				key: 'cnv.type',
				label: 'Plot Type',
				type: 'select',
				example: 'bars',
				description: 'How to render the CNV values',
				name: 'sjcharts-disco-cnv-type',
				options: [
					{
						key: 'cnv.type',
						value: 'bar',
						label: 'Bar'
					},
					{
						key: 'cnv.type',
						value: 'segment',
						label: 'Segment'
					},
					{
						key: 'cnv.type',
						value: 'step',
						label: 'Step'
					},
					{
						key: 'cnv.type',
						value: 'scatter',
						label: 'Scatter'
					},
					{
						key: 'cnv.type',
						value: 'chromatic',
						label: 'Chromatic'
					}
				]
			},
			/*{
		key: "cnv.minHits", 
		label: "Minimum Hits", 
		example: 1,
		description: "Only display CNV genes with this minimum number of hits."
	},{
		key: "cnv.minHitsForLabel", 
		label: "Minimum hits for label",
		example: 5,
		description: "Only display labels for copy number variants with this minimum number of hits."
	}{
		key: "cnv.minHeightRatio", 
		label: "Minimum Height Ratio", 
		example: 1,
		description: "The minimum height for a plotted CNV line."
	},*/ {
				key: 'cnv.width',
				label: 'Width',
				example: 50,
				description: 'The width of the CNV track.'
			},
			{
				key: 'cnv.gap',
				label: 'Gap',
				example: 0,
				description: 'The gap between the CNV track and the previous layer.'
			},
			{
				key: 'cnv.mirrorScale',
				label: 'Mirror Scale',
				example: true,
				description: 'Scale the loss and gain sides to opposing maximum values.'
			},
			{
				key: 'cnv.showGrid',
				label: 'Show grid',
				example: false,
				description: 'Show or hide circular grids on the CNV layer'
			},
			{
				key: 'cnv.gridFontSize',
				label: 'Grid Font Size',
				example: 12,
				description: 'The font-size to use when labeling grid values',
				hideTest: currSettings => !currSettings.cnv.showGrid
			},
			{
				key: 'cnv.gridLabelRotate',
				label: 'Grid Label Rotate',
				example: 0,
				description: "Rotate the grid label in degrees, from 12 o'clock",
				hideTest: currSettings => !currSettings.cnv.showGrid
			},
			{
				key: 'cnv.gridLabelStartOffset',
				label: 'Grid Label Offset',
				example: 20,
				description: 'Move the grid label in pixels from the left starting point',
				hideTest: currSettings => !currSettings.cnv.showGrid
			},
			{
				key: 'cnv.gridLabelSpan',
				label: 'Grid Label Span',
				example: 7,
				description: 'The width of the label background',
				hideTest: currSettings => !currSettings.cnv.showGrid
			},
			{
				key: 'cnv.gridLabelFill',
				label: 'Grid Label Fill',
				example: '#fff',
				description: 'The color of the label background',
				hideTest: currSettings => !currSettings.cnv.showGrid
			}
		]
	},
	{
		label: 'Loss of Heterozygozity',
		settings: [
			{
				key: 'showLOH',
				label: 'Show',
				example: true,
				description: 'Show or hide the LOH track.'
			},
			{
				key: 'loh.type',
				label: 'Plot Type',
				type: 'select',
				example: 'bars',
				description: 'How to render the CNV values',
				name: 'sjcharts-disco-cnv-type',
				options: [
					{
						key: 'loh.type',
						value: 'bar',
						label: 'Bar'
					},
					{
						key: 'loh.type',
						value: 'segment',
						label: 'Segment'
					},
					{
						key: 'loh.type',
						value: 'step',
						label: 'Step'
					},
					{
						key: 'loh.type',
						value: 'scatter',
						label: 'Scatter'
					},
					{
						key: 'loh.type',
						value: 'chromatic',
						label: 'Chromatic'
					}
				]
			},
			{
				key: 'loh.width',
				label: 'Width',
				example: 50,
				description: 'The width of the CNV track.'
			},
			{
				key: 'loh.gap',
				label: 'Gap',
				example: 0,
				description: 'The gap between the CNV track and the previous layer.'
			},
			{
				key: 'loh.showGrid',
				label: 'Show grid',
				example: false,
				description: 'Show or hide circular grids on the CNV layer'
			},
			{
				key: 'loh.gridFontSize',
				label: 'Grid Font Size',
				example: 12,
				description: 'The font-size to use when labeling grid values',
				hideTest: currSettings => !currSettings.loh.showGrid
			},
			{
				key: 'loh.gridLabelRotate',
				label: 'Grid Label Rotate',
				example: 0,
				description: "Rotate the grid label in degrees, from 12 o'clock",
				hideTest: currSettings => !currSettings.loh.showGrid
			},
			{
				key: 'loh.gridLabelStartOffset',
				label: 'Grid Label Offset',
				example: 20,
				description: 'Move the grid label in pixels from the left starting point',
				hideTest: currSettings => !currSettings.loh.showGrid
			},
			{
				key: 'loh.gridLabelSpan',
				label: 'Grid Label Span',
				example: 7,
				description: 'The width of the label background',
				hideTest: currSettings => !currSettings.loh.showGrid
			},
			{
				key: 'loh.gridLabelFill',
				label: 'Grid Label Fill',
				example: '#fff',
				description: 'The color of the label background',
				hideTest: currSettings => !currSettings.loh.showGrid
			}
		]
	},
	{
		label: 'Structural Variants',
		settings: [
			{
				key: 'showSVs',
				label: 'Show',
				example: true,
				description: 'Show or hide the structural variants track.'
			},
			{
				key: 'sv.minHits',
				label: 'Minimum Hits',
				example: 1,
				description: 'Only display SV genes with this minimum number of hits.'
			},
			{
				key: 'sv.minHitsForLabel',
				label: 'Minimum hits for label',
				example: 5,
				description: 'Only display labels for SV variants with this minimum number of hits.'
			},
			{
				key: 'sv.labelFill',
				label: 'Label color',
				example: '#f00',
				description: 'Label color for SNV variants.'
			},
			{
				key: 'sv.fusionOnly',
				label: 'Only Fusions',
				example: true,
				description: "Limit to showing fusions and not deletions, etc.'"
			},
			{
				key: 'sv.colors',
				label: 'Color Range',
				example: '#ffff00,#0000ff',
				description: "The color range as colorbrewer 'key.#'' or 'minHexColor,maxHexColor'"
			},
			{
				key: 'sv.fillOpacity',
				label: 'Fill Opacity',
				example: 0.3,
				description: 'The fill opacity to use for chords.'
			},
			{
				key: 'sv.strokeOpacity',
				label: 'Stroke Opacity',
				example: 0.3,
				description: 'The border stroke opacity to use for chords.'
			} /*,{
		key: "sv.colorBy",
		label: "Color By",
		type: 'radio', 
		example: 'count',
		description: "What parameter to use for the color of fusion ribbons",
		name: 'sjcharts-disco-colorBy',
		options: [{
			key: "sv.colorBy",
			id: 'sjcharts-disco-colorBy-count',
			value: 'count',
			label: 'Sample Count'
		},{
			key: "sv.colorBy",
			id: 'sjcharts-disco-colorBy-colocation',
			value: 'colocation',
			label: 'Co-location'
		}]
	}*/
		]
	},
	{
		label: 'Chromosome',
		settings: [
			{
				key: 'showChr',
				label: 'Show',
				example: true,
				description: 'Show or hide the chromosome track.'
			},
			{
				key: 'chr.width',
				label: 'Width',
				example: 20,
				description: 'The width of the chromosome track.'
			},
			{
				key: 'chr.fontSize',
				label: 'Label Font-Size',
				example: 10,
				description: 'The font-size to use for chromosome labels.'
			}
		]
	}
]
