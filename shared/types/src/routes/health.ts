export type HealthRequest = Record<string, never>

/**
 * Minimal liveness response, meant for frequent polling (e.g. k8s probes, uptime monitors)
 * without the cost of the full /healthcheck payload (genome/dataset build info, versions, etc).
 */
export type HealthResponse = {
	status: 'ok' | 'error'
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
