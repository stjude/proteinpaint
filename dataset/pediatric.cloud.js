const samplenamekey = 'sample_name'

module.exports = {
	genome: 'hg38',
	isMds: true,

	cohort: {
		db: { file: 'files/hg38/pediatric.cloud/tSNE/db' },
		termdb: {},
		files: [{ file: 'files/hg38/pediatric.cloud/tSNE/table' }],
		samplenamekey,
		tohash: (item, ds) => {
			const n = item[samplenamekey]
			if (ds.cohort.annotation[n]) {
				for (const k in item) {
					ds.cohort.annotation[n][k] = item[k]
				}
			} else {
				ds.cohort.annotation[n] = item
			}
		},
		sampleAttribute: {
			attributes: {
				x: { label: 'X', isfloat: 1, clientnoshow: 1 },
				y: { label: 'Y', isfloat: 1, clientnoshow: 1 },
				diagnosis_name: { label: 'Diagnosis name' },
				diagnosis_group: {
					label: 'Diagnosis group',
					filter: 1,
					values: {
						'Hematologic Malignancy': { color: '#db6042' },
						'Solid Tumor': { color: '#dba842' },
						'Brain Tumor': { color: '#4287db' }
					}
				},
				agedx: { label: 'Age at diagnosis (year)', isfloat: 1 },
				ethnicity: { label: 'Ethnicity' },
				race: { label: 'Race' },
				sex: { label: 'Sex' },
				diagnosis: {
					label: 'Diagnosis',
					filter: 1,
					values: {
						ACC: {
							color: '#66C2A6'
						},
						ALCL: {
							color: '#f9779d'
						},
						AML: {
							color: '#00c0ff'
						},
						APLPMLRARA: {
							color: '#ffa500'
						},
						BALLHYPER: {
							color: '#3E9F32'
						},
						AMKL: {
							color: '#008cff'
						},
						RCC: {
							color: '#eb1414'
						},
						ASPS: {
							color: '#d3d3d3'
						},
						BALLTCF3PBX1: {
							color: '#c8a2c8'
						},
						BALLBCRABL1L: {
							color: '#9759d5'
						},
						BALLPAX5P80R: {
							color: '#ffa500'
						},
						BALLNOS: {
							color: '#d3d3d3'
						},
						BALLPAX5: {
							color: '#e88c38'
						},
						BALLZNF384: {
							color: '#A8DD00'
						},
						BALLMEF2D: {
							color: '#66C2A6'
						},
						BALLDUX4IGH: {
							color: '#696969'
						},
						BALLIAMP21: {
							color: '#0000ff'
						},
						BALLIGHCEBPD: {
							color: '#d3d3d3'
						},
						BALLETV6RUNX1L: {
							color: '#d3d3d3'
						},
						BALLBCRABL1: {
							color: '#ff00ff'
						},
						BALLZNF384L: {
							color: '#d3d3d3'
						},
						BALLKMT2A: {
							color: '#7cfc00'
						},
						BALLMYC: {
							color: '#d3d3d3'
						},
						BALLHYPO: {
							color: '#483d8b'
						},
						BALLETV6RUNX1: {
							color: '#ffd700'
						},
						BALL: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						HGGNOS: {
							color: '#0006c2'
						},
						MBT: {
							color: '#d3d3d3'
						},
						ACPG: {
							color: 'red'
						},
						MNG: {
							color: '#8b0000'
						},
						HGNET: {
							color: '#8fb90a'
						},
						EBMT: {
							color: '#ff7b29'
						},
						GNG: {
							color: 'white'
						},
						BGCT: {
							color: 'white'
						},
						ATRT: {
							color: '#f9779d'
						},
						PBL: {
							color: '#d3d3d3'
						},
						BMGCT: {
							color: 'white'
						},
						CPC: {
							color: '#ffd700'
						},
						ETMR: {
							color: '#ff7b29'
						},
						BT: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						CBF: {
							color: '#00c0ff'
						},
						CML: {
							color: '#d3d3d3'
						},
						DSRCT: {
							color: '#daa520'
						},
						EPMTSU: {
							color: '#c042ff'
						},
						EPMTPF: {
							color: '#ff00ff'
						},
						EPMT: {
							color: '#ffccff'
						},
						MPEPF: {
							color: '#ff00ff'
						},
						MEPMST: {
							color: '#ffccff'
						},
						MPE: {
							color: '#ffccff'
						},
						BALLDUX4IGHL: {
							color: '#d3d3d3'
						},
						EWS: {
							color: '#d277f3'
						},
						GIST: {
							color: '#d3d3d3'
						},
						HGG: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						ALAL: {
							color: 'black'
						},
						TLL: {
							color: '#d3d3d3'
						},
						MDS: {
							color: '#d3d3d3'
						},
						HM: {
							color: '#d3d3d3'
						},
						BL: {
							color: '#d3d3d3'
						},
						MS: {
							color: '#d3d3d3'
						},
						BCUP: {
							color: '#d3d3d3'
						},
						DLBCLNOS: {
							color: '#d3d3d3'
						},
						IFS: {
							color: '#d3d3d3'
						},
						TALLKMT2A: {
							color: 'red'
						},
						BALLNUTM1: {
							color: '#8b0000'
						},
						TALL: {
							color: 'red'
						},
						LGGNOS: {
							color: '#00c0ff'
						},
						MBLWNT: {
							color: '#287415'
						},
						MBLG3: {
							color: '#2fd090'
						},
						MBLG4: {
							color: '#2fd090'
						},
						MBL: {
							color: '#7cfc00'
						},
						MBLSHH: {
							color: '#29a20b'
						},
						MB: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						MEL: {
							color: '#9531ed'
						},
						AULKMT2A: {
							color: '#d3d3d3'
						},
						MPNST: {
							color: '#d3d3d3'
						},
						NBL: {
							color: '#f9779d'
						},
						OS: {
							color: '#ff00ff'
						},
						CHOS: {
							color: '#ff00ff'
						},
						RBL: {
							color: '#ffd700'
						},
						ERMS: {
							color: '#0000ff'
						},
						BERMS: {
							color: '#0006c2'
						},
						ARMS: {
							color: '#00aeff'
						},
						RMS: {
							color: '#00c0ff'
						},
						MSCERMS: {
							color: 'white'
						},
						RHB: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						SCRMS: {
							color: '#d3d3d3'
						},
						SYNS: {
							color: '#d3d3d3'
						},
						WT: {
							color: '#29a20b'
						},
						MGCT: {
							color: 'white'
						},
						THPA: {
							color: '#11c598'
						},
						DES: {
							color: '#8b0000'
						},
						CNOS: {
							color: 'white'
						},
						SCSNOS: {
							color: '#d3d3d3'
						},
						HB: {
							color: '#e76836'
						},
						CCSK: {
							color: '#d3d3d3'
						},
						SCCNOS: {
							color: '#d3d3d3'
						},
						FMS: {
							color: '#d3d3d3'
						},
						ODYS: {
							color: 'white'
						},
						SCUP: {
							color: '#d3d3d3'
						},
						UESL: {
							color: '#ffa500'
						},
						RCSNOS: {
							color: '#d3d3d3'
						},
						SETTLE: {
							color: '#d3d3d3'
						},
						DFSP: {
							color: '#d3d3d3'
						},
						OMGCT: {
							color: 'white'
						},
						BYST: {
							color: 'white'
						},
						HCC: {
							color: '#ffa500'
						},
						NFIB: {
							color: '#d3d3d3'
						},
						AFH: {
							color: '#d3d3d3'
						},
						FIBS: {
							color: '#d3d3d3'
						},
						PRCC: {
							color: '#eb1414'
						},
						SIPT: {
							color: '#d3d3d3'
						},
						MRT: {
							color: '#c01111'
						},
						YSTNOS: {
							color: 'white'
						},
						MUCC: {
							color: '#d3d3d3'
						},
						THFO: {
							color: '#11c598'
						},
						CCRCC: {
							color: '#d3d3d3'
						},
						PANET: {
							color: '#d3d3d3'
						},
						MRTL: {
							color: '#c01111'
						},
						ST: {
							color: 'Classification_tSNE_color (Manuscript)'
						},
						WTB: {
							color: '#7cfc00'
						},
						WLM: {
							color: 'Classification_tSNE_color (Manuscript)'
						}
					}
				}
			}
		},

		scatterplot: {
			x: {
				attribute: 'x'
			},
			y: {
				attribute: 'y'
			},
			colorbyattributes: [{ key: 'diagnosis' } /*{ key: 'diagnosis_group' }*/],
			querykey: 'svcnv'
		}
	},

	queries: {
		svcnv: {
			name: 'Pediatric mutation',
			istrack: true,
			type: 'mdssvcnv',
			file: 'hg38/Pediatric/pediatric.svcnv.hg38.gz',
			// cnv
			valueCutoff: 0.2,
			bplengthUpperLimit: 2000000, // limit cnv length to focal events
			// loh
			segmeanValueCutoff: 0.1,
			lohLengthUpperLimit: 2000000,
			noprintunannotatedsamples: true
		}
	}
}
