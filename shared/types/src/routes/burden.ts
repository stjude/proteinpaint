import type { RoutePayload } from './routeApi.js'

export type BurdenRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** boolean for whether to show 95% confidence interval */
	showCI: boolean
	/** the diagnosis group:
	 * 1= "Acute lymphoblastic leukemia (ALL)"
	 * 2= "Acute Myeloid Leukemia (AML)"
	 * 3= "Hodgkin lymphoma (HL)"
	 * 4= "Non-Hodgkin lymphoma (NHL)"
	 * 5= "Central nervous system (CNS)"
	 * 6= "Bone tumor (BT)"
	 * 7= "Soft Tissue Sarcoma (STS)"
	 * 8= "Wilms tumor (WT)"
	 * 9= "Neuroblastoma (NB)"
	 * 10= "Retinoblastoma (Rb)"
	 * 11= "Germ cell tumor (GCT)"
	 */
	diaggrp: number
	/** sex: 0=Female, 1=Male */
	sex: number
	/** race or ethnicity: 1=Yes, 0=No */
	white: number
	/** Age of diagnosis, in years */
	agedx: number
	/** bleomycin: a chemotherapy treatment drug, mg/m^2 */
	bleo: number
	/** Etoposide: a chemotherapy treatment drug, mg/m^2 */
	etop: number
	/** Cisplatin: a chemotherapy treatment drug, mg/m^2 */
	cisp: number
	/** Carboplatin: a class of chemotherapy treatment drugs, mg/m^2 */
	carbo: number
	/** Steriods: a class of chemotherapy treatment drugs, mg/m^2 */
	steriod: number
	/** Vincristine: a chemotherapy treatment drug, mg/m^2 */
	vcr: number
	/** High-dose methothrexate: a chemotherapy treatment drug, mg/m^2 */
	hdmtx: number
	/** Intrathecal methothrexate: a chemotherapy treatment drug, mg/m^2 */
	itmt: number
	/** Cyclophosphamide: a chemotherapy treatment drug, mg/m^2 */
	ced: number
	/** Anthracycline: a chemotherapy treatment drug, mg/m^2 */
	dox: number
	/** Heart radiation, Gy */
	heart: number
	/** Brain radiation, Gy */
	brain: number
	/** Abdominal radiation, Gy */
	abd: number
	/** Pelvic radiation, Gy */
	pelvis: number
	/** Chest radiation, Gy */
	chest: number
}

// tentative code for migrating api code from `server/routes` code
export type BurdenResponse = {
	status: string
	keys: string[]
	rows: number[][]
}

// tentative code to generate runtime "type" checkers, requires tsx/bundler to have transform for typia createValidate to work
// export const validBurdenRequest = createValidate<BurdenRequest>()
// export const validBurdenResponse = createValidate<BurdenResponse>()

export const burdenPayload: RoutePayload = {
	request: {
		typeId: 'BurdenRequest'
	},
	response: {
		typeId: 'BurdenResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38',
					// TODO: !!! use hg38-test and TermdbTest !!!
					dslabel: 'SJLife',
					diaggrp: 5,
					sex: 1,
					white: 1,
					agedx: 1,
					bleo: 0,
					etop: 0,
					cisp: 0,
					carbo: 0,
					steriod: 0,
					vcr: 0,
					hdmtx: 0,
					itmt: 0,
					ced: 0,
					dox: 0,
					heart: 0,
					brain: 0,
					abd: 0,
					pelvis: 0,
					chest: 0
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
