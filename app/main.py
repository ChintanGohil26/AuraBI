# -*- coding: utf-8 -*-
"""
main.py
FastAPI application backend for AuraBI.
Enforces security controls, mounts the static dashboard, and exposes
a Model Context Protocol (MCP) server over SSE (Server-Sent Events) at /mcp/sse.
"""

import os
import json
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile, File, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from mcp.server.fastmcp import FastMCP

from app.data_sources import db, get_anomalies
from app.reports import get_sales_revenue_report, get_trial_balance_report, get_production_output_report
from app.agent_utils import query_assistant

# 1. Initialize FastAPI Server
app = FastAPI(
    title="AuraBI Platform",
    description="Backend API and dashboard server for AuraBI capstone project",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Initialize FastMCP Server
mcp = FastMCP("AuraBI-Data-Connector")

# Helper functions for safe CSV type conversions
def safe_float(val, default=0.0):
    if val is None or str(val).strip() == "":
        return default
    try:
        return float(val)
    except ValueError:
        return default

def safe_int(val, default=0):
    if val is None or str(val).strip() == "":
        return default
    try:
        return int(val)
    except ValueError:
        return default

# Define MCP Tools (Exposed over /mcp/sse)

@mcp.tool()
def get_bi_reports(role: str = "Viewer") -> str:
    """
    Get standard sales, trial balance, and production output reports for Solaris Nexus Inc.
    
    Args:
        role: The active user security role (Viewer, Super User, Admin)
    """
    reports = {
        "sales": get_sales_revenue_report(),
        "erp": get_trial_balance_report(),
        "production": get_production_output_report()
    }
    return json.dumps(reports, indent=2)

@mcp.tool()
def get_raw_data(role: str) -> str:
    """
    Get raw transactional tables (CRM, ERP, Production) and identified data anomalies.
    Restricted to Admin & Super User roles.
    
    Args:
        role: Active user security role (requires Admin or Super User)
    """
    if role not in ["Admin", "Super User"]:
        return "Error: Access Denied. The Viewer role is unauthorized to view raw transactional tables."
    data = {
        "crm": db.crm,
        "erp": db.erp,
        "production": db.production,
        "anomalies": get_anomalies()
    }
    return json.dumps(data, indent=2)

@mcp.tool()
def correct_data_anomaly(dataset: str, record_id: str, field: str, value: str, role: str) -> str:
    """
    Correct a specific cell/field value in the raw tables to repair data quality.
    Restricted to Admin role.
    
    Args:
        dataset: Name of the target dataset (crm, erp, production)
        record_id: Target record unique identifier (e.g. CRM-003)
        field: Field name to be modified (e.g. amount)
        value: The corrected value as a string representation
        role: Active user security role (requires Admin)
    """
    if role != "Admin":
        return "Error: Access Denied. Only Admins are authorized to correct raw transactional records."
    success = db.update_record(dataset, record_id, field, value)
    if not success:
        return f"Error: Failed to update {dataset} record {record_id}. Verify database constraints and types."
    return f"Success: Corrected {dataset} record {record_id}: {field} set to {value}. Standard reports recalculated."

@mcp.tool()
def export_data_cube(role: str = "Viewer") -> str:
    """
    Export the unified multi-dimensional Data Cube for Solaris Nexus Inc. as a CSV string.
    This can be easily parsed and imported into other ERP or database software.
    
    Args:
        role: Active user security role: Viewer, Super User, Admin
    """
    if role not in ["Admin", "Super User"]:
        return "Error: Access Denied. Viewer role is unauthorized to export raw data cubes."
    
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(["Date", "SourceTable", "RecordID", "DimensionKey", "RegionLocation", "AmountMeasure", "Status"])
    
    # Ingest CRM Sales
    for row in db.crm:
        writer.writerow([
            row.get("date"),
            "CRM",
            row.get("id"),
            row.get("product") or "Unspecified",
            row.get("region"),
            row.get("amount"),
            row.get("status")
        ])
        
    # Ingest ERP GL
    for row in db.erp:
        writer.writerow([
            row.get("date"),
            "ERP",
            row.get("id"),
            row.get("account"),
            row.get("type"),
            row.get("amount"),
            row.get("authorized_by")
        ])
        
    # Ingest Production
    for row in db.production:
        writer.writerow([
            row.get("date"),
            "Production",
            row.get("id"),
            row.get("machine_id"),
            "Plant-Floor",
            row.get("units_produced"),
            f"Defects:{row.get('defects')}"
        ])
        
    return output.getvalue()


# Mount the MCP SSE application at /mcp
# This automatically handles endpoints like /mcp/sse and /mcp/messages
app.mount("/mcp", mcp.sse_app())


# Helper to verify role permission
def verify_role_permission(role: str, required_roles: list[str]):
    if role not in required_roles:
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied: Role '{role}' does not have permission for this operation. Required: {required_roles}"
        )

