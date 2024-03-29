export default class Labels {
	MAX_LABELS_TO_DISPLAY = 97

	constructor(app) {
		this.app = app
		this.geneArcs = {}
	}

	setGeneArcs(geneArcs, alias) {
		if (!geneArcs) return
		for (const gene in geneArcs) {
			if (!(gene in this.geneArcs)) {
				this.geneArcs[gene] = []
				// assign tracker properties to this array
				this.geneArcs[gene].variantTypes = {}
			}
			const ga = this.geneArcs[gene]
			ga.push(...geneArcs[gene])
			geneArcs[gene].forEach(d => {
				const type = d.class ? d.class : alias
				if (!ga.variantTypes[d.class]) ga.variantTypes[type] = 0
				ga.variantTypes[type] += 1
			})
		}
	}

	getTopGenes() {
		const numHitsBins = {}
		const geneLabeledData = []
		for (const gene in this.geneArcs) {
			if (!gene.startsWith('chr') && gene[4] != ':' && gene[5] != ':') {
				const n = this.geneArcs[gene].length
				if (!(n in numHitsBins)) {
					numHitsBins[n] = []
				}
				numHitsBins[n].push(gene)
				geneLabeledData.push(this.geneArcs[gene])
			}
		}

		const numHits = Object.keys(numHitsBins)
			.map(num => +num)
			.sort((a, b) => b - a)
		let prevCount = 0,
			labelCount = 0
		let minHits = 0,
			geneList = []
		for (let i = 0; i < numHits.length; i++) {
			const n = numHits[i]
			const numGenes = numHitsBins[n].length
			labelCount += numGenes
			if (labelCount < 50) {
				minHits = n
				prevCount = labelCount
			} else if (prevCount < 50) {
				numHitsBins[n].forEach(gene => {
					if (cancerGenes.includes(gene)) {
						geneList.push(gene)
						prevCount += 1
					}
				})
			} else {
				break
			}
		}

		const topGenes = geneLabeledData.filter(d => d.length >= minHits || geneList.includes(d[0].gene))

		return topGenes.length > this.MAX_LABELS_TO_DISPLAY ? topGenes.slice(0, this.MAX_LABELS_TO_DISPLAY - 1) : topGenes
	}

	setLayer(plot, arcs) {
		const s = this.app.settings
		if (!s.showLabels) return
		const chord = []
		//const minMax = d3extent(Object.values(this.app.hits.byGene))
		chord.groups = []
		const innerRadius = plot.lastRadius //+ s.gene.gap
		const outerRadius = innerRadius + s.label.width

		this.getTopGenes().forEach(arc => {
			const data = arc[0]
			const g = data.gene

			//if (s.clickedChromosome && s.clickedChromosome!=arc.chromosome
			//&& !this.fusedToGeneInClickedChr.includes(g)) return;

			const label = data.label ? data.label : g
			if (label) {
				const d = {
					startAngle: data.startAngle, // + padAngle,
					endAngle: data.endAngle, // - padAngle,
					innerRadius: innerRadius,
					outerRadius: outerRadius,
					labelRadius: outerRadius + s.label.labelGap * s.layerScaler,
					value: 1,
					// index: i,
					label: g, //rowsByGene[g].filter(d=>d.class=='Fuser' || (d.classification && d.classification!='NONE')).length ? g : '',
					gene: g,
					layerNum: 0,
					chromosome: data.chromosome,
					class: data.class,
					aachange: data.aachange,
					d: data,
					sample: data.sample,
					hits: arc.length
				}

				this.setCountText(d)
				chord.groups.push(d)

				if (s.label.colorBy == 'variant-class') {
					const types = Object.keys(this.geneArcs[g].variantTypes).sort((a, b) => {
						return this.geneArcs[g].variantTypes[b] - this.geneArcs[g].variantTypes[a]
					})
					const mainType = types[0]
					d.labelFill = mainType in this.app.mlabel ? this.app.mlabel[mainType].color : '#aaa'
				}
			}
		})

		plot.layers.push({
			labels: true,
			labelsUncollide: s.label.uncollide,
			tickGap: s.label.tickGap, // d=>s.gene.tickGap*this.hitsByGene[d.gene]/minMax[1],
			arcs: false,
			radii: {
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				labelRadius: outerRadius + s.label.labelGap * s.layerScaler
			},
			fontSize: s.label.fontSize,
			labelFill: d => this.fillByVariantCategory(d),
			//labelFill: d=>this.snvFill(d),
			chord: chord,
			tipHtml: d => {
				const color = '#000' //this.snvFill(d)
				if (!d.countText) this.setCountText(d)

				//const cls=
				return (
					"<span style='color:" +
					color +
					"'>" +
					'<b>' +
					d.gene +
					'</b><br/>chr' +
					d.chromosome +
					//+(d.aachange ? '<br/>'+d.aachange : '')
					//+(d.class=='Fuser' ? '<br/>'+(d.endpts) : '')
					d.countText +
					'</span>'
				)
			}
		})
	}

	snvFill(d) {
		return d.class && this.app.mlabel[d.class] ? this.app.mlabel[d.class].color : '#aaa'
	}

	fillByVariantCategory(d) {
		return d.labelFill ? d.labelFill : '#000'
	}

	setCountText(d) {
		let counts = {}
		let mainClsColor
		for (const key in d.hits) {
			if (key == 'byCls') {
				counts.byCls = ''
				const keys = Object.keys(d.hits.byCls)
				keys.sort((a, b) => {
					return d.hits.byCls[a].length > d.hits.byCls[b].length
						? -1
						: d.hits.byCls[a].length < d.hits.byCls[b].length
						? 1
						: 0
				})
				keys.forEach(k => {
					if (d.hits.byCls[k].length) {
						const color = mlabel[k] ? mlabel[k].color : '#000'
						counts.byCls +=
							'<br/>' +
							'<span style="color:' +
							color +
							'">' +
							(mlabel[k] ? mlabel[k].label : k) +
							': ' +
							d.hits.byCls[k].length +
							'</span>'
					}
				})
			} else if (d.hits[key].length) {
				const color = this.settings[key] ? this.settings[key].labelFill : '#000'
				const cls = key == 'snv' ? 'SNV-Indel' : key == 'cnv' ? 'Copy Number' : 'Structural'
				counts[key] = '<br/><b style="color:' + color + '">' + cls + '</b>: ' + d.hits[key].length
			}
		}

		const keys = Object.keys(counts)
		keys.sort((a, b) => {
			return a == 'byCls'
				? 1
				: b == 'byCls'
				? -1
				: d.hits[a].length > d.hits[b].length
				? -1
				: d.hits[a].length < d.hits[b].length
				? 1
				: a == 'sv'
				? -1
				: b == 'sv'
				? 1
				: a == 'cnv'
				? -1
				: b == 'cnv'
				? 1
				: 0
		})
		/*d.countText=''
  		keys.forEach(key=>{
  			if (key=='byCls') return;
  			d.countText += counts[key]
  			if (key=='snv') d.countText += counts.byCls
  		})*/
		d.countText = counts.byCls
		d.labelFill = this.app.settings[keys[0]] ? this.app.settings[keys[0]].labelFill : '#000'
	}
}

