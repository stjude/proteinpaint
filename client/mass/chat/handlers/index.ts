// The omnisearch handlers, in display order. Add a new result kind by writing its handler file and adding
// it here; nothing else needs to change (see types.ts).
import type { HandlerCtx, OmnisearchHandler } from './types.ts'
import { DictionaryHandler } from './dictionary.ts'
import { GeneHandler } from './gene.ts'
import { SampleHandler } from './sample.ts'
import { GenomicRegionHandler } from './genomicRegion.ts'

/** Fresh handler instances (they hold per-dataset state), each initialized from the dataset config. */
export function initHandlers(ctx: HandlerCtx): OmnisearchHandler[] {
	const handlers: OmnisearchHandler[] = [
		new DictionaryHandler(),
		new GeneHandler(),
		new SampleHandler(),
		new GenomicRegionHandler()
	]
	for (const h of handlers) h.init(ctx)
	return handlers
}
