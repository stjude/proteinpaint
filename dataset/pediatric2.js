const common=require('../src/common')


const cohorthierarchy= [
	{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
	{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
	{k:'diagnosis_subtype_short',label:'Subtype',full:'diagnosis_subtype_full'},
	{k:'diagnosis_subgroup_short',label:'Subgroup',full:'diagnosis_subgroup_full'}
]




const valuePerSample={
	key:'percentage',
	label:'Percentage',
	cutoffValueLst:[
		{side:'>',value:5,label:'>5%'},
		{side:'>',value:10,label:'>10%'},
		{side:'>',value:20,label:'>20%'},
		{side:'>',value:30,label:'>30%'},
		{side:'>',value:40,label:'>40%'}
	]
}


const samplenamekey = 'sample_name'

const sample2tracks = {
	'SJNBL046414_C1-SKNAS':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_SKNAS.inter.hic',
		name:'SJNBL046414_C1 Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	'SJNBL046418_C1-NB69':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_NB69.inter.hic',
		name:'SJNBL046418_C1/SKNAS Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	'SJNBL046420_C1-Kelly':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_Kelly.inter.hic',
		name:'SJNBL046420_C1/Kelly Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	'SJNBL046422_C1-BE2C':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_BE2C.inter.hic',
		name:'SJNBL046422_C1/BE2C Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	'SJNBL046424_C1-NGP':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_NGP.inter.hic',
		name:'SJNBL046424_C1/NGP Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	'SJNBL046426_C1-SH-SY5Y':[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_SH-SY5Y.inter.hic',
		name:'SJNBL046426_C1/SH-SY5Y Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
"SJNBL017071_D1-PAISNS":[{"type":"aicheck","name":"SJNBL017071_D1-PAISNS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAISNS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAIVZR-diagnosis":[{"type":"aicheck","name":"PAIVZR-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAIVZR-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAIXFZ-diagnosis":[{"type":"aicheck","name":"PAIXFZ-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAIXFZ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017092_D1-PAKZRH":[{"type":"aicheck","name":"SJNBL017092_D1-PAKZRH CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAKZRH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PALKXJ-diagnosis":[{"type":"aicheck","name":"PALKXJ-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PALKXJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017106_D1-PALNVP":[{"type":"aicheck","name":"SJNBL017106_D1-PALNVP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PALNVP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017119_D1-PALXTB":[{"type":"aicheck","name":"SJNBL017119_D1-PALXTB CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PALXTB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017130_D1-PAMNLH":[{"type":"aicheck","name":"SJNBL017130_D1-PAMNLH CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAMNLH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017147_D1-PANLET":[{"type":"aicheck","name":"SJNBL017147_D1-PANLET CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PANLET-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017148_D1-PANNMS":[{"type":"aicheck","name":"SJNBL017148_D1-PANNMS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PANNMS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017152_D1-PANRVJ":[{"type":"aicheck","name":"SJNBL017152_D1-PANRVJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PANRVJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017167_D1-PAPCTS":[{"type":"aicheck","name":"SJNBL017167_D1-PAPCTS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPCTS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017168_D1-PAPEAV":[{"type":"aicheck","name":"SJNBL017168_D1-PAPEAV CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPEAV-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017171_D1-PAPICY":[{"type":"aicheck","name":"SJNBL017171_D1-PAPICY CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPICY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017173_D1-PAPKXS":[{"type":"aicheck","name":"SJNBL017173_D1-PAPKXS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPKXS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPSEI-diagnosis":[{"type":"aicheck","name":"PAPSEI-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPSEI-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPSKM-diagnosis":[{"type":"aicheck","name":"PAPSKM-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPSKM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017182_D1-PAPTAN":[{"type":"aicheck","name":"SJNBL017182_D1-PAPTAN CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTAN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017184_D1-PAPTDH":[{"type":"aicheck","name":"SJNBL017184_D1-PAPTDH CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTDH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017185_D1-PAPTFZ":[{"type":"aicheck","name":"SJNBL017185_D1-PAPTFZ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTFZ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPTIP-diagnosis":[{"type":"aicheck","name":"PAPTIP-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTIP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPTLD-diagnosis":[{"type":"aicheck","name":"PAPTLD-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTLD-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017188_D1-PAPTLV":[{"type":"aicheck","name":"SJNBL017188_D1-PAPTLV CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTLV-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPTLY-diagnosis":[{"type":"aicheck","name":"PAPTLY-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTLY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPTMM-diagnosis":[{"type":"aicheck","name":"PAPTMM-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPTMM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017189_D1-PAPUAR":[{"type":"aicheck","name":"SJNBL017189_D1-PAPUAR CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPUAR-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017192_D1-PAPUNH":[{"type":"aicheck","name":"SJNBL017192_D1-PAPUNH CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPUNH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPUTN-diagnosis":[{"type":"aicheck","name":"PAPUTN-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPUTN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017193_D1-PAPUWY":[{"type":"aicheck","name":"SJNBL017193_D1-PAPUWY CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPUWY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPVEB-diagnosis":[{"type":"aicheck","name":"PAPVEB-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPVEB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017194_R1-PAPVEB":[{"type":"aicheck","name":"SJNBL017194_R1-PAPVEB CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPVEB-04A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017195_D1-PAPVFD":[{"type":"aicheck","name":"SJNBL017195_D1-PAPVFD CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPVFD-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017196_D1-PAPVRN":[{"type":"aicheck","name":"SJNBL017196_D1-PAPVRN CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPVRN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017197_D1-PAPVXS":[{"type":"aicheck","name":"SJNBL017197_D1-PAPVXS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPVXS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAPWUC-diagnosis":[{"type":"aicheck","name":"PAPWUC-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPWUC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017201_D1-PAPZYP":[{"type":"aicheck","name":"SJNBL017201_D1-PAPZYP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPZYP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017202_D1-PAPZYZ":[{"type":"aicheck","name":"SJNBL017202_D1-PAPZYZ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAPZYZ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARABN-diagnosis":[{"type":"aicheck","name":"PARABN-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARABN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017204_D1-PARACM":[{"type":"aicheck","name":"SJNBL017204_D1-PARACM CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARACM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017206_D1-PARACS":[{"type":"aicheck","name":"SJNBL017206_D1-PARACS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARACS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARAHE-diagnosis":[{"type":"aicheck","name":"PARAHE-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARAHE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017207_D1-PARAMT":[{"type":"aicheck","name":"SJNBL017207_D1-PARAMT CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARAMT-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017209_D1-PARBAJ":[{"type":"aicheck","name":"SJNBL017209_D1-PARBAJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARBAJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017209_R1-PARBAJ":[{"type":"aicheck","name":"SJNBL017209_R1-PARBAJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARBAJ-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017210_D1-PARBGP":[{"type":"aicheck","name":"SJNBL017210_D1-PARBGP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARBGP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017211_D1-PARBLH":[{"type":"aicheck","name":"SJNBL017211_D1-PARBLH CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARBLH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARCWT-diagnosis":[{"type":"aicheck","name":"PARCWT-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARCWT-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017213_D1-PARDCK":[{"type":"aicheck","name":"SJNBL017213_D1-PARDCK CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARDCK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017214_D1-PARDIW":[{"type":"aicheck","name":"SJNBL017214_D1-PARDIW CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARDIW-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARDUJ-diagnosis":[{"type":"aicheck","name":"PARDUJ-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARDUJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017216_D1-PARDYU":[{"type":"aicheck","name":"SJNBL017216_D1-PARDYU CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARDYU-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PAREGK-diagnosis":[{"type":"aicheck","name":"PAREGK-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAREGK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017218_D1-PARETE":[{"type":"aicheck","name":"SJNBL017218_D1-PARETE CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARETE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017219_D1-PARFRE":[{"type":"aicheck","name":"SJNBL017219_D1-PARFRE CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARFRE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017220_D1-PARFWB":[{"type":"aicheck","name":"SJNBL017220_D1-PARFWB CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARFWB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARGDJ-diagnosis":[{"type":"aicheck","name":"PARGDJ-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARGDJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARGUX-diagnosis":[{"type":"aicheck","name":"PARGUX-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARGUX-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017224_D1-PARHAM":[{"type":"aicheck","name":"SJNBL017224_D1-PARHAM CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARHAM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017224_R1-PARHAM":[{"type":"aicheck","name":"SJNBL017224_R1-PARHAM CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARHAM-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"PARHYL-diagnosis":[{"type":"aicheck","name":"PARHYL-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARHYL-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARIKF-diagnosis":[{"type":"aicheck","name":"PARIKF-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARIKF-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARIRD-diagnosis":[{"type":"aicheck","name":"PARIRD-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARIRD-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017229_D1-PARJVP":[{"type":"aicheck","name":"SJNBL017229_D1-PARJVP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARJVP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARJXH-diagnosis":[{"type":"aicheck","name":"PARJXH-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARJXH-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017231_D1-PARKGJ":[{"type":"aicheck","name":"SJNBL017231_D1-PARKGJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARKGJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARMFA-diagnosis":[{"type":"aicheck","name":"PARMFA-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARMFA-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARMTT-diagnosis":[{"type":"aicheck","name":"PARMTT-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARMTT-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARNCW-diagnosis":[{"type":"aicheck","name":"PARNCW-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARNCW-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARNEE-diagnosis":[{"type":"aicheck","name":"PARNEE-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARNEE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017240_D1-PARNNC":[{"type":"aicheck","name":"SJNBL017240_D1-PARNNC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARNNC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017242_D1-PARNTS":[{"type":"aicheck","name":"SJNBL017242_D1-PARNTS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARNTS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARSEA-diagnosis":[{"type":"aicheck","name":"PARSEA-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARSEA-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017249_D1-PARSRJ":[{"type":"aicheck","name":"SJNBL017249_D1-PARSRJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARSRJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARUXY-diagnosis":[{"type":"aicheck","name":"PARUXY-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARUXY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARVME-diagnosis":[{"type":"aicheck","name":"PARVME-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARVME-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PARXLM-diagnosis":[{"type":"aicheck","name":"PARXLM-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARXLM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017290_D1-PARYNK":[{"type":"aicheck","name":"SJNBL017290_D1-PARYNK CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARYNK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017298_D1-PARZCJ":[{"type":"aicheck","name":"SJNBL017298_D1-PARZCJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARZCJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017298_R1-PARZCJ":[{"type":"aicheck","name":"SJNBL017298_R1-PARZCJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARZCJ-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017299_D1-PARZHA":[{"type":"aicheck","name":"SJNBL017299_D1-PARZHA CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARZHA-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017300_D1-PARZIP":[{"type":"aicheck","name":"SJNBL017300_D1-PARZIP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PARZIP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASATK-diagnosis":[{"type":"aicheck","name":"PASATK-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASATK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASAZJ-diagnosis":[{"type":"aicheck","name":"PASAZJ-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASAZJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASBEN-diagnosis":[{"type":"aicheck","name":"PASBEN-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASBEN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017328_D1-PASCFC":[{"type":"aicheck","name":"SJNBL017328_D1-PASCFC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASCFC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASCHP-diagnosis":[{"type":"aicheck","name":"PASCHP-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASCHP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASCKI-diagnosis":[{"type":"aicheck","name":"PASCKI-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASCKI-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017334_D1-PASCTR":[{"type":"aicheck","name":"SJNBL017334_D1-PASCTR CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASCTR-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASCUF-diagnosis":[{"type":"aicheck","name":"PASCUF-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASCUF-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017343_D1-PASEGA":[{"type":"aicheck","name":"SJNBL017343_D1-PASEGA CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASEGA-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017357_D1-PASFGG":[{"type":"aicheck","name":"SJNBL017357_D1-PASFGG CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASFGG-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017358_D1-PASFIC":[{"type":"aicheck","name":"SJNBL017358_D1-PASFIC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASFIC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017366_D1-PASGAP":[{"type":"aicheck","name":"SJNBL017366_D1-PASGAP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASGAP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017366_R1-PASGAP":[{"type":"aicheck","name":"SJNBL017366_R1-PASGAP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASGAP-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017376_D1-PASGUT":[{"type":"aicheck","name":"SJNBL017376_D1-PASGUT CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASGUT-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017377_D1-PASHFA":[{"type":"aicheck","name":"SJNBL017377_D1-PASHFA CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASHFA-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASHFA-relapse":[{"type":"aicheck","name":"PASHFA-relapse CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASHFA-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"PASJYB-diagnosis":[{"type":"aicheck","name":"PASJYB-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASJYB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017383_D1-PASJZC":[{"type":"aicheck","name":"SJNBL017383_D1-PASJZC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASJZC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASKJX-diagnosis":[{"type":"aicheck","name":"PASKJX-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASKJX-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017402_D1-PASLGS":[{"type":"aicheck","name":"SJNBL017402_D1-PASLGS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASLGS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017413_D1-PASMDM":[{"type":"aicheck","name":"SJNBL017413_D1-PASMDM CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASMDM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017421_D1-PASNEF":[{"type":"aicheck","name":"SJNBL017421_D1-PASNEF CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASNEF-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017423_D1-PASNML":[{"type":"aicheck","name":"SJNBL017423_D1-PASNML CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASNML-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017424_D1-PASNPG":[{"type":"aicheck","name":"SJNBL017424_D1-PASNPG CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASNPG-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017424_R1-PASNPG":[{"type":"aicheck","name":"SJNBL017424_R1-PASNPG CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASNPG-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017428_D1-PASNZU":[{"type":"aicheck","name":"SJNBL017428_D1-PASNZU CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASNZU-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017430_D1-PASPBZ":[{"type":"aicheck","name":"SJNBL017430_D1-PASPBZ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASPBZ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017431_D1-PASPER":[{"type":"aicheck","name":"SJNBL017431_D1-PASPER CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASPER-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PASREY-diagnosis":[{"type":"aicheck","name":"PASREY-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASREY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017440_D1-PASRFS":[{"type":"aicheck","name":"SJNBL017440_D1-PASRFS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASRFS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017451_D1-PASSRN":[{"type":"aicheck","name":"SJNBL017451_D1-PASSRN CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASSRN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017452_D1-PASSRS":[{"type":"aicheck","name":"SJNBL017452_D1-PASSRS CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASSRS-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017455_D1-PASSWW":[{"type":"aicheck","name":"SJNBL017455_D1-PASSWW CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASSWW-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017458_D1-PASTCN":[{"type":"aicheck","name":"SJNBL017458_D1-PASTCN CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASTCN-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017464_D1-PASTKC":[{"type":"aicheck","name":"SJNBL017464_D1-PASTKC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASTKC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017474_D1-PASUCB":[{"type":"aicheck","name":"SJNBL017474_D1-PASUCB CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASUCB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017480_D1-PASUML":[{"type":"aicheck","name":"SJNBL017480_D1-PASUML CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASUML-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017483_D1-PASUYG":[{"type":"aicheck","name":"SJNBL017483_D1-PASUYG CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASUYG-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017487_D1-PASVRU":[{"type":"aicheck","name":"SJNBL017487_D1-PASVRU CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASVRU-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017494_D1-PASWIJ":[{"type":"aicheck","name":"SJNBL017494_D1-PASWIJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASWIJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017501_D1-PASWVY":[{"type":"aicheck","name":"SJNBL017501_D1-PASWVY CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASWVY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017503_D1-PASWYR":[{"type":"aicheck","name":"SJNBL017503_D1-PASWYR CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASWYR-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017506_D1-PASXHE":[{"type":"aicheck","name":"SJNBL017506_D1-PASXHE CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASXHE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017507_D1-PASXIE":[{"type":"aicheck","name":"SJNBL017507_D1-PASXIE CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASXIE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017510_D1-PASXRG":[{"type":"aicheck","name":"SJNBL017510_D1-PASXRG CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASXRG-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017515_D1-PASYLD":[{"type":"aicheck","name":"SJNBL017515_D1-PASYLD CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASYLD-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017517_D1-PASYPX":[{"type":"aicheck","name":"SJNBL017517_D1-PASYPX CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASYPX-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017525_D1-PASZKE":[{"type":"aicheck","name":"SJNBL017525_D1-PASZKE CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PASZKE-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017535_D1-PATAYJ":[{"type":"aicheck","name":"SJNBL017535_D1-PATAYJ CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATAYJ-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017540_D1-PATBMM":[{"type":"aicheck","name":"SJNBL017540_D1-PATBMM CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATBMM-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017545_D1-PATCFL":[{"type":"aicheck","name":"SJNBL017545_D1-PATCFL CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATCFL-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017555_D1-PATDXC":[{"type":"aicheck","name":"SJNBL017555_D1-PATDXC CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATDXC-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017559_D1-PATEPF":[{"type":"aicheck","name":"SJNBL017559_D1-PATEPF CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATEPF-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017560_D1-PATESI":[{"type":"aicheck","name":"SJNBL017560_D1-PATESI CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATESI-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017563_D1-PATFCY":[{"type":"aicheck","name":"SJNBL017563_D1-PATFCY CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATFCY-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017571_D1-PATFXV":[{"type":"aicheck","name":"SJNBL017571_D1-PATFXV CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATFXV-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017572_D1-PATGJU":[{"type":"aicheck","name":"SJNBL017572_D1-PATGJU CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATGJU-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017573_D1-PATGLU":[{"type":"aicheck","name":"SJNBL017573_D1-PATGLU CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATGLU-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017574_D1-PATGWT":[{"type":"aicheck","name":"SJNBL017574_D1-PATGWT CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATGWT-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017578_D1-PATHKB":[{"type":"aicheck","name":"SJNBL017578_D1-PATHKB CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATHKB-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017580_D1-PATHVK":[{"type":"aicheck","name":"SJNBL017580_D1-PATHVK CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATHVK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"PATNKP-diagnosis":[{"type":"aicheck","name":"PATNKP-diagnosis CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATNKP-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017619_R1-PATNKP":[{"type":"aicheck","name":"SJNBL017619_R1-PATNKP CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATNKP-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017701_D1-PATYIL":[{"type":"aicheck","name":"SJNBL017701_D1-PATYIL CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATYIL-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017701_R1-PATYIL":[{"type":"aicheck","name":"SJNBL017701_R1-PATYIL CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PATYIL-02A-01D_NormalVsRecurrent.maf.txt.gz"}],"SJNBL017731_D1-PAUDDK":[{"type":"aicheck","name":"SJNBL017731_D1-PAUDDK CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAUDDK-01A-01D_NormalVsPrimary.maf.txt.gz"}],"SJNBL017731_R1-PAUDDK":[{"type":"aicheck","name":"SJNBL017731_R1-PAUDDK CGI aicheck","file":"hg19/TARGET/DNA/ai/nbl-cgi/fullMaf_TARGET-30-PAUDDK-02A-01D_NormalVsRecurrent.maf.txt.gz"}]
}


module.exports={

	genome:'hg19',
	isMds:true,
	about:[
		{k:'RNA splice junction',v:'RNA splice junctions'},
		{k:'CNV-SV',v:'Copy number variation events with supporting structural variation and gene expression ranking'}
	],
	dbFile:'anno/db/pediatric.hg19.db',

	sample2tracks:sample2tracks,

	cohort:{
		files:[
			// possible to have file-specific logic
			{file:'anno/db/pediatric.samples'},
			{file:'anno/db/target.samples'},
			{file:'anno/db/target.samples.tallsnp6array'},
			{file:'anno/db/nbl.cellline.samples'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		hierarchies:{
			lst:[
				{
					name:'Cancer',
					levels:cohorthierarchy
				}
			]
		},
		/*
		attributes:{
			lst:[
				{key:'diagnosis_group_short',label:'Cancer group',
					values:{
						BT:{label:"Brain Tumor"},
						HM:{label:"Hematopoietic Malignancies"},
						ST:{label:"Solid Tumor"},
					}
				},
				// cut -f6,7 ~/data/tp/anno/db/pediatric.samples|sort -u|awk '{FS="\t";printf("{%s:{label:\"%s\"}},\n"),$1,$2}'
				{key:'diagnosis_short',label:'Cancer type',
					values:{
						ACT:{label:"Adrenocortical Carcinoma"},
						AML:{label:"Acute Myeloid Leukemia"},
						BALL:{label:"B-cell Acute Lymphoblastic Leukemia"},
						CPC:{label:"Choroid Plexus Carcinoma"},
						EPD:{label:"Ependymoma"},
						EWS:{label:"Ewing's sarcoma"},
						HGG:{label:"High Grade Glioma"},
						LGG:{label:"Low Grade Glioma"},
						MB:{label:"Medulloblastoma"},
						MEL:{label:"Melanoma"},
						MLL:{label:"Mixed Lineage Leukemia"},
						NBL:{label:"Neuroblastoma"},
						OS:{label:"Osteosarcoma"},
						RB:{label:"Retinoblastoma"},
						RHB:{label:"Rhabdosarcoma"},
						TALL:{label:"T-cell Acute Lymphoblastic Leukemia"},
						WLM:{label:"Wilms' tumor"},
					}
				},
			],
			defaulthidden:{
				// only for sample annotations
				diagnosis_short:{
					BALL:1
				}
			}
		}
		*/
	},

	queries:{
		svcnv:{
			name:'Pediatric tumor somatic CNV+SV+LOH',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/Pediatric/pediatric.svcnv.hg19.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:10000000,

			sortsamplebyhierarchy: {
				hierarchyidx:0, // array index of cohort.hierarchies.lst[]
				// TODO which level to look at
			},
			expressionrank_querykey:'genefpkm'
		},
		genefpkm:{
			name:'Pediatric tumor RNA-seq gene FPKM',
			isgenenumeric:true,
			file:'hg19/Pediatric/pediatric.fpkm.hg19.gz',
			datatype:'FPKM',
			
			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,

			boxplotbyhierarchy:{
				hierarchyidx:0
			},
			// yu's data & method for ase/outlier
			ase:{
				qvalue:0.05,
				meandelta_monoallelic:0.3,
				asemarkernumber_biallelic:0,
				meandelta_biallelic:0.1,
				color_noinfo:'#858585',
				color_notsure:'#A8E0B5',
				color_biallelic:'#40859C',
				color_monoallelic:'#d95f02'
			},
			outlier:{
				pvalue:0.05,
				color:'#FF8875'
			}
		},
		junction: {
			name:'PCGP tumor RNA splice junction',
			istrack:true,
			type:common.tkt.mdsjunction,
			viewrangeupperlimit:500000,
			readcountCutoff:5,
			file:'hg19/PCGP/junction/junction.gz',
			infoFilter:{ // client handles junction-level attributes
				lst:[
					{
						key:'type',
						label:'Type',
						categories:{
							canonical:{
								label:'Canonical',
								color:'#0C72A8'
							},
							exonskip:{
								label:'Exon skipping',
								color:'#D14747',
								valuePerSample:valuePerSample
							},
							exonaltuse:{
								label:'Exon alternative usage',
								color:'#E69525',
								valuePerSample:valuePerSample
							},
							a5ss:{
								label:'Alternative 5\' splice site',
								color:'#476CD1',
								valuePerSample:valuePerSample
							},
							a3ss:{
								label:'Alternative 3\' splice site',
								color:'#47B582',
								valuePerSample:valuePerSample
							},
							Unannotated:{
								label:'Not annotated',
								color:'#787854'
							}
						},
						hiddenCategories:{Unannotated:1}
					}
				]
			},
			singlejunctionsummary:{
				readcountboxplotpercohort:{
					// categorical attributes only
					groups:[
						{label:'Cancer group',key:'diagnosis_group_short'},
						{label:'Cancer', key:'diagnosis_short'}
					]
				}
			}
		}
	}
}
