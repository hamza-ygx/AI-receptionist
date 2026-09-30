import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { VapiApi } from "./api.js";
import { toolDefs } from "./defs/tools.js";
import { structuredOutputDefs } from "./defs/structuredOutputs.js";
import { assistantDefs, phoneNumberDef, squadDef } from "./defs/assistants.js";

interface State {
  tools: Record<string, string>;
  structuredOutputs: Record<string, string>;
  assistants: Record<string, string>;
  squad: string | null;
  phoneNumber: string | null;
}

const args = process.argv.slice(2);
const envName = args[args.indexOf("--env") + 1] && args.includes("--env") ? args[args.indexOf("--env") + 1]! : "dev";
const apply = args.includes("--apply");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = join(root, `state.${envName}.json`);

function loadState(): State {
  if (!existsSync(statePath)) return { tools: {}, structuredOutputs: {}, assistants: {}, squad: null, phoneNumber: null };
  return JSON.parse(readFileSync(statePath, "utf8")) as State;
}

function redactSecrets(o: unknown): unknown {
  return JSON.parse(JSON.stringify(o, (k, v) => (/secret|token|apiKey|authToken/i.test(k) ? "***" : v)));
}

function withoutType<T extends Record<string, unknown>>(o: T, drop: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));
}

async function main() {
  const env = loadEnv(envName);
  const api = new VapiApi(env.vapiBase, env.vapiKey);
  const state = loadState();
  const plan: string[] = [];
  const fake = (kind: string, name: string) => `<new ${kind}:${name}>`;

  async function upsert(kind: string, path: string, name: string, id: string | undefined | null, payload: Record<string, unknown>, dropOnUpdate: string[]): Promise<string> {
    if (id) {
      plan.push(`PATCH ${path}/${id} (${name})`);
      if (apply) await api.req("PATCH", `${path}/${id}`, withoutType(payload, dropOnUpdate));
      return id;
    }
    plan.push(`POST  ${path} (${name})`);
    if (!apply) return fake(kind, name);
    const created = await api.req("POST", path, payload);
    return created.id;
  }

  for (const [name, def] of Object.entries(toolDefs(env))) {
    state.tools[name] = await upsert("tool", "/tool", name, state.tools[name], def as Record<string, unknown>, ["type"]);
  }
  for (const [name, def] of Object.entries(structuredOutputDefs(env))) {
    state.structuredOutputs[name] = await upsert("so", "/structured-output", name, state.structuredOutputs[name], def as Record<string, unknown>, ["type"]);
  }
  const soIds = Object.values(state.structuredOutputs);
  for (const [name, def] of Object.entries(assistantDefs(env, state.tools, soIds))) {
    state.assistants[name] = await upsert("assistant", "/assistant", name, state.assistants[name], def as Record<string, unknown>, []);
  }
  state.squad = await upsert("squad", "/squad", "rkjh-reception", state.squad, squadDef(state.assistants), []);

  const phone = phoneNumberDef(env, !state.phoneNumber);
  if (phone) state.phoneNumber = await upsert("phone", "/phone-number", phone.name, state.phoneNumber, phone, ["provider", "number"]);

  console.log(`${apply ? "Applied" : "Dry run"} (${envName} → ${env.vapiBase}):\n  ${plan.join("\n  ")}`);
  if (args.includes("--print")) console.log(JSON.stringify(redactSecrets({ tools: toolDefs(env), assistants: assistantDefs(env, state.tools, soIds) }), null, 2));
  if (apply) {
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    console.log(`State written to ${statePath}. Set VAPI_SQUAD_ID=${state.squad} on func-voice.`);
  } else {
    console.log("Nothing sent. Re-run with --apply to create/update resources.");
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
