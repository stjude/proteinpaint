import { dofetch3 } from '#common/dofetch'

/* which samples have a brain imaging file for a given template (refKey).
shared by the launch points that only need availability (matrix click menu,
sample view, groups menu); the brain imaging chart menu fetches the full
annotated sample list itself, as it also renders the sample table.

the in-flight Promise is cached per (genome, dslabel, refKey), so concurrent
callers share one request and repeat callers reuse the response for the page
lifetime. a failed request is evicted so errors stay retryable.

NOTE: the server restricts the response by the user's authorization, so a
login/logout without a page reload can leave a stale availability set here */
const cache = new Map<string, Promise<Set<string>>>()

/* fetch from the brainImagingSamples route, owning its error contract:
the route sends errors as a plain string (so they are not retained by dofetch3's
response cache and stay retryable); a string response IS the error message */
export async function fetchBrainImagingSamples(body: any): Promise<any> {
	const result: any = await dofetch3('brainImagingSamples', { body })
	if (typeof result == 'string') throw result
	if (result.error) throw result.error
	return result
}

export function getBrainImagingSampleSet(genome: string, dslabel: string, refKey: string): Promise<Set<string>> {
	const key = `${genome}\t${dslabel}\t${refKey}`
	if (!cache.has(key)) {
		const promise = (async () => {
			const result = await fetchBrainImagingSamples({ genome, dslabel, refKey, samplesOnly: true })
			return new Set<string>((result.samples || []).map(s => s.sample))
		})()
		promise.catch(() => cache.delete(key))
		cache.set(key, promise)
	}
	return cache.get(key)!
}
