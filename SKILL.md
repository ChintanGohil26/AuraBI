---
name: aurabi-management
description: Skills for running, debugging, testing, and managing the AuraBI Business Intelligence platform.
---

# AuraBI Management Skill

This skill guides AI agents on how to interact with, manage, and debug the **AuraBI** application.

---

## 📂 Project Layout

- `pyproject.toml`: Dependency mapping (FastAPI, google-adk, mcp).
- `app/main.py`: FastAPI routes & FastMCP server mounting.
- `app/data_sources.py`: In-memory databases & anomalies validation checks.
- `app/reports.py`: Business intelligence aggregation calculations.
- `app/agent.py`: ADK LlmAgent definitions.
- `app/agent_utils.py`: Runs ADK agents using the Runner.
- `app/static/`: Frontend single page app (HTML, CSS, JS).
- `tests/test_app.py`: Automated pytest test cases.

---

## 🛠️ Operational Commands

### 1. Launching the Web Server & MCP SSE Transport
To launch the FastAPI server, which hosts the web dashboard on `/` and the Model Context Protocol (MCP) server over SSE on `/mcp/sse`:
```bash
cd AuraBI
uv run uvicorn app.main:app --reload --port 8000
```

### 2. Testing the Backend
To run the full unit and integration test suite:
```bash
cd AuraBI
uv run pytest
```

### 3. Running Standalone Stdio MCP Server
To execute the stdio-transport MCP server for direct CLI agent connections:
```bash
cd AuraBI
uv run python app/mcp_server.py
```

### 4. Launching the ADK Web Playground
To run the Google ADK's web playground inside your browser to trace, run, and inspect your agents, execute:
```bash
# Using the installed tool
agents-cli playground

# Or using uvx directly
uvx google-agents-cli playground
```

---

## 🔐 Security RBAC Matrix

Ensure security compliance when modifying API behaviors:
- `Viewer`: Can only access aggregate reports `/api/reports`. Restricted from raw records and editing.
- `Super User`: Can read `/api/data` but receives a `403` on `/api/data/update`.
- `Admin`: Full permissions (can update/correct anomalies and upload CSVs).
