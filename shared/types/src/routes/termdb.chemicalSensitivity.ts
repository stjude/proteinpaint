/** a sample with drug sensitivity data */
export type ChemicalSensitivitySample = {
	/** sample name, as in the sample column of the data file, e.g. "KOPN49" */
	name: string
	/** optional attributes from the data file columns after the log10 IC50, keyed by their header, in the column
	order, e.g. { Type: 'B-ALL', Subtype: 'CRLF2' }; blank and NA values are left out */
	attributes?: { [label: string]: string }
}

/** a drug, from the data file */
export type ChemicalSensitivityDrug = {
	name: string
	/** e.g. "Antimetabolite" */
	class?: string
}

/** a dose-response curve of a sample and drug: a replicate, or the average of the replicates */
export type ChemicalSensitivityCurve = {
	/** e.g. "Rep1", "Average" */
	name: string
	/** IC50 of this curve in nM (not log10) */
	ic50: number
	/** AOC of this curve */
	aoc: number
	/** measured points; concentration is log10 nM, act is the relative survival. unset for the average */
	raw?: { conc: number[]; act: number[] }
	/** fitted curve, same units as raw */
	fit: { conc: number[]; act: number[] }
}

/** the dose-response data of a sample and drug, from its dose-response file */
export type ChemicalSensitivityDoseResponse = {
	drug: string
	sample: string
	/** log10 nM of the lowest and highest tested concentrations */
	concRange: [number, number]
	/** the replicates, then the average, in the file order */
	curves: ChemicalSensitivityCurve[]
}

/** the response of a sample to a drug, from the data file */
export type ChemicalSensitivityResult = {
	drug: string
	/** area over the dose-response curve */
	aoc: number
	/** log10 of IC50 in nM */
	ic50: number
}

export type ChemicalSensitivityRequest = {
	genome: string
	dslabel: string
	/** optional sample name; its results are then returned */
	sample?: string
	/** optional drug names, with sample; their dose-response data are then returned, and the molecule image when
	there is one drug. a drug not in the data has neither */
	drugs?: string[]
}

export type ChemicalSensitivityResponse = {
	/** all samples, in the order they first appear in the data file */
	samples: ChemicalSensitivitySample[]
	/** all drugs, in the order they first appear in the data file, which is the order of the bars */
	drugs: ChemicalSensitivityDrug[]
	/** min and max of aoc and ic50 over all samples, so that the charts of different samples share their scales */
	aocMax: number
	ic50Range: [number, number]
	/** only with request.sample: its results, in the drugs order */
	results?: ChemicalSensitivityResult[]
	/** only with request.drugs: the dose-response data of the sample and each drug that has it, in the request order */
	doseResponses?: ChemicalSensitivityDoseResponse[]
	/** only with one request.drugs: the svg text of the drug's molecule image, unset when there is none */
	moleculeImage?: string
}
