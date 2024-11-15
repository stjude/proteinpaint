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

type AnnotatedSampleEntry = {
	[index: string]: {
		key: number
		value: number
	} & {
		sample: string
		_ref_: { label: string }
	}
}
