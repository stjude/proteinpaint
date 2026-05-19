export type AIProjectTrainModelRequest = {
	genome: string
	dslabel: string
	projectId?: string
}

export type AIProjectTrainModelResponse = {
	status: 'ok' | 'error'
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