# Pydantic models for request bodies
class UpdateRecordRequest(BaseModel):
    dataset: str = Field(..., description="Name of the dataset (crm, erp, production)")
    id: str = Field(..., description="Record ID to update")
    field: str = Field(..., description="Field name to update")
    value: str = Field(..., description="New value as string")

class ChatRequest(BaseModel):
    message: str = Field(..., description="Message from the user")

class PubSubEnvelope(BaseModel):
    message: dict = Field(..., description="The Pub/Sub message dictionary containing 'data' and 'attributes'")
    subscription: str = Field(..., description="Subscription name")

@app.post("/api/pubsub/push")
async def pubsub_push_trigger(envelope: PubSubEnvelope, role: str = Query("Admin", description="Active role context")):
    """
    Mock Google Cloud Pub/Sub Push Subscription endpoint.
    Decodes GCP Pub/Sub messages (e.g. from GCS file upload events) and ingests the data.
    """
    import base64
    from datetime import datetime
    try:
        msg = envelope.message
        if "data" not in msg:
            raise HTTPException(status_code=400, detail="Invalid Pub/Sub message format: 'data' field missing.")
            
        # Decode base64 payload
        decoded_bytes = base64.b64decode(msg["data"])
        decoded_str = decoded_bytes.decode("utf-8-sig")
        
        # Determine target from attributes or default to crm
        attributes = msg.get("attributes", {}) or {}
        target = attributes.get("target", "crm").lower()
        
        # Simulate parsing and ingesting the CSV records
        rows = decoded_str.strip().split("\n")
        if len(rows) < 2:
            return {"status": "success", "message": "Pub/Sub message empty or no header"}
            
        import csv
        from io import StringIO
        f = StringIO(decoded_str)
        reader = csv.DictReader(f)
        
        count = 0
        for row in reader:
            if target == "crm":
                row["amount"] = safe_float(row.get("amount"), 0.0)
                db.crm.append(row)
            elif target == "erp":
                row["amount"] = safe_float(row.get("amount"), 0.0)
                db.erp.append(row)
            elif target == "production":
                row["units_produced"] = safe_int(row.get("units_produced"), 0)
                row["defects"] = safe_int(row.get("defects"), 0)
                row["efficiency_pct"] = safe_float(row.get("efficiency_pct"), 0.0)
                db.production.append(row)
            count += 1
            
        db.report_workflow["history"].append(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Ingested {count} records from Pub/Sub event subscriber."
        )
        
        return {
            "status": "success",
            "message": f"Decoded GCP Pub/Sub message. Ingested {count} records into target table '{target.upper()}'."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Pub/Sub processing error: {str(e)}")

class AdvanceWorkflowRequest(BaseModel):
    action: str = Field(..., description="Action to perform (submit_review, sme_approve, team_approve, publish_group)")
    recipient_email: str = Field(None, description="Optional corporate email to forward the report to")

@app.get("/api/workflow")
def get_report_workflow():
    """
    Returns the current report lifecycle approval status.
    """
    return db.report_workflow

@app.post("/api/workflow/advance")
def advance_report_workflow(req: AdvanceWorkflowRequest, role: str = Query("Viewer", description="Active user security role")):
    """
    Advances the BI Specialist -> SME -> Team -> Publish approval stage.
    """
    from datetime import datetime
    step = db.report_workflow["step"]
    
    if req.action == "submit_review":
        if step != 1:
            raise HTTPException(status_code=400, detail="Workflow must be at Step 1 to submit for review.")
        verify_role_permission(role, ["Admin"]) # BI Specialist is Admin
        db.report_workflow["step"] = 2
        db.report_workflow["status"] = "Pending SME Review"
        db.report_workflow["assigned_to"] = "SME (Super User)"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] BI Specialist (Admin) submitted the report for SME review.")
        
    elif req.action == "sme_approve":
        if step != 2:
            raise HTTPException(status_code=400, detail="Workflow must be at Step 2 for SME approval.")
        verify_role_permission(role, ["Super User", "Admin"]) # SME is Super User or Admin
        
        email = req.recipient_email
        if not email:
            raise HTTPException(status_code=400, detail="Recipient corporate email is required to forward report link.")
            
        email_clean = email.strip().lower()
        if not email_clean.endswith("@solaris.com"):
            db.report_workflow["history"].append(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚨 SECURITY ALERT: Blocked PII egress leak attempt to unauthorized recipient: {email}"
            )
            raise HTTPException(
                status_code=400, 
                detail=f"PII Leakage Blocked: Recipient '{email}' is outside the authorized corporate directory (@solaris.com)."
            )
            
        db.report_workflow["step"] = 3
        db.report_workflow["status"] = "Pending Team Feedback"
        db.report_workflow["assigned_to"] = "Respect Team Members"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SME approved report. Emailed secure link to authorized recipient: {email_clean}")
        
    elif req.action == "team_approve":
        if step != 3:
            raise HTTPException(status_code=400, detail="Workflow must be at Step 3 for Team approval.")
        db.report_workflow["step"] = 4
        db.report_workflow["status"] = "Approved by Team"
        db.report_workflow["assigned_to"] = "BI Specialist"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Respect Team members approved report details via email link.")
        
    elif req.action == "publish_group":
        if step != 4:
            raise HTTPException(status_code=400, detail="Workflow must be at Step 4 to publish.")
        verify_role_permission(role, ["Admin"]) # BI Specialist is Admin
        db.report_workflow["step"] = 5
        db.report_workflow["status"] = "Published"
        db.report_workflow["assigned_to"] = "Corporate User Directory"
        db.report_workflow["history"].append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] BI Specialist (Admin) published the report live to corporate user group.")
    else:
        raise HTTPException(status_code=400, detail="Invalid workflow action.")
        
    return db.report_workflow


