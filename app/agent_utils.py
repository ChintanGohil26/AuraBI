# -*- coding: utf-8 -*-
"""
agent_utils.py
Integrates the ADK Agent (aurabi_agent) runner for AuraBI.
Uses ADK InMemorySessionService to persist sessions and supports mock fallbacks.
"""

import os
import logging
import re
from datetime import datetime
from typing import Dict, Any, List

from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from app.agent import aurabi_agent
from app.data_sources import db

# Configure logger
logger = logging.getLogger(__name__)

SUSPICIOUS_PATTERNS = [
    r"ignore\s+(?:previous|above|system)\s+instructions",
    r"bypass\s+(?:safety|security|restrictions|role)",
    r"you\s+are\s+now\s+(?:in\s+)?(?:developer|god|dan)\s+mode",
    r"system\s+override",
    r"jailbreak",
    r"forget\s+(?:about\s+)?your\s+(?:instructions|restrictions|rules)",
    r"override\s+(?:your\s+)?system",
    r"act\s+as\s+a\s+(?:developer|admin|unrestricted)",
    r"ignore\s+role\s+restrictions",
    r"new\s+rule:",
    r"prompt\s+injection"
]

def check_prompt_injection(user_query: str) -> bool:
    """
    Scans the user query against known prompt injection and jailbreak patterns.
    """
    query_lower = user_query.lower()
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, query_lower):
            return True
    return False

# Try to check if GEMINI_API_KEY is available
api_key = os.environ.get("GEMINI_API_KEY")
use_real_agent = False

session_service = None
if api_key:
    try:
        session_service = InMemorySessionService()
        use_real_agent = True
        logger.info("ADK Agent Runner initialized with GEMINI_API_KEY.")
    except Exception as e:
        logger.error(f"Error initializing ADK Agent: {e}")
else:
    logger.warning("GEMINI_API_KEY not found. Running AI Assistant in MOCK Mode.")

async def query_assistant(
    user_query: str, 
    role: str, 
    anomalies: Dict[str, List[Dict[str, Any]]], 
    reports: Dict[str, Any]
) -> str:
    """
    Sends the user query to the ADK agent using the ADK Runner.
    Automatically applies context injections. Falls back to mock if no API key.
    """
    if check_prompt_injection(user_query):
        db.report_workflow["history"].append(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚨 SECURITY ALERT: Blocked AI Assistant prompt injection attempt: '{user_query}'"
        )
        return (
            "🔒 **Prompt Injection Guard**: Security restriction triggered. Your query contains patterns indicating "
            "a prompt injection or system override attempt. Access has been denied."
        )
        
    if use_real_agent and session_service:
        try:
            # We create a session for the user query
            session_id = f"sess_{role.lower()}"
            try:
                await session_service.create_session(
                    app_name="aurabi", 
                    user_id="default_user", 
                    session_id=session_id
                )
            except Exception:
                # Session might already exist, which is fine
                pass

            runner = Runner(
                agent=aurabi_agent, 
                app_name="aurabi", 
                session_service=session_service
            )

            # Package context with user request
            prompt_payload = f"""
            Active Role Context: {role}
            User Question: {user_query}
            
            Instruction: Execute the appropriate tool to fetch reports or anomalies or make corrections if the user asks. Remember to check permissions first.
            """

            final_text = ""
            async for event in runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt_payload)]
                )
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    final_text = event.content.parts[0].text
                    break
            
            if final_text:
                return final_text
                
        except Exception as e:
            logger.error(f"ADK Runner execution error: {e}")
            # Fall through to mock response if generation fails

    # --- INTELLIGENT MOCK ASSISTANT FALLBACK ---
    query_lower = user_query.lower()
    sales_rep = reports.get("sales", {})
    erp_rep = reports.get("erp", {})
    prd_rep = reports.get("production", {})

    if "anomaly" in query_lower or "correct" in query_lower or "incorrect" in query_lower or "error" in query_lower:
        if role == "Admin":
            return (
                "🚨 **ADK Tool Triggered**: Data Quality Correction check initiated. "
                "Since you are an **Admin**, you can correct these errors directly. Go to the **'Anomalies & QA'** tab, click 'Edit' next to the flagged record, correct the values, and click 'Save'. The dashboard will automatically recalculate!"
            )
        else:
            return (
                f"🚨 **ADK Tool Access Refused**: There are active data anomalies. "
                f"As a **{role}**, you have read-only access. Only **Admin** role can trigger the data correction tools."
            )
            
    if "trial balance" in query_lower or "ledger" in query_lower or "debit" in query_lower or "credit" in query_lower:
        status_msg = "balanced" if erp_rep.get('difference', 0.0) < 0.01 else "unbalanced"
        return (
            f"📊 **ADK Tool: get_business_reports**: A Trial Balance lists all general ledger accounts. "
            f"Currently, total debits are ${erp_rep.get('total_debits', 0.0):,.2f} and total credits are ${erp_rep.get('total_credits', 0.0):,.2f}, which makes the ledger **{status_msg}** (difference of ${erp_rep.get('difference', 0.0):,.2f}). "
            "To fix an unbalanced ledger, verify the journal entry amounts. Admin users can adjust ERP entries in the 'Anomalies & QA' table."
        )

    if "sales" in query_lower or "revenue" in query_lower or "crm" in query_lower:
        return (
            f"📈 **ADK Tool: get_business_reports**: Solaris Nexus Inc. has recorded **${sales_rep.get('total_revenue', 0.0):,.2f}** in total closed revenue from **{sales_rep.get('closed_won_count', 0)}** won deals. "
            f"The average deal size is **${sales_rep.get('average_deal_size', 0.0):,.2f}**. "
            "To visualize sales metrics, look at the regional revenue pie chart and product revenue bar chart in the main dashboard tab."
        )

    if "production" in query_lower or "machine" in query_lower or "defect" in query_lower:
        return (
            f"🏭 **ADK Tool: get_business_reports**: Our production plant produced **{prd_rep.get('total_produced', 0)}** total units with **{prd_rep.get('total_defects', 0)}** defects, "
            f"giving an overall defect rate of **{prd_rep.get('overall_defect_rate', 0.0):.2f}%**. "
            "Note that Machine PRD-003 is flagged for defects exceeding total units. Go to 'Anomalies & QA' to inspect and fix it."
        )

    if "role" in query_lower or "security" in query_lower:
        return (
            f"🔐 **Access Security**: You are signed in as a **{role}**. "
            "AuraBI supports three security roles: \n"
            "- **Admin**: Full control, ETL trigger, and inline data correction.\n"
            "- **Super User**: Read raw data, trigger ETL, and view anomalies (no editing).\n"
            "- **Viewer**: Can only see high-level aggregate charts and pre-generated reports. "
            "Use the Role Selector dropdown in the header to simulate other roles."
        )

    # General self-teaching response
    return (
        f"Welcome to **AuraBI**! I am your AI assistant running on the Google **Agent Development Kit (ADK)**. As a **{role}**, here's what you can do:\n"
        "- Ask me questions about **Solaris Nexus Inc.'s** current Sales Revenue, Trial Balance, or Production.\n"
        "- Learn how to fix **data anomalies** in the 'Anomalies & QA' tab.\n"
        "- Change your active role in the header to explore the built-in **Role-Based Access Control (RBAC)** security model."
    )
