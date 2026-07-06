# -*- coding: utf-8 -*-
"""
data_sources.py
Defines the fictional datasets and ETL ingestion schemas for Solaris Nexus Inc.
Includes built-in validation rules to detect anomalies in data.
"""

from datetime import datetime
import copy
from typing import Dict, List, Any, Tuple

# Fictional company name
COMPANY_NAME = "Solaris Nexus Inc."

# 1. CRM Mock Data (Sales Deals)
INITIAL_CRM_DATA = [
    {"id": "CRM-001", "date": "2026-06-01", "client": "Vega Logistics", "product": "Quantum Server Pack", "amount": 45000.0, "region": "North America", "sales_agent": "Sarah Connor", "status": "Closed Won"},
    {"id": "CRM-002", "date": "2026-06-03", "client": "Nebula Corp", "product": "Stellar Analytics Hub", "amount": 82000.0, "region": "Europe", "sales_agent": "John Doe", "status": "Closed Won"},
    {"id": "CRM-003", "date": "2026-06-05", "client": "Orion Retail", "product": "Aether Cloud Node", "amount": -12000.0, "region": "Asia-Pacific", "sales_agent": "Elena Rostova", "status": "Closed Won"},  # ANOMALY: Negative Amount
    {"id": "CRM-004", "date": "2026-06-08", "client": "Alpha Tech", "product": "Quantum Server Pack", "amount": 48000.0, "region": "North America", "sales_agent": "Sarah Connor", "status": "In Pipeline"},
    {"id": "CRM-005", "date": "2099-12-31", "client": "Future Labs", "product": "Aether Cloud Node", "amount": 55000.0, "region": "Europe", "sales_agent": "John Doe", "status": "Closed Won"},       # ANOMALY: Far Future Date
    {"id": "CRM-006", "date": "2026-06-12", "client": "Synergy Group", "product": "Stellar Analytics Hub", "amount": 95000.0, "region": "Asia-Pacific", "sales_agent": "Elena Rostova", "status": "Closed Won"},
    {"id": "CRM-007", "date": "2026-06-15", "client": "Titan Industries", "product": "", "amount": 60000.0, "region": "Latin America", "sales_agent": "Marcus Aurelius", "status": "Closed Won"},     # ANOMALY: Empty Product
    {"id": "CRM-008", "date": "2026-06-18", "client": "Apex Corp", "product": "Aether Cloud Node", "amount": 500000.0, "region": "North America", "sales_agent": "Sarah Connor", "status": "Closed Won"}, # ANOMALY: Large Outlier
    {"id": "CRM-009", "date": "2026-06-20", "client": "Nova Services", "product": "Quantum Server Pack", "amount": 42000.0, "region": "Latin America", "sales_agent": "Marcus Aurelius", "status": "Closed Won"},
]

# 2. ERP Mock Data (General Ledger)
# Debits must equal Credits for a Trial Balance to be correct.
# Initial Total Debits = 450,000; Total Credits = 445,000 (Off by 5,000 - ANOMALY)
INITIAL_ERP_DATA = [
    {"id": "ERP-001", "date": "2026-06-01", "account": "Cash", "type": "Debit", "amount": 250000.0, "authorized_by": "finance.dir@solaris.com"},
    {"id": "ERP-002", "date": "2026-06-01", "account": "Common Stock", "type": "Credit", "amount": 250000.0, "authorized_by": "finance.dir@solaris.com"},
    {"id": "ERP-003", "date": "2026-06-10", "account": "Rent Expense", "type": "Debit", "amount": 12000.0, "authorized_by": "controller@solaris.com"},
    {"id": "ERP-004", "date": "2026-06-10", "account": "Cash", "type": "Credit", "amount": 12000.0, "authorized_by": "controller@solaris.com"},
    {"id": "ERP-005", "date": "2026-06-15", "account": "Accounts Receivable", "type": "Debit", "amount": 188000.0, "authorized_by": "billing@solaris.com"},
    {"id": "ERP-006", "date": "2026-06-15", "account": "Sales Revenue", "type": "Credit", "amount": 183000.0, "authorized_by": "billing@solaris.com"}, # ANOMALY: Credits off by 5000 (Revenue under-credited)
    {"id": "ERP-007", "date": "2026-06-22", "account": "Office Supplies Expense", "type": "Debit", "amount": -1500.0, "authorized_by": "purchasing@solaris.com"}, # ANOMALY: Negative Expense
]

