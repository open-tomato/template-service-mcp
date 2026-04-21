import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import {
  echoDescription,
  echoInputSchema,
  echoName,
  handleEcho,
} from '../src/tools/echo.js';

async function startLinked(): Promise<{ client: Client; server: McpServer }> {
  const server = new McpServer({ name: 'test-mcp', version: '0.0.1' });
  server.registerTool(
    echoName,
    { description: echoDescription, inputSchema: echoInputSchema },
    handleEcho,
  );

  const client = new Client({ name: 'test-client', version: '0.0.1' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

describe('echo tool', () => {
  it('echoes back the provided text', async () => {
    const { client, server } = await startLinked();

    try {
      const response = await client.callTool({
        name: 'echo',
        arguments: { text: 'hello, mcp' },
      });

      expect(response.content).toEqual([
        { type: 'text', text: 'hello, mcp' },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('is listed in tools/list', async () => {
    const { client, server } = await startLinked();

    try {
      const { tools } = await client.listTools();
      const tool = tools.find(t => t.name === 'echo');

      expect(tool).toBeDefined();
      expect(tool?.description).toBe(echoDescription);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
