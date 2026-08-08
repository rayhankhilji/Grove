import { createServer, type Server } from 'node:http'
import type Anthropic from '@anthropic-ai/sdk'
import { runToolByWireName } from '../tools'

/**
 * Grove's tools, exposed to a plan-backed CLI over MCP.
 *
 * The first attempt at subscription mode asked the model to emit tool calls as
 * text in a bespoke syntax. That was wrong, and the failure was instructive:
 * Claude Code hands the model a real tool-calling mechanism, so it used that
 * with Grove's tool names — and the CLI, which had never heard of them,
 * answered "No such tool available" to every single call. The model was doing
 * the sensible thing; the protocol was the problem.
 *
 * So the tools are registered properly instead. Grove runs a JSON-RPC endpoint
 * on the loopback, the CLI is pointed at it with `--mcp-config`, and calls come
 * back here to execute against the real store, vault and connectors — the same
 * code path the API-key route uses.
 *
 * The server binds to 127.0.0.1 on an ephemeral port and requires a token
 * minted per launch, so nothing else on the machine can drive Grove's tools.
 */

interface Rpc {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, any>
}

export interface McpHandle {
  url: string
  token: string
  close: () => void
}

/** The tools this session may call, set for the duration of one turn. */
let current: Anthropic.Tool[] = []

export const setTools = (tools: Anthropic.Tool[]): void => {
  current = tools
}

const send = (response: import('node:http').ServerResponse, id: unknown, result: unknown): void => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ jsonrpc: '2.0', id, result }))
}

const fail = (
  response: import('node:http').ServerResponse,
  id: unknown,
  code: number,
  message: string
): void => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }))
}

const handle = async (
  rpc: Rpc,
  response: import('node:http').ServerResponse
): Promise<void> => {
  switch (rpc.method) {
    case 'initialize':
      return send(response, rpc.id, {
        // Matching the client's requested revision avoids a negotiation round
        // trip; Claude Code sends the one it wants and accepts it echoed back.
        protocolVersion: rpc.params?.['protocolVersion'] ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'grove', version: '1.0.0' }
      })

    case 'notifications/initialized':
      response.writeHead(202).end()
      return

    case 'tools/list':
      return send(response, rpc.id, {
        tools: current.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema
        }))
      })

    case 'tools/call': {
      const name = String(rpc.params?.['name'] ?? '')
      if (!current.some((tool) => tool.name === name)) {
        return fail(response, rpc.id, -32602, `Unknown tool: ${name}`)
      }
      const result = await runToolByWireName(
        name,
        (rpc.params?.['arguments'] ?? {}) as Record<string, unknown>
      )
      return send(response, rpc.id, {
        content: [{ type: 'text', text: result.result }],
        isError: result.isError
      })
    }

    case 'ping':
      return send(response, rpc.id, {})

    default:
      return fail(response, rpc.id, -32601, `Unsupported method: ${rpc.method}`)
  }
}

let handle_: McpHandle | null = null

/** Starts the bridge once and reuses it for the life of the process. */
export const mcpBridge = async (): Promise<McpHandle> => {
  if (handle_) return handle_

  const token = `grove_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

  const server: Server = createServer((request, response) => {
    // Loopback plus a per-launch bearer: the port is discoverable, the token
    // is not, and nothing on this Mac should be able to run Grove's tools.
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end()
      return
    }

    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
    })
    request.on('end', () => {
      void (async () => {
        try {
          const rpc = JSON.parse(body || '{}') as Rpc
          await handle(rpc, response)
        } catch (error) {
          fail(response, null, -32700, (error as Error).message)
        }
      })()
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  handle_ = {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    close: () => {
      server.close()
      handle_ = null
    }
  }
  return handle_
}