@app.get("/api/reports")
def get_reports(role: str = Query("Viewer", description="Active user security role")):
    """
    Returns standard reports. Accessible by ALL roles.
    This provides aggregated metrics for the dashboard view.
    """
    return {
        "sales": get_sales_revenue_report(),
        "erp": get_trial_balance_report(),
        "production": get_production_output_report()
    }


@app.get("/api/reports/export")
def export_reports_cube(role: str = Query("Viewer", description="Active user security role")):
    """
    Generates and downloads a CSV Data Cube for Solaris Nexus Inc.
    Restricted to Admin and Super User roles.
    """
    verify_role_permission(role, ["Admin", "Super User"])
    
    csv_content = export_data_cube(role)
    if csv_content.startswith("Error"):
        raise HTTPException(status_code=403, detail=csv_content)
        
    headers = {
        "Content-Disposition": "attachment; filename=solaris_nexus_datacube.csv"
    }
    return Response(content=csv_content, media_type="text/csv", headers=headers)


@app.get("/api/data")
def get_raw_data_endpoint(role: str = Query("Viewer", description="Active user security role")):
    """
    Returns raw tables and anomalies.
    Restricted to Admin and Super User roles.
    """
    verify_role_permission(role, ["Admin", "Super User"])
    
    return {
        "crm": db.crm,
        "erp": db.erp,
        "production": db.production,
        "external": db.external,
        "anomalies": get_anomalies()
    }


