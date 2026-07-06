# -*- coding: utf-8 -*-
"""
reports.py
Performs BI aggregation on ERP, CRM, and Production data.
Provides standard reports for Sales, Trial Balance, and Production Output.
"""

from typing import Dict, List, Any
from app.data_sources import db

def get_sales_revenue_report() -> Dict[str, Any]:
    """
    Aggregates CRM sales details.
    Calculates total revenue, revenue by region, sales by product, and metrics.
    """
    total_revenue = 0.0
    active_deals = 0
    closed_won_deals = 0
    by_region = {}
    by_product = {}
    
    for row in db.crm:
        # We only aggregate Closed Won deals for revenue, but track others
        amount = row["amount"]
        status = row["status"]
        region = row["region"]
        product = row["product"] or "Unspecified Product"
        
        if status == "Closed Won":
            total_revenue += amount
            closed_won_deals += 1
            by_region[region] = by_region.get(region, 0.0) + amount
            by_product[product] = by_product.get(product, 0.0) + amount
        
        active_deals += 1

    avg_deal_size = total_revenue / closed_won_deals if closed_won_deals > 0 else 0.0
    
    # Format regions and products for easy graphing
    region_chart = [{"label": k, "value": v} for k, v in by_region.items()]
    product_chart = [{"label": k, "value": v} for k, v in by_product.items()]
    
    return {
        "total_revenue": total_revenue,
        "deals_count": active_deals,
        "closed_won_count": closed_won_deals,
        "average_deal_size": avg_deal_size,
        "by_region": region_chart,
        "by_product": product_chart
    }

def get_trial_balance_report() -> Dict[str, Any]:
    """
    Compiles General Ledger accounts into a Trial Balance statement.
    Verifies that Debits equal Credits.
    """
    accounts = {}
    total_debits = 0.0
    total_credits = 0.0
    
    for row in db.erp:
        account_name = row["account"]
        amount = row["amount"]
        entry_type = row["type"]
        
        if account_name not in accounts:
            accounts[account_name] = {"debit": 0.0, "credit": 0.0}
            
        if entry_type == "Debit":
            accounts[account_name]["debit"] += amount
            total_debits += amount
        elif entry_type == "Credit":
            accounts[account_name]["credit"] += amount
            total_credits += amount

    # Format accounts for tabular display
    ledger_entries = []
    for acc_name, balances in accounts.items():
        ledger_entries.append({
            "account": acc_name,
            "debit": balances["debit"],
            "credit": balances["credit"]
        })
        
    balance_difference = abs(total_debits - total_credits)
    status = "Balanced" if balance_difference < 0.01 else "Out of Balance"
    
    return {
        "ledger": ledger_entries,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "difference": balance_difference,
        "status": status
    }

def get_production_output_report() -> Dict[str, Any]:
    """
    Aggregates manufacturing plant telemetry.
    Calculates yield, defect rates, and machine performance.
    """
    total_produced = 0
    total_defects = 0
    machine_stats = {}
    
    for row in db.production:
        machine = row["machine_id"]
        produced = row["units_produced"]
        defects = row["defects"]
        eff = row["efficiency_pct"]
        
        total_produced += produced
        total_defects += defects
        
        if machine not in machine_stats:
            machine_stats[machine] = {
                "units_produced": 0,
                "defects": 0,
                "efficiency_sum": 0.0,
                "records_count": 0
            }
            
        machine_stats[machine]["units_produced"] += produced
        machine_stats[machine]["defects"] += defects
        machine_stats[machine]["efficiency_sum"] += eff
        machine_stats[machine]["records_count"] += 1

    overall_defect_rate = (total_defects / total_produced * 100.0) if total_produced > 0 else 0.0
    
    machines = []
    for name, stats in machine_stats.items():
        m_produced = stats["units_produced"]
        m_defects = stats["defects"]
        avg_eff = stats["efficiency_sum"] / stats["records_count"] if stats["records_count"] > 0 else 0.0
        m_defect_rate = (m_defects / m_produced * 100.0) if m_produced > 0 else 0.0
        
        machines.append({
            "machine_id": name,
            "units_produced": m_produced,
            "defects": m_defects,
            "defect_rate": m_defect_rate,
            "average_efficiency": avg_eff
        })
        
    return {
        "total_produced": total_produced,
        "total_defects": total_defects,
        "overall_defect_rate": overall_defect_rate,
        "machines": machines
    }
