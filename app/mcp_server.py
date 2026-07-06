# -*- coding: utf-8 -*-
"""
mcp_server.py
Standard Model Context Protocol (MCP) server exposing AuraBI data and tools.
Compatible with stdio transport for local agent orchestration.
"""

import asyncio
import json
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from app.data_sources import db, get_anomalies
from app.reports import get_sales_revenue_report, get_trial_balance_report, get_production_output_report

# Initialize the MCP Server
server = Server("AuraBI-Data-Connector")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """Exposes AuraBI tools to Model Context Protocol clients."""
    return [
        types.Tool(
            name="get_bi_reports",
            description="Get standard sales, trial balance, and production output reports for Solaris Nexus Inc.",
            inputSchema={
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string", 
                        "description": "Active user security role: Viewer, Super User, Admin (Default: Viewer)"
                    }
                }
            }
        ),
        types.Tool(
            name="get_raw_data",
            description="Get raw transactional tables (CRM, ERP, Production) and identified data anomalies. Restricted to Admin & Super User roles.",
            inputSchema={
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string", 
                        "description": "Active user security role (requires Admin or Super User)"
                    }
                },
                "required": ["role"]
            }
        ),
        types.Tool(
            name="correct_data_anomaly",
            description="Correct a specific cell/field value in the raw tables to repair data quality. Restricted to Admin role.",
            inputSchema={
                "type": "object",
                "properties": {
                    "dataset": {
                        "type": "string", 
                        "description": "Name of the target dataset (crm, erp, production)"
                    },
                    "record_id": {
                        "type": "string", 
                        "description": "Target record unique identifier (e.g. CRM-003)"
                    },
                    "field": {
                        "type": "string", 
                        "description": "Field name to be modified (e.g. amount)"
                    },
                    "value": {
                        "type": "string", 
                        "description": "The corrected value as a string representation"
                    },
                    "role": {
                        "type": "string", 
                        "description": "Active user security role (requires Admin)"
                    }
                },
                "required": ["dataset", "record_id", "field", "value", "role"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    """Executes MCP tool calls and returns JSON formatted responses."""
    if not arguments:
        arguments = {}

    role = arguments.get("role", "Viewer")

    if name == "get_bi_reports":
        reports = {
            "sales": get_sales_revenue_report(),
            "erp": get_trial_balance_report(),
            "production": get_production_output_report()
        }
        return [types.TextContent(type="text", text=json.dumps(reports, indent=2))]

    elif name == "get_raw_data":
        if role not in ["Admin", "Super User"]:
            return [
                types.TextContent(
                    type="text", 
                    text="Error: Access Denied. The Viewer role is unauthorized to view raw transactional tables."
                )
            ]
        data = {
            "crm": db.crm,
            "erp": db.erp,
            "production": db.production,
            "anomalies": get_anomalies()
        }
        return [types.TextContent(type="text", text=json.dumps(data, indent=2))]

    elif name == "correct_data_anomaly":
        if role != "Admin":
            return [
                types.TextContent(
                    type="text", 
                    text="Error: Access Denied. Only Admins are authorized to correct raw transactional records."
                )
            ]
        
        dataset = arguments.get("dataset")
        record_id = arguments.get("record_id")
        field = arguments.get("field")
        value = arguments.get("value")

        success = db.update_record(dataset, record_id, field, value)
        if not success:
            return [
                types.TextContent(
                    type="text", 
                    text=f"Error: Failed to update {dataset} record {record_id}. Verify database constraints and types."
                )
            ]

        return [
            types.TextContent(
                type="text", 
                text=f"Success: Corrected {dataset} record {record_id}: {field} set to {value}. Standard reports recalculated."
            )
        ]

    else:
        raise ValueError(f"Unknown MCP tool request: '{name}'")

async def main():
    """Runs the MCP server over standard Input/Output transport."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
