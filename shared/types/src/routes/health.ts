export type HealthRequest = Record<string, never>

/**
 * Minimal liveness response, meant for frequent polling (e.g. k8s probes, uptime monitors)
 * without the cost of the full /healthcheck payload (genome/dataset build info, versions, etc).
 */
export type HealthResponse = {
	status: 'ok' | 'error'
	/** path to the full /status (alias of /healthcheck) response, for callers that need build/dataset details */
	detailsAt?: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
