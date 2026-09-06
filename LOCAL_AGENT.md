# IDK Local Agent

IDK Local Agent is an optional local-only AI path. It supports OpenAI-compatible
local servers from Ollama and LM Studio. The existing server-backed IDK Echo
still works separately.

## Setup

1. Install Ollama or LM Studio on the same computer as the browser.
2. Start a local model server and load a model.
3. Open `Local Agent` in IDK.
4. Choose the runtime, confirm the local endpoint, enter the loaded model name,
   and press `Test connection`.

Ollama defaults to `http://127.0.0.1:11434/v1`.
LM Studio defaults to `http://127.0.0.1:1234/v1`.

The local server must allow browser requests from the IDK page. Ollama may
require `OLLAMA_ORIGINS=*`; LM Studio has a CORS setting in its local server
panel.

## Actions

The agent can propose opening safe IDK apps and web links, creating notes,
tasks, and reminders, or writing text files. Every proposal must be approved
in the Local Agent window. Shell commands, deletion, credentials, account
changes, messaging, and arbitrary code execution are not supported.