@app.post("/api/data/update")
def update_data_record(req: UpdateRecordRequest, role: str = Query("Viewer", description="Active user security role")):
    """
    Updates a single cell in the mock database (Data Quality Correction).
    Restricted to Admin role only.
    """
    verify_role_permission(role, ["Admin"])
    
    success = db.update_record(req.dataset, req.id, req.field, req.value)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update record. Verify ID, dataset, or data types.")
        
    return {
        "status": "success",
        "message": f"Updated {req.dataset} record {req.id}: {req.field} = {req.value}",
        "anomalies": get_anomalies(),
        "reports": {
            "sales": get_sales_revenue_report(),
            "erp": get_trial_balance_report(),
            "production": get_production_output_report()
        }
    }


@app.post("/api/data/sync")
def sync_etl_pipeline(role: str = Query("Viewer", description="Active user security role")):
    """
    Simulates triggering an ETL pipeline sync.
    Restricted to Admin and Super User roles.
    """
    verify_role_permission(role, ["Admin", "Super User"])
    
    db.reset_data()
    
    return {
        "status": "success",
        "message": "ETL pipeline sync completed successfully. Connected databases refreshed.",
        "anomalies": get_anomalies()
    }


@app.post("/api/data/upload")
async def upload_csv_data(
    target: str = Query(..., description="Target dataset to ingest (crm, erp, production)"),
    file: UploadFile = File(...),
    role: str = Query("Viewer", description="Active user security role")
):
    """
    Manually ingests data from a CSV file.
    Restricted to Admin role only.
    """
    verify_role_permission(role, ["Admin"])
    
    contents = await file.read()
    decoded = contents.decode("utf-8-sig")
    
    import csv
    import io
    import uuid
    
    try:
        csv_reader = csv.DictReader(io.StringIO(decoded))
        records = []
        for row in csv_reader:
            record = {}
            for k, v in row.items():
                if not k:
                    continue
                key = k.strip()
                val = v.strip() if v else ""
                record[key] = val
            records.append(record)
            
        if not records:
             raise HTTPException(status_code=400, detail="The uploaded CSV file is empty or formatted incorrectly.")
             
        if target == "crm":
            for r in records:
                if not r.get("id"):
                    r["id"] = f"CRM-CSV-{uuid.uuid4().hex[:6].upper()}"
                r["amount"] = safe_float(r.get("amount"), 0.0)
                r["status"] = r.get("status", "Closed Won")
                db.crm.append(r)
        elif target == "erp":
            for r in records:
                if not r.get("id"):
                    r["id"] = f"ERP-CSV-{uuid.uuid4().hex[:6].upper()}"
                r["amount"] = safe_float(r.get("amount"), 0.0)
                r["type"] = r.get("type", "Debit")
                db.erp.append(r)
        elif target == "production":
            for r in records:
                if not r.get("id"):
                    r["id"] = f"PRD-CSV-{uuid.uuid4().hex[:6].upper()}"
                r["units_produced"] = safe_int(r.get("units_produced"), 0)
                r["defects"] = safe_int(r.get("defects"), 0)
                r["efficiency_pct"] = safe_float(r.get("efficiency_pct"), 0.0)
                db.production.append(r)
        else:
             raise HTTPException(status_code=400, detail="Invalid target dataset.")
             
        return {
            "status": "success",
            "message": f"Successfully ingested {len(records)} records into {target} database.",
            "anomalies": get_anomalies(),
            "reports": {
                "sales": get_sales_revenue_report(),
                "erp": get_trial_balance_report(),
                "production": get_production_output_report()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")


@app.post("/api/chat")
async def chatbot_interaction(req: ChatRequest, role: str = Query("Viewer", description="Active user security role")):
    """
    Built-in self-teaching AI Assistant chat endpoint.
    Accessible by all roles.
    """
    anomalies = get_anomalies()
    reports = {
        "sales": get_sales_revenue_report(),
        "erp": get_trial_balance_report(),
        "production": get_production_output_report()
    }
    
    reply = await query_assistant(req.message, role, anomalies, reports)
    return {"reply": reply}


# Static files routing
static_dir = os.path.join(os.path.dirname(__file__), "static")

@app.get("/")
def read_root():
    """Serves the main SPA dashboard index file."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AuraBI Dashboard UI is not built yet. Create static/index.html first."}

# Mount /static endpoint to serve style.css, script.js
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
