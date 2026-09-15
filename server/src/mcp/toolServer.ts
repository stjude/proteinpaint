/*
 * Shared tool definitions for the ProteinPaint MCP POC, factored out so both entry points —
 * server.ts (stdio) and httpServer.ts (Streamable HTTP) — register the exact same tools instead
 * of maintaining two copies. See server.ts's top comment for the overall design.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod' //runtime validator
import { screenshotSummaryPlot } from './renderPlot.ts'

const PP_SERVER = process.env.PP_MCP_SERVER_URL || 'http://localhost:3000'
// TermdbTest's dictionary search is scoped to a subcohort (see dataset/termdb.test.ts's
// selectCohort.values); 'ABC' is the dataset's primary test subcohort.

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: 'proteinpaint-poc',
		version: '0.1.0'
	})

	server.registerTool(
		'search_terms',
		{
			title: 'Search ProteinPaint dictionary terms',
			description:
				`Search the TermdbTest dictionary for phenotype/clinical terms matching a free-text query ` +
				`(e.g. "sex", "age", "diagnosis"). Returns a short list of matching terms with their id, name, ` +
				`and type. Use the returned "id" values as the term/term2 arguments to create_summary_plot.`,
			inputSchema: {
				query: z.string().min(1).describe('Free-text search string, e.g. "sex" or "age at diagnosis"'),
				genome: z.string().min(1).describe('Genome name, e.g. "hg38-test"'),
				dslabel: z.string().min(1).describe('Dataset label, e.g. "TermdbTest"'),
				cohort: z.string().optional().describe('Cohort string, e.g. "ABC" for TermdbTest')
			}
		},
		async ({ query, genome, dslabel, cohort }) => {
			// Reuses the real, already-established dictionary search endpoint (server/src/termdb.js's
			// trigger_findterm, dispatched from the generic /termdb handler) — the same one the Mass UI's
			// own tree/search box calls. Not part of chat/ or the omnisearch endpoint.
			const url = new URL('/termdb', PP_SERVER)
			url.searchParams.set('genome', genome)
			url.searchParams.set('dslabel', dslabel)
			url.searchParams.set('findterm', query)
			url.searchParams.set('targetType', 'Dictionary Variables')
			if (cohort) url.searchParams.set('cohortStr', cohort)

			const res = await fetch(url)
			if (!res.ok) throw new Error(`search_terms: PP server responded ${res.status} ${await res.text()}`)
			const data: any = await res.json()
			if (data.error) throw new Error(`search_terms: ${data.error}`)

			// Shape the result small: only id/name/type, never the full term/db rows, so the agent's
			// context doesn't get flooded.
			const terms = (data.lst || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type }))
			return { content: [{ type: 'text', text: JSON.stringify(terms, null, 2) }] }
		}
	)

	server.registerTool(
		'create_summary_plot',
		{
			title: 'Create a ProteinPaint summary (barchart) plot',
			description:
				`Build a validated ProteinPaint Mass "summary" plot config for one or two TermdbTest dictionary ` +
				`terms (use ids returned by search_terms). term is the main variable; term2, if given, overlays a ` +
				`second variable on the same barchart. The returned config is produced by the server's own ` +
				`deterministic plot-state assembler, not invented — invalid term ids are rejected.`,
			inputSchema: {
				term: z.string().min(1).describe('Dictionary term id for the main variable (from search_terms)'),
				term2: z.string().min(1).optional().describe('Optional dictionary term id to overlay (from search_terms)'),
				genome: z.string().min(1).describe('Genome name, e.g. "hg38-test"'),
				dslabel: z.string().min(1).describe('Dataset label, e.g. "TermdbTest"')
			}
		},
		async ({ term, term2, genome, dslabel }) => {
			const url = new URL('/mcp/createSummaryPlot', PP_SERVER)
			url.searchParams.set('genome', genome)
			url.searchParams.set('dslabel', dslabel)
			url.searchParams.set('term', term)
			if (term2) url.searchParams.set('term2', term2)

			const res = await fetch(url)
			if (!res.ok) throw new Error(`create_summary_plot: PP server responded ${res.status} ${await res.text()}`)
			const plotState: any = await res.json()
			if (plotState.error) throw new Error(`create_summary_plot: ${plotState.error}`)

			// A real, working deep link: the same `?mass=<json>` URL param shape the Mass UI's own
			// e2e tests use to open a specific chart directly (e2e-tests/TermdbTest/massNav.e2e.spec.ts).
			const deepLinkState = { genome: genome, dslabel: dslabel, nav: { activeTab: 1 }, plots: [plotState.plot] }
			const deepLinkUrl = `${PP_SERVER}/?mass=${encodeURIComponent(JSON.stringify(deepLinkState))}`

			const content: any[] = []
			let renderError: string | undefined
			try {
				const png = await screenshotSummaryPlot(PP_SERVER, genome, dslabel, plotState.plot)
				content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' })
			} catch (e: any) {
				// Rendering is a best-effort addition on top of the validated config below — a headless
				// browser hiccup shouldn't hide a config that resolved successfully.
				renderError = e?.message || String(e)
			}

			content.push({
				type: 'text',
				text: JSON.stringify({ plotState, deepLinkUrl, ...(renderError ? { renderError } : {}) }, null, 2)
			})
			return { content }
		}
	)

	server.registerTool(
		'list_datasets',
		{
			title: 'List ProteinPaint datasets',
			description:
				`Return a list of all datasets available on the running ProteinPaint dev server, ` +
				`as genome/dslabel pairs. Call this first if you don't already know which genome/dslabel ` +
				`to use with search_terms or create_summary_plot.`,
			inputSchema: {}
		},
		async () => {
			const url = new URL('/mcp/listDatasets', PP_SERVER)
			const res = await fetch(url)
			if (!res.ok) throw new Error(`list_datasets: PP server responded ${res.status} ${await res.text()}`)
			const datasets: any = await res.json()

			return { content: [{ type: 'text', text: JSON.stringify(datasets, null, 2) }] }
		}
	)

	return server
}