# 3. Production Mock Data (Manufacturing Plant Output)
INITIAL_PRODUCTION_DATA = [
    {"id": "PRD-001", "date": "2026-06-01", "machine_id": "Assembler-A1", "units_produced": 500, "defects": 5, "efficiency_pct": 99.0},
    {"id": "PRD-002", "date": "2026-06-02", "machine_id": "Assembler-A1", "units_produced": 480, "defects": 12, "efficiency_pct": 97.5},
    {"id": "PRD-003", "date": "2026-06-03", "machine_id": "Assembler-A1", "units_produced": 450, "defects": 500, "efficiency_pct": 89.0}, # ANOMALY: Defects > Units Produced
    {"id": "PRD-004", "date": "2026-06-01", "machine_id": "Forge-B2", "units_produced": 200, "defects": 2, "efficiency_pct": 99.0},
    {"id": "PRD-005", "date": "2026-06-02", "machine_id": "Forge-B2", "units_produced": 190, "defects": 3, "efficiency_pct": 105.0}, # ANOMALY: Efficiency > 100%
    {"id": "PRD-006", "date": "2026-06-03", "machine_id": "Forge-B2", "units_produced": 180, "defects": 4, "efficiency_pct": -5.0},   # ANOMALY: Negative Efficiency
]

# 4. External Market/Weather API
INITIAL_EXTERNAL_DATA = [
    {"date": "2026-06-01", "market_index": 5200.5, "temp_c": 22.5, "demand_factor": 1.0},
    {"date": "2026-06-02", "market_index": 5215.2, "temp_c": 23.1, "demand_factor": 1.02},
    {"date": "2026-06-03", "market_index": 5190.8, "temp_c": 21.8, "demand_factor": 0.98},
    {"date": "2026-06-10", "market_index": 5240.1, "temp_c": 25.0, "demand_factor": 1.05},
    {"date": "2026-06-15", "market_index": 5255.4, "temp_c": 26.2, "demand_factor": 1.08},
    {"date": "2026-06-22", "market_index": 5230.9, "temp_c": 24.8, "demand_factor": 1.04},
]


class DatabaseState:
    """Manages the in-memory database state so we can simulate data correction."""
    def __init__(self):
        self.crm = copy.deepcopy(INITIAL_CRM_DATA)
        self.erp = copy.deepcopy(INITIAL_ERP_DATA)
        self.production = copy.deepcopy(INITIAL_PRODUCTION_DATA)
        self.external = copy.deepcopy(INITIAL_EXTERNAL_DATA)
        self.report_workflow = {
            "step": 1,
            "status": "Draft",
            "assigned_to": "BI Specialist",
            "history": ["BI Specialist initialized report draft and model schema."]
        }

    def reset_data(self):
        """Resets the state back to original database mock state."""
        self.crm = copy.deepcopy(INITIAL_CRM_DATA)
        self.erp = copy.deepcopy(INITIAL_ERP_DATA)
        self.production = copy.deepcopy(INITIAL_PRODUCTION_DATA)
        self.external = copy.deepcopy(INITIAL_EXTERNAL_DATA)
        self.report_workflow = {
            "step": 1,
            "status": "Draft",
            "assigned_to": "BI Specialist",
            "history": ["BI Specialist initialized report draft and model schema."]
        }

    def update_record(self, dataset_name: str, record_id: str, field: str, value: Any) -> bool:
        """Updates a specific field in a record by ID."""
        dataset = getattr(self, dataset_name, None)
        if not dataset:
            return False
            
        for row in dataset:
            if row.get("id") == record_id:
                # Convert types appropriately
                try:
                    if isinstance(row[field], float):
                        row[field] = float(value)
                    elif isinstance(row[field], int):
                        row[field] = int(value)
                    else:
                        row[field] = str(value)
                    return True
                except (ValueError, TypeError):
                    return False
        return False