const cancerGenes = `MLLT11
TPM3
HAX1
MUC1
LMNA
PRCC
NTRK1
FCRL4
SDHC
FCGR2B
PBX1
PRRX1
SDHB
ABL2
TPR
PAX7
CDC73
CACNA1S
TNNT2
MDM4
ELK4
SLC45A3
PINK1
DUSP10
H3F3A
RYR2
MDS2
RPL11
FH
TNFRSF14
ARID1A
PRDM16
LCK
SFPQ
THRAP3
MYCL1
MPL
MUTYH
TAL1
CDKN2C
EPS15
PCSK9
JUN
RPL22
JAK1
CAMTA1
FUBP1
BCL10
RPL5
TLX1
NFKB2
SUFU
VTI1A
TCF7L2
FGFR2
DUX4
MLLT10
ABI1
KIF5B
KLF6
RET
NCOA4
CCDC6
ARID5B
TET1
PRF1
KAT6B
RPS24
GATA3
NUTM2B
BMPR1A
FAM22A
PTEN
ACTA2
FAS
BIRC3
ATM
DDX10
C11orf93
POU2AF1
SDHD
ZBTB16
PAFAH1B2
PCSK7
MLL
DDX6
CBL
ARHGEF12
FLI1
FANCF
KCNQ1
CARS
WT1
LMO2
NUP98
EXT2
CREB3L1
DDB2
MYBPC3
HRAS
CLP1
SDHAF2
MEN1
MALAT1
CCND1
NUMA1
POLD3
LMO1
PICALM
MRE11A
MAML2
ERC1
MYL2
SH2B3
ALDH2
PTPN11
ETV6
HNF1A
BCL7A
POLE
KRAS
PKP2
KDM5A
CCND2
ARID2
MLL2
DIP2B
ATF1
HOXC13
HOXC11
PMEL
NACA
DDIT3
CDK4
LRIG3
WIF1
HMGA2
ZNF384
MDM2
BTG1
ERCC5
ZMYM2
CDX2
FLT3
BRCA2
LHFP
FOXO1
LCP1
RB1
HSP90AA1
AKT1
CCNB1IP1
MYH7
TINF2
NKX2-1
FANCM
NIN
BMP4
KTN1
GPHN
RAD51B
TSHR
TRIP11
GOLGA5
DICER1
TCL6
TCL1A
BCL11B
SCG5
GREM1
NOP10
C15orf55
ACTC1
BUB1B
CASC5
HMGN2P46
FBN1
FLJ27352
TCF12
TPM1
MAP2K1
SMAD3
PML
RPS17
NTRK3
FANCI
IDH2
CRTC3
BLM
CIITA
SOCS1
RMI2
TNFRSF17
SNX29
ERCC4
MYH11
TSC2
PALB2
IL21R
FUS
CREBBP
CYLD
HERPUD1
CDH11
CBFB
CDH1
MAF
CBFA2T3
FANCA
MAP2K4
YWHAE
FLCN
SPECC1
NF1
SUZ12
TAF15
MLLT6
LASP1
CDK12
ERBB2
RARA
BRCA1
ETV4
G6PC3
COL1A1
USP6
RABEP1
HLF
MSI2
RAD51C
CLTC
BRIP1
CD79B
DDX5
AXIN2
PRKAR1A
SRSF2
SEPT9
TP53
CANT1
RNF213
ASPSCR1
PER1
GAS7
ZNF521
SS18
DSC2
DSG2
SMAD7
SMAD4
MALT1
BCL2
KDSR
DNM2
SMARCA4
LDLR
STK11
LYL1
BRD4
TCF3
TPM4
JAK3
ELL
CRTC1
CCNE1
GNA11
RHPN2
CEBPA
RYR1
AKT2
MAP2K2
RPS19
CD79A
CIC
SH3GL1
BCL3
CBLC
ERCC2
POLD1
KLK2
PPP2R1A
ZNF331
TFPT
TNNI3
MLLT1
FSTL3
ELANE
AFF3
TTL
PAX8
ERCC3
MYCN
CHN1
HOXD13
HOXD11
NFE2L2
COL3A1
PMS1
SF3B1
CREB1
IDH1
APOB
BARD1
ATIC
FEV
PAX3
ACSL3
CXCR7
C2orf44
NCOA1
DNMT3A
ALK
RPS7
SOS1
EML4
EPCAM
MSH2
MSH6
FBXO11
FANCL
BCL11A
REL
XPO1
ASXL1
MAFB
TOP1
SDC4
GNAS
SS18L1
LAMA5
OLIG2
RUNX1
ERG
TMPRSS2
U2AF1
CLTCL1
SEPT5
BCR
SMARCB1
MN1
CHEK2
EWSR1
NF2
PATZ1
MYH9
PDGFB
MKL1
EP300
TFG
FANCD2
VHL
CBLB
PPARG
MYLK
RAF1
GATA2
RPN1
CNBP
FOXL2
TMEM43
XPC
WWTR1
GMPS
MLF1
MECOM
TERC
MYNN
PIK3CA
SOX2
ETV5
EIF4A2
BCL6
LPP
TFRC
RPL35A
TGFBR2
MLH1
MYD88
SCN5A
CTNNB1
MYL3
SETD2
CDC25A
NCKIPSD
BAP1
PBRM1
FHIT
MITF
FOXP1
SRGAP3
TET2
GAR1
IL2
FBXW7
FGFR3
WHSC1
SLC34A2
RHOH
PHOX2B
FIP1L1
CHIC2
PDGFRA
KIT
KDR
AFF1
RAP1GDS1
APC
TERT
ACSL6
AFF4
ARHGAP26
PDGFRB
CD74
ITK
EBF1
RANBP17
TLX3
NPM1
NSD1
NHP2
IL7R
LIFR
IL6ST
PIK3R1
PRDM1
FOXO3
ROS1
GOPC
STL
MYB
TNFAIP3
ECT2L
EZR
IGF2R
FGFR1OP
MLLT4
DEK
HIST1H4I
TRIM27
POU5F1
DAXX
HMGA1
FANCE
SRSF3
CDKN1A
PIM1
IRF4
TFEB
CCND3
HSP90AB1
DSP
MET
SMO
CREB3L2
TRIM24
KIAA1549
ETV1
BRAF
EZH2
KCNH2
PRKAG2
MLL3
MNX1
HNRNPA2B1
HOXA9
HOXA11
HOXA13
JAZF1
CARD11
IKZF1
EGFR
PMS2
SBDS
ELN
HIP1
AKAP9
CDK6
COX6C
EIF3H
EXT1
MYC
NDRG1
RECQL4
PCM1
WRN
WHSC1L1
FGFR1
KAT6A
HOOK3
TCEA1
PLAG1
CHCHD7
NCOA2
HEY1
NBN
NBS1
RUNX1T1
XPA
TGFBR1
NR4A3
TAL2
CNTRL
SET
FNBP1
ABL1
NUP214
TSC1
RALGDS
BRD3
NOTCH1
NFIB
PSIP1
MLLT3
CDKN2A
FANCG
PAX5
JAK2
CD274
PDCD1LG2
GNAQ
SYK
OMD
FANCC
PTCH1
GLA
SEPT6
ELF4
CRLF2
GPC3
PHF6
FANCB
DKC1
MTCP1
P2RY8
ZRSR2
BCOR
KDM6A
SSX1
SSX4
WAS
GATA1
TFE3
SSX2
KDM5C
SMC1A
AMER1
MSN
FOXO4
MED12
NONO
ATRX
SHROOM2
TRG
TRD
TRB
TRA
IGL
IGK
IGH
SHOC2
CDKN1C
NPAT
RAG1
RAG2
NRAS
KMT2A
KMT2D
USP9X
ZNF217
CTCF
WAC
MGA
CD200
XBP1
ADD3
TOX
ELF1
MEF2D
TBL1XR1
INO80
LEMD3
ATF7IP
ASXL2
ZFP36L2
LEF1
DDX3X
CDKN1B
USP7
RPL10
TCF7
PTPN2
EED
STAT5B
CNOT3
BAZ1A
ZBTB7A
TSPYL2
PIK3CD
NCOR1
DHX15
CSF3R
GLIS2
SMC3
SHANK2
PTPRD
DROSHA
SIX1
DGCR8
IKZF3
ACTB
HDAC7
BCORL1
STAG2
NIPBL
HOXA10
UBA2
ZMIZ1
CHD4
FBXO28
SIX2
GNB1
ZEB2
MAX
RIT1
GNB2
RBM15
U2AF2
HOXB8
UBTF
HDAC9
RBM10
TRRAP
SPOP
ETS2
CDH4
NR3C2
NR3C1
EPOR
KMT2E
TET3
CHD7
ID4
KMT2C
GIGYF2
MAP3K4
PDS5B
MTOR
RAD21
NUTM1
STAG1
SDHA
HIST1H3C
TUSC7
YAP1
KMT2B
USP9Y
IKZF2
PTPRC
CDKN2B
IL9R
SPI1
UTY
RLIM
GATA4
XPO5
DIS3L2
PDS5A`.split('\n')
