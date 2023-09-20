export type BurdenRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** the diagnosis group:
	 * 1="Acute lymphoblastic leukemia"
	 * 2="AML"
	 * 3="Hodgkin lymphoma"
	 * 4="Non-Hodgkin lymphoma"
	 * 5="Central nervous system"
	 * 6="Bone tumor"
	 * 7="STS"
	 * 8="Wilms tumor"
	 * 9="Neuroblastoma"
	 * 10="Retinoblastoma"
	 * 11="Germ cell tumor"
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
	/** Brrain radiation, Gy */
	brain: number
	/** Abdominal radiation, Gy */
	abd: number
	/** Pelvic radiation, Gy */
	pelvis: number
	/** Chest radiation, Gy */
	chest: number
}

export type BurdenResponse = {
	status: string
	keys: string[]
	rows: number[][]
}