# Singleton instance
db = DatabaseState()


def get_anomalies() -> Dict[str, List[Dict[str, Any]]]:
    """
    Performs data quality checks across CRM, ERP, and Production sources.
    Returns a dictionary of flagged anomalies.
    """
    anomalies = {
        "crm": [],
        "erp": [],
        "production": [],
        "system": []
    }
    
    # 1. CRM checks
    for idx, row in enumerate(db.crm):
        # Negative Amount
        if row["amount"] < 0:
            anomalies["crm"].append({
                "id": row["id"],
                "field": "amount",
                "value": row["amount"],
                "reason": "Amount cannot be negative.",
                "severity": "High"
            })
        # Date check
        try:
            dt = datetime.strptime(row["date"], "%Y-%m-%d")
            if dt.year > 2026:
                anomalies["crm"].append({
                    "id": row["id"],
                    "field": "date",
                    "value": row["date"],
                    "reason": f"Ingestion date is in the future ({dt.year}).",
                    "severity": "Medium"
                })
        except ValueError:
            anomalies["crm"].append({
                "id": row["id"],
                "field": "date",
                "value": row["date"],
                "reason": "Date format should be YYYY-MM-DD.",
                "severity": "High"
            })
        # Empty Product
        if not row["product"] or row["product"].strip() == "":
            anomalies["crm"].append({
                "id": row["id"],
                "field": "product",
                "value": row["product"],
                "reason": "Product name cannot be empty.",
                "severity": "High"
            })
        # Outlier Amount
        if row["amount"] > 300000.0:
            anomalies["crm"].append({
                "id": row["id"],
                "field": "amount",
                "value": row["amount"],
                "reason": "Transaction amount is unusually high (outlier).",
                "severity": "Low"
            })

    # 2. ERP checks
    total_debit = 0.0
    total_credit = 0.0
    
    for row in db.erp:
        amount = row["amount"]
        if amount < 0:
            anomalies["erp"].append({
                "id": row["id"],
                "field": "amount",
                "value": amount,
                "reason": "Ledger entry amount cannot be negative.",
                "severity": "High"
            })
            
        if row["type"] == "Debit":
            total_debit += amount
        elif row["type"] == "Credit":
            total_credit += amount

    # Trial Balance Check (System Anomaly)
    if abs(total_debit - total_credit) > 0.01:
        anomalies["system"].append({
            "id": "SYS-TB-001",
            "field": "Trial Balance Balance",
            "value": f"Debits: {total_debit}, Credits: {total_credit}",
            "reason": f"Trial balance is asymmetrical. Difference: ${abs(total_debit - total_credit):,.2f}.",
            "severity": "Critical"
        })

    # 3. Production checks
    for row in db.production:
        units = row["units_produced"]
        defects = row["defects"]
        eff = row["efficiency_pct"]
        
        if defects > units:
            anomalies["production"].append({
                "id": row["id"],
                "field": "defects",
                "value": defects,
                "reason": f"Defects ({defects}) exceed total units produced ({units}).",
                "severity": "High"
            })
        if defects < 0:
            anomalies["production"].append({
                "id": row["id"],
                "field": "defects",
                "value": defects,
                "reason": "Defects count cannot be negative.",
                "severity": "High"
            })
        if eff > 100.0:
            anomalies["production"].append({
                "id": row["id"],
                "field": "efficiency_pct",
                "value": eff,
                "reason": f"Machine efficiency cannot exceed 100% (currently {eff}%).",
                "severity": "Medium"
            })
        if eff < 0.0:
            anomalies["production"].append({
                "id": row["id"],
                "field": "efficiency_pct",
                "value": eff,
                "reason": f"Machine efficiency cannot be negative (currently {eff}%).",
                "severity": "High"
            })

    return anomalies
