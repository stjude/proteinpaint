export default function discoDefaults(overrides = {}) {
	return Object.assign(
		{
			showControls: false,
			showUpload: false,
			svgIsClosable: false,
			svgw: 1300,
			numSamples: 1,
			selectedSamples: [],
			innerRadius: 180,
			layerScaler: 1,
			padAngle: 0.01, //0.01, //0.04,
			defaultGeneAngle: 0.01,
			clickedChromosome: 0,
			chromosomeType: 'human',
			sampletypes: '', //'DIAGNOSIS',
			minHits: -1,
			showSVs: true,
			showCNVs: true,
			showLOH: true,
			showSNVs: true,
			showChr: true,
			showLabels: true,
			hiddenChromosomes: [],
			gene: {
				alwaysLabel: '', // 'NOTCH1,ATRX,H3F3A,TP53,ABL1,PAX5,KRAS,NRAS,RB1,ALK,DUX4,RUNX1,BRAF,FGFR1,PIK3CA,ETV6,ACVR1,RELA,MYC,MYCN', //'TP53,H3F3A,RELA,MYC,MYCN',
				filterOut: '', // 'C11orf95,RCSD1,DMD,IGLL5,GGTLC2,ZNF280A,FRAME,VPREB1,PRMT2,DIP2A,ETS2,RBM11,KCNJ15,LAMA5,ZNF146,ZNF260,ZNF560,ZNF521,PLEKHM1,NUTM1,FMN1,PAPOLA,RAD51B,ACIN1,PPFIA2,ARID2,USP2,BRCA2,SLC44A1,LINCO01507,CBWD5,ZNF658,ZCCHC7,ELAVL2,DMRTA1,MATP,DOC8,CBWD1,KANK1,ZC3HAV1,ERS1,PNRC1,HLA-B,PCDHGC3,REST,SMIM20,PEX5L,DNAJC19,KCNMB3,TPG,ADGRG7,CCDC12,FYCO1,TMEM49,TTN,TSN,RCSD1,AMY1A,OLFM3,AGL,DOCK8,LINC01507,CRIP2,ARHGAP27,FRAME,ZNF280B,ZNF566,TFG,MTAP',
				queryPositions: false
			},
			label: {
				gap: 0,
				width: 0,
				labelGap: 20,
				labelFill: 'rgb(33,113,181)',
				tickGap: 2,
				fontSize: 12,
				uncollide: true,
				colorBy: 'variant-class'
			},
			snv: {
				gap: 0,
				width: 40,
				byClassWidth: 20,
				labelGap: 0,
				labelFill: 'rgb(33,113,181)',
				tickGap: 2,
				fontSize: 12,
				minHits: 1,
				minHitsForLabel: -1,
				unit: 'pct' // pct | abs | log
			},
			non_exonic: {
				gap: 0,
				width: 50,
				byClassWidth: 30,
				labelGap: 0,
				labelFill: 'rgb(33,113,181)',
				tickGap: 2,
				fontSize: 12,
				minHits: 1,
				minHitsForLabel: -1
			},
			cnv: {
				type: 'bar',
				split: false,
				gap: 0,
				width: 40,
				labelGap: 6,
				labelFill: 'rgb(65,171,93)',
				minValueCutoff: 0.2,
				minHits: 1,
				minHitsForLabel: -1,
				minHeightRatio: 2,
				colors: ['#67a9cf', '#D6683C'],
				mirrorScale: true,
				showGrid: false,
				gridNumLevels: 4,
				gridFontSize: 12,
				gridLabelRotate: 0,
				gridLabelSpan: 7,
				gridLabelStartOffset: 20,
				gridLabelFill: '#fff'
			},
			loh: {
				type: 'chromatic',
				split: false,
				gap: 0,
				width: 20,
				fill: '#000',
				labelGap: 6,
				labelFill: 'rgb(65,171,93)',
				minHits: 1,
				minHitsForLabel: -1,
				minHeightRatio: 2,
				showGrid: false,
				gridNumLevels: 4,
				gridFontSize: 10,
				gridLabelRotate: 0,
				gridLabelSpan: 9,
				gridLabelStartOffset: 20,
				gridLabelFill: '#fff'
			},
			chr: {
				gap: 0,
				width: 20,
				fontSize: 12,
				labelGap: 10
			},
			sv: {
				fusionOnly: true,
				fillOpacity: 0.5,
				strokeOpacity: 0.5,
				labelFill: 'rgb(215,48,31)',
				//colors: '	#bcbddc,#3f007d',
				// either a colorbrewer key.# or hexColorMin, hexColorMax
				colors: '#fed976,#e31a1c',
				minHits: 1,
				minHitsForLabel: 10,
				colorBy: 'count'
			},
			padding: 20,
			titleFontSize: 12,
			symmetricLinkVals: false,
			dataName: ''
			// window.location.hash ? window.location.hash.substr(1)
			// : 'HM|BALL|PH-LIKE|PH-LIKE - NOS'
			//: 'HM|BALL|DUX4-ERG|ERG_wt'
			//: 'SJERG014_D'
			// example hash
			// #HM|BALL|PH-LIKE|PH-LIKE - NOS
			// #SJERG014_D
		},
		overrides
	)
}
