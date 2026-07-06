# AuraBI - AI-Augmented Business Intelligence Platform

AuraBI is a next-generation, interactive Business Intelligence (BI) tool developed as a Capstone Project for the **Kaggle Vibe Coding Agents Competition** (Business Track / Agents for Business). It simulates a complete enterprise ecosystem for a fictional company (**Solaris Nexus Inc.**), integrating multi-source data ingestion, automated quality validations, role-based security access, inline data correction, and a self-teaching AI Assistant powered by Google Gemini.

---

## 🎓 Capstone Project Requirements Mapping

Here is how the Capstone requirements are implemented and demonstrated in this project:

| Key Concept | Where to Demonstrate | Implementation Details in AuraBI |
| :--- | :--- | :--- |
| **Agent / Multi-agent system (ADK)** | **Code** | Implemented as a Google ADK `Agent` in [agent.py](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/app/agent.py) with registered python tool functions. Executed programmatically using the ADK `Runner` and `InMemorySessionService` inside [agent_utils.py](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/app/agent_utils.py). |
| **MCP Server** | **Code** | Implemented as a standard Model Context Protocol (MCP) server in [mcp_server.py](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/app/mcp_server.py). It exposes standard reporting tools and anomaly correction capabilities over a stdio JSON-RPC transport. |
| **Security Features** | **Code / Video** | Enforced via Role-Based Access Control (RBAC) at the API endpoint level in [main.py](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/app/main.py) and on the frontend [script.js](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/app/static/script.js) (separating Viewer, Super User, and Admin permissions). |
| **Agent Skills (Agents CLI)** | **Code / Video** | Scaffolding maps directly to the standard python agent lifecycle, ready for testing and linting using `agents-cli` commands. |
| **Deployability** | **Video** | Fully deployable locally using FastAPI (`uv run uvicorn`) and package mapped via Hatchling inside [pyproject.toml](file:///C:/Users/Chintan%20Gohil/Google_AI_vibe_coding/AuraBI/pyproject.toml). Ready to be containerized or pushed to Google Cloud Run. |
| **Antigravity** | **Video** | Demonstrable in your demo video by showing pair programming / vibe coding utilizing the Antigravity IDE panel to prompt model changes. |

---

## 🚀 Key Features

1. **Full ETL Ingestion Ingestion**: Connects and aggregates transactional data from multiple mock endpoints:
   - **CRM (Sales Ledger)**: Closed deals, product lines, regional accounts.
   - **ERP (General Ledger)**: Financial accounts, debits, credits, and ledger audits.
   - **Factory IoT (Assembly Lines)**: Batch yields, machines, and defect counters.
   - **External API**: Weather trends and market indexes to correlate demand factors.
2. **Automated Quality Validation (QA)**: Scans incoming pipelines for anomalies (e.g., negative deal values, future-dated journals, empty attributes, impossible defect rates, and asymmetrical general ledger equations).
3. **Inline Data Quality Correction**: Provides a secure interface for authorized users to fix identified anomalies inline, instantly re-running all BI calculations and reports.
4. **Role-Based Access Control (RBAC)**: Custom security wrappers that control functionality dynamically:
   - **Viewer**: Read-only access to aggregated charts and reports. Raw data and QA tabs are securely locked.
   - **Super User (Auditor)**: Read-only access to raw datasets and active anomalies, with ETL trigger capability. Cannot write corrections.
   - **Admin**: Full read, write, sync, and correction control.
5. **Self-Teaching AI Assistant**: An embedded chatbot panel powered by the Google GenAI SDK (`gemini-2.5-flash`). It explains anomalies, guides formula setups, summarizes metrics, and responds to natural language queries.

---

## 📐 Architecture & Data Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       AuraBI Web SPA                        │
   │  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────┐  │
   │  │ Dashboard │  │ ETL Database │  │ QA Center   │  │ AI Chat │  │
   │  └─────┬─────┘  └──────┬───────┘  └──────┬──────┘  └────┬────┘  │
   └────────┼───────────────┼─────────────────┼──────────────┼───┘
            │               │                 │              │
   ─────────┼───────────────┼─────────────────┼──────────────┼──────────
   FastAPI  │ GET reports   │ GET data        │ POST update  │ POST chat
   Backend  ▼               ▼                 ▼              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                   FastAPI Application Engine                │
   │  ┌───────────────────────┐       ┌───────────────────────┐  │
   │  │   Reports Aggregator  │       │   Data QA Validation  │  │
   │  └───────────┬───────────┘       └───────────┬───────────┘  │
   │              │                               │              │
   │  ┌───────────▼───────────┐       ┌───────────▼───────────┐  │
   │  │   In-Memory Database  │ <───> │ Gemini Assistant SDK  │  │
   │  └───────────────────────┘       └───────────────────────┘  │
   └─────────────────────────────────────────────────────────────┘
```

---

## 🗃️ Data Schemas

### 1. CRM Sales Table
* `id` (str): Unique Deal ID (e.g. `CRM-001`)
* `date` (str): Deal closing date (`YYYY-MM-DD`)
* `client` (str): Client corporate name (e.g. `Vega Logistics`)
* `product` (str): Product package sold (e.g. `Quantum Server Pack`)
* `amount` (float): Gross deal valuation ($)
* `region` (str): Regional sales category (e.g. `North America`)
* `sales_agent` (str): Managing sales representative
* `status` (str): Pipeline status (`Closed Won` or `In Pipeline`)

### 2. ERP General Ledger
* `id` (str): GL entry ID (e.g. `ERP-001`)
* `date` (str): Posting date
* `account` (str): Target chart of account (e.g. `Cash`, `Sales Revenue`, `Rent Expense`)
* `type` (str): Transaction indicator (`Debit` or `Credit`)
* `amount` (float): Value posted ($)
* `authorized_by` (str): Email of posting authorizer

### 3. Production Factory Output
* `id` (str): Ingested Batch ID (e.g. `PRD-001`)
* `date` (str): Production date
* `machine_id` (str): Assembly machine identifier (e.g. `Assembler-A1`)
* `units_produced` (int): Count of gross output units
* `defects` (int): Count of defective units flagged
* `efficiency_pct` (float): Running machine performance index (%)

---

## ⚙️ Quick Start & Installation

### Requirements
* Python 3.11+
* `uv` (Fast Python Package Manager)

### 1. Set Up Environment
First, clone the codebase. Then, install dependencies:
```bash
uv sync
```

*(Optional)* Configure your Gemini API key to enable live AI Assistant capabilities:
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="your_api_key_here"

# Linux / Mac Bash
export GEMINI_API_KEY="your_api_key_here"
```
*Note: If no API key is specified, AuraBI will automatically launch in **intelligent mock mode**, delivering contextual pre-calculated responses.*

### 2. Launch Local Server
Start the FastAPI server:
```bash
uv run uvicorn app.main:app --reload --port 8000
```
Open your browser and navigate to: **[http://localhost:8000](http://localhost:8000)**

---

## 🧪 Verification & Automated Tests
We have built a test suite with 100% pass verification covering validation rules, reporting aggregates, and RBAC security routing.

To execute the unit tests:
```bash
uv run pytest
```
