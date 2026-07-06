# -*- coding: utf-8 -*-
"""
agent.py
Defines the ADK Agent and its operational tools for AuraBI.
"""

import os
from google.adk.agents import Agent
from app.data_sources import db, get_anomalies
from app.reports import get_sales_revenue_report, get_trial_balance_report, get_production_output_report

# Model configuration
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Define tools for the ADK Agent

def get_business_reports(role: str) -> dict:
    """
    Get the standard sales, trial balance, and production output reports for Solaris Nexus Inc.
    
    Args:
        role: The active user security role (Viewer, Super User, Admin)
    """
    return {
        "sales": get_sales_revenue_report(),
        "erp": get_trial_balance_report(),
        "production": get_production_output_report()
    }

def get_integrity_anomalies(role: str) -> dict:
    """
    Get the active data quality anomalies list for Solaris Nexus Inc.
    
    Args:
        role: The active user security role (Viewer, Super User, Admin)
    """
    if role not in ["Admin", "Super User"]:
        return {"error": "Viewer role is unauthorized to view raw data quality details."}
    return get_anomalies()

def correct_data_value(dataset: str, record_id: str, field: str, value: str, role: str) -> dict:
    """
    Update/correct a single cell in the database. Restricted to Admin role.
    
    Args:
        dataset: Name of the dataset (crm, erp, production)
        record_id: Record ID to update
        field: Field name to update
        value: New value as string
        role: The active user security role
    """
    if role != "Admin":
        return {"error": "Only Admins are authorized to correct raw transactional records."}
        
    success = db.update_record(dataset, record_id, field, value)
    if not success:
        return {"error": "Failed to update record. Verify ID, dataset, or data types."}
        
    return {
        "status": "success", 
        "message": f"Successfully corrected {dataset} record {record_id}: {field} = {value}"
    }

def get_report_workflow_status(role: str) -> dict:
    """
    Get the current approval status of the BI report lifecycle (BI Specialist, SME Review, Team Approval, and Published status).
    
    Args:
        role: The active user security role
    """
    return db.report_workflow

def advance_report_workflow_stage(action: str, role: str) -> dict:
    """
    Advance the BI report release approval step. Actions:
    - 'submit_review': Submit BI draft for SME review (BI Specialist / Admin only)
    - 'sme_approve': Approve report and email link to team members (SME / Super User only)
    - 'team_approve': Verify team approval (Any role)
    - 'publish_group': Publish report live to corporate user groups (BI Specialist / Admin only)
    
    Args:
        action: The workflow transition step to perform (submit_review, sme_approve, team_approve, publish_group)
        role: The active user security role
    """
    from datetime import datetime
    step = db.report_workflow["step"]
    
    if action == "submit_review":
        if step != 1:
            return {"error": "Workflow must be at Step 1 to submit for review."}
        if role != "Admin":
            return {"error": "Access Denied: BI Specialist (Admin) role required."}
        db.report_workflow["step"] = 2
        db.report_workflow["status"] = "Pending SME Review"
        db.report_workflow["assigned_to"] = "SME (Super User)"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] BI Specialist (Admin) submitted the report for SME review via ADK.")
        
    elif action == "sme_approve":
        if step != 2:
            return {"error": "Workflow must be at Step 2 for SME approval."}
        if role not in ["Super User", "Admin"]:
            return {"error": "Access Denied: SME (Super User/Admin) role required."}
        db.report_workflow["step"] = 3
        db.report_workflow["status"] = "Pending Team Feedback"
        db.report_workflow["assigned_to"] = "Respect Team Members"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SME approved report via ADK. Emailed link to team.")
        
    elif action == "team_approve":
        if step != 3:
            return {"error": "Workflow must be at Step 3 for Team approval."}
        db.report_workflow["step"] = 4
        db.report_workflow["status"] = "Approved by Team"
        db.report_workflow["assigned_to"] = "BI Specialist"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Respect Team approved report details via ADK email link.")
        
    elif action == "publish_group":
        if step != 4:
            return {"error": "Workflow must be at Step 4 to publish."}
        if role != "Admin":
            return {"error": "Access Denied: BI Specialist (Admin) role required."}
        db.report_workflow["step"] = 5
        db.report_workflow["status"] = "Published"
        db.report_workflow["assigned_to"] = "Corporate User Directory"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] BI Specialist (Admin) published report live via ADK.")
    else:
        return {"error": "Invalid action name."}
        
    return db.report_workflow

# Create the ADK Agent instance
aurabi_agent = Agent(
    name="aurabi_agent",
    model=MODEL_NAME,
    instruction="""
    You are the built-in self-teaching AI Assistant for "AuraBI", a next-generation Business Intelligence tool.
    You help users analyze the business performance of Solaris Nexus Inc.
    You have tools to fetch reports, view data quality anomalies, correct raw data values, and manage the report release approval workflow.
    
    Report Lifecycle Workflow Stages:
    - Step 1: Draft (BI Specialist/Admin submits for review using 'submit_review')
    - Step 2: Pending SME Review (SME/Super User approves and emails team link using 'sme_approve')
    - Step 3: Pending Team Feedback (Team members verify using 'team_approve')
    - Step 4: Approved by Team (BI Specialist/Admin publishes live using 'publish_group')
    - Step 5: Published to Corporate Directory
    
    CRITICAL Security Guidelines:
    1. Before calling any tool, check the user's role:
       - Admin: Full access (can get reports, get anomalies, make corrections, and submit/publish workflows).
       - Super User: Can get reports, get anomalies, and approve SME review stage.
       - Viewer: Can only get reports and check workflow status (cannot modify data or advance restricted workflow steps).
    2. Reject unauthorized requests politely and explain that they lack appropriate clearance.
    3. Always explain your reasoning clearly and keep answers under 200 words.
    """,
    tools=[get_business_reports, get_integrity_anomalies, correct_data_value, get_report_workflow_status, advance_report_workflow_stage]
)
