import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import { MEMORY_DIR, KIMI_API_KEY, ZAI_API_KEY, ANTHROPIC_API_KEY } from "./config.js";
import { allTools } from "./extension.js";
import * as memory from "./memory.js";
import { join } from "node:path";

const SESSION_DIR = join(MEMORY_DIR, "sessions");

const activeSessions = new Map<string, AgentSession>();

function setupAuth(): AuthStorage {
  const auth = AuthStorage.create();
  if (KIMI_API_KEY) auth.setRuntimeApiKey("kimi-coding", KIMI_API_KEY);
  if (ZAI_API_KEY) auth.setRuntimeApiKey("zai", ZAI_API_KEY);
  if (ANTHROPIC_API_KEY) auth.setRuntimeApiKey("anthropic", ANTHROPIC_API_KEY);
  return auth;
}

async function createSession(conversationId: string): Promise<AgentSession> {
  const systemPrompt = memory.loadSystemPrompt();
  const overview = memory.loadOverview();

  const authStorage = setupAuth();
  const modelRegistry = new ModelRegistry(authStorage);

  const contextParts: string[] = [];
  if (overview) contextParts.push(`## Projects Overview\n${overview}`);

  const loader = new DefaultResourceLoader({
    cwd: MEMORY_DIR,
    systemPromptOverride: () => systemPrompt,
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        ...(contextParts.length > 0
          ? [{ path: "/virtual/context.md", content: contextParts.join("\n\n") }]
          : []),
      ],
    }),
  });
  await loader.reload();

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
    retry: { enabled: true, maxRetries: 2 },
  });

  const { session } = await createAgentSession({
    cwd: MEMORY_DIR,
    sessionManager: SessionManager.create(MEMORY_DIR, SESSION_DIR),
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    settingsManager,
    customTools: allTools,
  });

  activeSessions.set(conversationId, session);
  return session;
}

export async function chat(userMessage: string, conversationId: string, model?: string): Promise<string> {
  let session = activeSessions.get(conversationId);
  if (!session) {
    session = await createSession(conversationId);
  }

  if (model) {
    const available = await new ModelRegistry(setupAuth()).getAvailable();
    const match = available.find(m =>
      m.id === model || m.id.includes(model) || `${m.provider}/${m.id}` === model
    );
    if (match) {
      await session.setModel(match);
    }
  }

  let responseText = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      responseText += event.assistantMessageEvent.delta;
    }
  });

  try {
    await session.prompt(userMessage);
  } finally {
    unsubscribe();
  }

  memory.appendConversation(conversationId, userMessage, responseText);
  return responseText;
}

export async function cronWakeUp() {
  const session = await createSession("cron-session");
  let responseText = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      responseText += event.assistantMessageEvent.delta;
    }
  });
  try {
    await session.prompt("[CRON] Wake up and process your task list.");
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete("cron-session");
  }
  return responseText;
}

export async function getAvailableModels(): Promise<{ id: string; label: string; default: boolean }[]> {
  const authStorage = setupAuth();
  const modelRegistry = new ModelRegistry(authStorage);
  const available = await modelRegistry.getAvailable();
  const defaultModel = process.env.DEFAULT_MODEL || "";

  return available.map(m => ({
    id: `${m.provider}/${m.id}`,
    label: `${m.provider}/${m.id}`,
    default: m.id === defaultModel || `${m.provider}/${m.id}` === defaultModel,
  }));
}

export function disposeSession(conversationId: string) {
  const session = activeSessions.get(conversationId);
  if (session) {
    session.dispose();
    activeSessions.delete(conversationId);
  }
}
