// https://github.com/NCI-GDC/portal-ui/blob/92f0dfa17838746093c3c011141d08391016da91/data/schema.graphql

const got = require('got')
const path = require('path')
const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	arg[k] = v
}
const query = `
query barcode($filters: FiltersArgument) {
  repository {
    cases {
      hits(first: 2000, filters: $filters) { edges { node {
        samples {
          hits (first: 100, filters: $filters) { edges { node {
            submitter_id
            portions {
              hits { edges { node {
			    analytes {
				  hits { edges { node { 
				    aliquots {
					  hits { edges { node { submitter_id }}}
					}
				  }}}
				}
              } } }
            }
          } } }
        }
      } } }
    }
  }
}`

// 116 cases of KRAS G12C
const queryIds = arg.id
	? [arg.id]
	: [
			'CPT0236340006',
			'TCGA-NJ-A55O-01A-11D-A25L-08',
			'TCGA-55-8615-01A-11D-2393-08',
			'TCGA-BR-6802-01A-11D-1882-08',
			'TCGA-55-7726-01A-11D-2167-08',
			'MMRF_2324_1_BM_CD138pos_T3_KHS5U_K14013',
			'TCGA-55-8508-01A-11D-2393-08',
			'TCGA-AG-A023-01A-01W-A00E-09',
			'TCGA-55-1595-01A-01D-0969-08',
			'TCGA-50-8459-01A-11D-2323-08',
			'TCGA-78-7166-01A-12D-2063-08',
			'TCGA-CF-A5UA-01A-11D-A289-08',
			'TCGA-55-8302-01A-11D-2323-08',
			'CPT0021450009',
			'TCGA-69-7978-01A-11D-2184-08',
			'TCGA-AP-A1E4-01A-12D-A135-09',
			'TCGA-AG-3896-01A-01W-1073-09',
			'MMRF_1655_1_BM_CD138pos_T1_KBS5U_L05362',
			'TCGA-BG-A187-01A-11D-A12J-09',
			'CPT0014860009',
			'MMRF_1790_1_BM_CD138pos_T1_KBS5U_L07231',
			'TCGA-MP-A4TE-01A-22D-A25L-08',
			'CPT0008450006',
			'TCGA-17-Z042-01A-01W-0746-08',
			'TCGA-55-8616-01A-11D-2393-08',
			'TCGA-AR-A1AL-01A-21D-A12Q-09',
			'CPT0115070009',
			'CPT0090700009',
			'TCGA-MP-A4TD-01A-32D-A25L-08',
			'TCGA-AG-4008-01A-01W-1073-09',
			'TCGA-64-5778-01A-01D-1625-08',
			'TCGA-AA-A02W-01A-01W-A00E-09',
			'TCGA-97-A4M5-01A-11D-A24P-08',
			'CPT0080610009',
			'TCGA-05-4418-01A-01D-1265-08',
			'TCGA-DM-A1HA-01A-11D-A152-10',
			'TCGA-DC-6683-01A-11D-1826-10',
			'TCGA-78-7539-01A-11D-2063-08',
			'TCGA-MN-A4N5-01A-11D-A24P-08',
			'TCGA-CM-4747-01A-01D-1408-10',
			'TCGA-DM-A1D6-01A-21D-A152-10',
			'TCGA-67-3774-01A-01D-1040-01',
			'TCGA-05-4415-01A-22D-1855-08',
			'TCGA-17-Z022-01A-01W-0746-08',
			'ER-ACGR-TTP1-A-1-0-D-A49N-34',
			'TCGA-05-4250-01A-01D-1105-08',
			'TCGA-86-7713-01A-11D-2063-08',
			'TCGA-05-4244-01A-01D-1105-08',
			'CPT0105060009',
			'TCGA-55-7907-01A-11D-2167-08',
			'TCGA-A6-A567-01A-31D-A28G-10',
			'TCGA-50-5051-01A-21D-1855-08',
			'TCGA-DY-A1H8-01A-21D-A152-10',
			'TCGA-B5-A11J-01A-11D-A122-09',
			'TCGA-AP-A1DO-01A-11D-A135-09',
			'TCGA-97-A4M0-01A-11D-A24P-08',
			'TCGA-IB-7886-01A-11D-2154-08',
			'CPT0146980010',
			'TCGA-78-7167-01A-11D-2063-08',
			'TCGA-50-5932-01A-11D-1753-08',
			'a467b905-fc0b-427b-8753-6d38dd_D6',
			'TCGA-97-7938-01A-11D-2167-08',
			'TCGA-55-8207-01A-11D-2238-08',
			'TCGA-AZ-6607-01A-11D-1835-10',
			'TCGA-78-7145-01A-11D-2036-08',
			'TCGA-55-8203-01A-11D-2238-08',
			'TCGA-AA-3696-01A-01W-0900-09',
			'CPT0105270009',
			'TCGA-05-4249-01A-01D-1105-08',
			'TCGA-EK-A2R8-01A-21D-A18J-09',
			'CPT0091240009',
			'TCGA-78-7148-01A-11D-2036-08',
			'TCGA-44-2668-01A-01D-0969-08',
			'CPT0002500008',
			'TCGA-NJ-A4YI-01A-11D-A25L-08',
			'TCGA-05-4417-01A-22D-1855-08',
			'TCGA-NQ-A57I-01A-11D-A34C-32',
			'CPT0023310006',
			'MMRF_2388_1_BM_CD138pos_T1_KHS5U_K14019',
			'TCGA-44-7671-01A-11D-2063-08',
			'TCGA-49-4505-01A-01D-1931-08',
			'TCGA-J2-8194-01A-11D-2238-08',
			'TCGA-99-8032-01A-11D-2238-08',
			'TCGA-4B-A93V-01A-11D-A397-08',
			'TCGA-55-8097-01A-11D-2238-08',
			'TCGA-75-5126-01A-01D-1753-08',
			'TCGA-DM-A1D4-01A-21D-A152-10',
			'CPT0055100010',
			'TCGA-G2-AA3C-01A-21D-A391-08',
			'TCGA-AG-A032-01A-01W-A00E-09',
			'CPT0086750009',
			'TCGA-N5-A4RS-01A-11D-A28R-08',
			'CPT0052170010',
			'TCGA-73-4662-01A-01D-1265-08',
			'TCGA-55-6983-01A-11D-1945-08',
			'TCGA-64-5774-01A-01D-1625-08',
			'MMRF_1860_1_BM_CD138pos_T1_KBS5U_L05553',
			'TCGA-69-7973-01A-11D-2184-08',
			'CPT0114660010',
			'd8345fa1-f692-4025-bc82-bfaec6_D6',
			'TCGA-AA-A03J-01A-21W-A096-10',
			'CPT0007100009',
			'TCGA-99-8028-01A-11D-2238-08',
			'CPT0001420005',
			'TCGA-55-7914-01A-11D-2167-08',
			'TCGA-AY-A54L-01A-11D-A28G-10',
			'CPT0011710007',
			'TCGA-95-7562-01A-11D-2238-08',
			'TCGA-55-A490-01A-11D-A24D-08',
			'TCGA-G5-6233-01A-11D-1733-10',
			'TCGA-55-7281-01A-11D-2036-08',
			'CPT0117970009',
			'TCGA-MP-A4TF-01A-11D-A25L-08',
			'TCGA-73-7498-01A-12D-2184-08',
			'TCGA-2Y-A9H7-01A-11D-A38X-10',
			'TCGA-17-Z036-01A-01W-0746-08'
	  ]

const variables = {
	filters: {
		op: '=',
		content: {
			// one aliquot id will match with one sample id
			field: 'samples.portions.analytes.aliquots.submitter_id',
			value: queryIds
			/*
			// one case id can match with multiple samples
			field: 'cases.case_id',
			value: arg.id || 'e76258b7-e13a-4b05-855b-d792701ffba1'
			*/
		}
	}
}
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const json = JSON.parse(response.body)
		const old2new = new Map()
		for (const c of json.data.repository.cases.hits.edges) {
			for (const s of c.node.samples.hits.edges) {
				const submitter_id = s.node.submitter_id
				for (const p of s.node.portions.hits.edges) {
					for (const a of p.node.analytes.hits.edges) {
						for (const al of a.node.aliquots.hits.edges) {
							const al_id = al.node.submitter_id
							if (queryIds.includes(al_id)) {
								// a match
								old2new.set(al_id, submitter_id)
							}
						}
					}
				}
			}
		}
		for (const i of queryIds) {
			console.log(i, '--->', old2new.get(i) || '?')
		}
	} catch (error) {
		console.log(error)
	}
})()
