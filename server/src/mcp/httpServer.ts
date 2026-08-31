/*
 * Same ProteinPaint MCP POC tools as server.ts, exposed over MCP's Streamable HTTP transport
 * instead of stdio — so a client reaches this over the network (POST /mcp) rather than spawning
 * it as a local child process. See toolServer.ts for the shared tool definitions and README.md
 * for the stdio-vs-HTTP tradeoffs this exists to demonstrate.
 *
 * Stateless mode (sessionIdGenerator: undefined, mirroring the SDK's own
 * examples/server/simpleStatelessStreamableHttp.ts): a fresh McpServer + transport per request,
 * torn down when the response closes. Fits this POC's tools fine — search_terms and
 * create_summary_plot are independent, one-shot calls with no server-side session state to keep
 * between them — and sidesteps session-id bookkeeping entirely for this demo.
 *
 * Run: tsx src/mcp/httpServer.ts
 * Inspect: npx @modelcontextprotocol/inspector, then connect to http://localhost:4000/mcp with
 * transport type "Streamable HTTP" (the Inspector CLI's stdio-only `<command>` form doesn't apply
 * here — point the web UI at the URL instead).
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { createMcpServer } from './toolServer.ts'

const PORT = Number(process.env.MCP_HTTP_PORT) || 4000

// createMcpExpressApp() also applies DNS-rebinding protection for localhost binding, and parses
// JSON bodies — both required by transport.handleRequest() below.
const app = createMcpExpressApp()

app.post('/mcp', async (req, res) => {
	const server = createMcpServer() //Create a fresh McpServer for each request, then tear it down when the response closes (stateless mode).
	try {
		//SDK never creates a sessionId for stateless mode, so the server doesn't either.
		// A fresh, temporary server+transport pair gets created for that one request and then discarded once the response finishes.
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
		await server.connect(transport)
		await transport.handleRequest(req, res, req.body)
		res.on('close', () => {
			transport.close()
			server.close()
		})
	} catch (e: any) {
		console.error('Error handling MCP request:', e)
		if (!res.headersSent) {
			res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null })
		}
	}
})

// Stateless mode supports neither a server-initiated SSE stream (GET) nor session termination
// (DELETE) — there's no session to resume or end.
const methodNotAllowed = (_req: any, res: any) =>
	res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })
app.get('/mcp', methodNotAllowed)
app.delete('/mcp', methodNotAllowed)

app.listen(PORT, () => {
	console.log(`ProteinPaint MCP Streamable HTTP server listening on http://localhost:${PORT}/mcp`)
}) //This starts the HTTP server listening on port 4000. Without this call, none of the route handlers above
//would ever receive any traffic at all. They are just definitions sitting idle until .listen() turns the whole thing on.
