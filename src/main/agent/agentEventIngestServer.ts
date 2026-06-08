import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import type { AgentIntegrationScope, AgentKind } from '../../shared/types';
import { agentRegistry } from './agentRegistry';

const defaultPort = 17371;

interface AgentHookSecretData {
  token: string;
}

export interface IncomingAgentHookEvent {
  agent: AgentKind;
  integrationId?: string;
  scope?: AgentIntegrationScope;
  scopePath?: string;
  raw: unknown;
  receivedAt: string;
}

interface AgentEventIngestServerOptions {
  secretPath: string;
  onEvent: (event: IncomingAgentHookEvent) => void;
}

export class AgentEventIngestServer {
  private server: Server | undefined;
  private port = defaultPort;
  private lastEventAt: string | undefined;
  private readonly token: string;

  constructor(private readonly options: AgentEventIngestServerOptions) {
    this.token = this.readOrCreateToken();
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    await this.listen(defaultPort).catch(() => this.listen(0));
  }

  stop(): void {
    this.server?.close();
    this.server = undefined;
  }

  get endpoint(): string {
    return `http://127.0.0.1:${this.port}/agent-events`;
  }

  get authToken(): string {
    return this.token;
  }

  get isRunning(): boolean {
    return Boolean(this.server?.listening);
  }

  get lastReceivedAt(): string | undefined {
    return this.lastEventAt;
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((request, response) => {
        void this.handleRequest(request, response);
      });

      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        this.server = server;
        this.port = typeof address === 'object' && address ? address.port : port;
        server.off('error', reject);
        resolve();
      });
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'POST' || request.url !== '/agent-events') {
      sendJson(response, 404, { ok: false });
      return;
    }

    if (request.headers.authorization !== `Bearer ${this.token}`) {
      sendJson(response, 401, { ok: false });
      return;
    }

    try {
      const payload = JSON.parse(await readRequestBody(request)) as Partial<IncomingAgentHookEvent>;

      if (!isKnownAgent(payload.agent) || !('raw' in payload)) {
        sendJson(response, 400, { ok: false });
        return;
      }

      const receivedAt = typeof payload.receivedAt === 'string' ? payload.receivedAt : new Date().toISOString();
      this.lastEventAt = receivedAt;
      this.options.onEvent({
        agent: payload.agent,
        integrationId: typeof payload.integrationId === 'string' ? payload.integrationId : undefined,
        scope: isAgentIntegrationScope(payload.scope) ? payload.scope : undefined,
        scopePath: typeof payload.scopePath === 'string' ? payload.scopePath : undefined,
        raw: payload.raw,
        receivedAt
      });
      sendJson(response, 200, { ok: true });
    } catch {
      sendJson(response, 400, { ok: false });
    }
  }

  private readOrCreateToken(): string {
    if (existsSync(this.options.secretPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.options.secretPath, 'utf8')) as AgentHookSecretData;

        if (typeof parsed.token === 'string' && parsed.token.length >= 32) {
          return parsed.token;
        }
      } catch {
        // Regenerate an unusable token file.
      }
    }

    const token = randomBytes(24).toString('hex');
    mkdirSync(dirname(this.options.secretPath), { recursive: true });
    writeFileSync(this.options.secretPath, JSON.stringify({ token }, null, 2), 'utf8');
    return token;
  }
}

function isKnownAgent(value: unknown): value is string {
  return typeof value === 'string' && agentRegistry.get(value as AgentKind) !== undefined;
}

function isAgentIntegrationScope(value: unknown): value is AgentIntegrationScope {
  return (
    value === 'windows-user' ||
    value === 'windows-project' ||
    value === 'wsl-user' ||
    value === 'wsl-project' ||
    value === 'linux-user' ||
    value === 'linux-project'
  );
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    request.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;

      if (totalBytes > 1024 * 1024) {
        reject(new Error('Payload too large'));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body));
}
