/** Response and formatted data from TermdbVocab getAnnotatedSampleData()*/
export type AnnotatedSampleData = {
	lst: AnnotatedSampleEntry[]
	refs: {
		bySampleId: {
			[index: string]: {
				label: string
			}
		}
		byTermId: {
			//Term
			[index: string]: any
		}
	}
	samples: AnnotatedSampleEntry[]
}

type SampleInfo = {
	/** Sample id */
	sample: string
	/** Human readable label */
	_ref_: { label: string }
}

type TWKeyValue = {
	/** Key matching the term.value[idx] */
	key: string | number
	/** Actual value of the key */
	value: string | number
}

export type AnnotatedSampleEntry = SampleInfo & {
	[k: string]: TWKeyValue | SampleInfo[keyof SampleInfo]
}
