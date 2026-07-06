/* 
   AuraBI Dashboard JS Application Engine
   Manages Application State, Role-Based Access Control, Graphing, and AI Interactions
*/

const state = {
    activeTab: 'tab-dashboard',
    activeRole: 'Viewer',
    securityMode: 'strict', // 'strict' or 'relaxed'
    anomalies: { crm: [], erp: [], production: [], system: [] },
    reports: { sales: {}, erp: {}, production: {} },
    rawData: { crm: [], erp: [], production: [], external: [] },
    charts: {
        productRev: null,
        regionRev: null
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// Event listeners setup
function setupEventListeners() {
    // Navigation Tabs
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Report sub-navigation
    const repButtons = document.querySelectorAll('.rep-tab-btn');
    repButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetRep = e.currentTarget.getAttribute('data-rep');
            switchReportTab(e.currentTarget, targetRep);
        });
    });

    // Login Screen Handlers
    const loginBtn = document.getElementById('btn-login-submit');
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            handlePortalLogin();
        });
    }
    
    if (pwdInput) {
        pwdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handlePortalLogin();
            }
        });
    }

    // Portal choice handlers (Admin/Super User navigation decision)
    const choiceEtl = document.getElementById('choice-etl-hub');
    const choiceReport = document.getElementById('choice-report-hub');
    
    if (choiceEtl) {
        choiceEtl.addEventListener('click', () => {
            enterPortalWorkspace('ETL');
        });
    }
    if (choiceReport) {
        choiceReport.addEventListener('click', () => {
            enterPortalWorkspace('Report');
        });
    }

    // Logout Handler
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handlePortalLogout();
        });
    }

    // Connectors Handlers
    const btnConnect = document.getElementById('btn-establish-connection');
    if (btnConnect) {
        btnConnect.addEventListener('click', () => {
            establishExternalConnection();
        });
    }

    // DAX Engine Handlers
    const daxPreset = document.getElementById('dax-preset-select');
    const daxInput = document.getElementById('dax-custom-input');
    const daxRunBtn = document.getElementById('btn-run-dax');
    const daxPublishBtn = document.getElementById('btn-publish-dax');

    if (daxPreset && daxInput) {
        daxPreset.addEventListener('change', (e) => {
            daxInput.value = e.target.value;
            if (daxPublishBtn) daxPublishBtn.style.display = 'none'; // reset publish button
        });
    }

    if (daxRunBtn) {
        daxRunBtn.addEventListener('click', () => {
            runDaxCalculation();
        });
    }

    if (daxPublishBtn) {
        daxPublishBtn.addEventListener('click', () => {
            publishDaxToDatabase();
        });
    }

    // ETL Sync Button
    const syncBtn = document.getElementById('btn-sync-etl');
    syncBtn.addEventListener('click', () => {
        triggerETLSync();
    });

    // Admin Settings Console Handlers
    const adminSecurityLevel = document.getElementById('admin-security-level');
    if (adminSecurityLevel) {
        adminSecurityLevel.addEventListener('change', (e) => {
            state.securityMode = e.target.value;
            logTelemetry(`SYSTEM: Global security mode set to ${e.target.value.toUpperCase()}.`);
            applyRoleSecurity();
        });
    }

    const btnAdminSync = document.getElementById('btn-admin-sync');
    if (btnAdminSync) {
        btnAdminSync.addEventListener('click', () => {
            logTelemetry("SYSTEM: Full database sync requested by Admin.");
            triggerETLSync();
        });
    }

    const btnAdminPurge = document.getElementById('btn-admin-purge-measures');
    if (btnAdminPurge) {
        btnAdminPurge.addEventListener('click', () => {
            state.publishedMeasures = [];
            renderPublishedMeasures();
            logTelemetry("DB: Purged all published corporate measures from memory database.");
            appendSystemMessage("🧹 **Admin Maintenance**: Purged all published custom measures from reporting database.");
        });
    }



    // Chatbot Panel Toggles
    const toggleChatBtn = document.getElementById('btn-toggle-chat');
    const floatToggleBtn = document.getElementById('ai-float-toggle');
    const chatDrawer = document.getElementById('ai-assistant-drawer');

    toggleChatBtn.addEventListener('click', () => {
        chatDrawer.classList.add('minimized');
        floatToggleBtn.style.display = 'block';
    });

    floatToggleBtn.addEventListener('click', () => {
        chatDrawer.classList.remove('minimized');
        floatToggleBtn.style.display = 'none';
    });

    // Chat Send Button & Enter Key
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');

    chatSendBtn.addEventListener('click', () => {
        sendChatMessage();
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Suggestion Buttons
    const sugButtons = document.querySelectorAll('.sug-btn');
    sugButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const query = e.currentTarget.getAttribute('data-query');
            chatInput.value = query;
            sendChatMessage();
        });
    });

    // CSV File Upload listeners
    const fileInput = document.getElementById('csv-file-input');
    const fileNameSpan = document.getElementById('csv-file-name');
    const uploadBtn = document.getElementById('btn-upload-csv');

    if (fileInput && fileNameSpan && uploadBtn) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
            } else {
                fileNameSpan.textContent = 'No file chosen';
            }
        });

        uploadBtn.addEventListener('click', () => {
            uploadCSVFile();
        });
    }

    // Pub/Sub Simulator Listener
    const btnPubSub = document.getElementById('btn-publish-pubsub');
    if (btnPubSub) {
        btnPubSub.addEventListener('click', () => {
            publishPubSubMockEvent();
        });
    }

    // Export Data Cube download listener
    const exportBtn = document.getElementById('btn-export-cube');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (state.activeRole === 'Viewer') {
                alert("Viewer role is unauthorized to export raw data cubes. Please switch security contexts.");
                return;
            }
            // Direct download stream redirection
            window.location.href = `/api/reports/export?role=${state.activeRole}`;
        });
    }
}

// Switches primary navigation tabs
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Manage active classes on buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Manage active tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Update Header titles dynamically
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    if (tabId === 'tab-dashboard') {
        titleEl.textContent = "Operational Dashboard";
        subtitleEl.textContent = "Real-time enterprise intelligence & insights";
    } else if (tabId === 'tab-etl') {
        titleEl.textContent = "Data Connectors & Ingestion";
        subtitleEl.textContent = "Raw database pipeline status";
    } else if (tabId === 'tab-qa') {
        titleEl.textContent = "Data Integrity Center";
        subtitleEl.textContent = "Quality assurance, validations and corrections";
    } else if (tabId === 'tab-reports') {
        titleEl.textContent = "Standard Report Documents";
        subtitleEl.textContent = "Compliance ready operational statements";
    }
}

// Switches sub-tabs inside the Report document area
function switchReportTab(activeBtn, reportId) {
    document.querySelectorAll('.rep-tab-btn').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');

    document.querySelectorAll('.report-document').forEach(doc => {
        if (doc.id === reportId) {
            doc.classList.add('active');
        } else {
            doc.classList.remove('active');
        }
    });
}

// Applies role-based access control (RBAC) security visibility rules
function applyRoleSecurity() {
    const etlOverlay = document.getElementById('etl-lock-overlay');
    const qaOverlay = document.getElementById('qa-lock-overlay');
    const qaRoleNotice = document.getElementById('qa-role-notice');
    const syncBtn = document.getElementById('btn-sync-etl');
    const qaCorrectionCard = document.getElementById('qa-correction-card');
    
    const btnTabEtl = document.getElementById('btn-tab-etl');
    const btnTabQa = document.getElementById('btn-tab-qa');

    // Bypass if relaxed sandbox is toggled
    if (state.securityMode === 'relaxed') {
        if (etlOverlay) etlOverlay.style.display = 'none';
        if (qaOverlay) qaOverlay.style.display = 'none';
        if (btnTabEtl) btnTabEtl.style.display = 'flex';
        if (btnTabQa) btnTabQa.style.display = 'flex';
        if (syncBtn) syncBtn.style.display = 'flex';
        if (qaCorrectionCard) qaCorrectionCard.style.display = 'block';
        if (qaRoleNotice) qaRoleNotice.style.display = 'none';
        return;
    }

    if (state.activeRole === 'Viewer') {
        // Locked screens
        etlOverlay.style.display = 'flex';
        qaOverlay.style.display = 'flex';
        
        // Hide sidebar navigation tabs
        if (btnTabEtl) btnTabEtl.style.display = 'none';
        if (btnTabQa) btnTabQa.style.display = 'none';
        
        // Hide sync button
        syncBtn.style.display = 'none';
        
        // Switch view away from restricted tab if active
        if (state.activeTab === 'tab-etl' || state.activeTab === 'tab-qa') {
            switchTab('tab-dashboard');
        }
    } else if (state.activeRole === 'Super User') {
        // Unlock screens
        etlOverlay.style.display = 'none';
        qaOverlay.style.display = 'none';
        
        // Show sidebar navigation tabs
        if (btnTabEtl) btnTabEtl.style.display = 'flex';
        if (btnTabQa) btnTabQa.style.display = 'flex';
        
        // Show Auditor banner (can see anomalies but no inline editing)
        qaRoleNotice.style.display = 'block';
        qaRoleNotice.className = "alert-banner alert-warning";
        qaRoleNotice.innerHTML = "⚠️ <strong>Auditor Status</strong>: You are signed in as a <strong>Super User</strong>. You can view all anomalies but you do not have permission to correct raw records. Change to <strong>Admin</strong> to modify values.";
        
        // Hide inline correction input console
        qaCorrectionCard.style.display = 'none';
        
        // Show sync button
        syncBtn.style.display = 'flex';
    } else if (state.activeRole === 'Admin') {
        // Full unlock
        etlOverlay.style.display = 'none';
        qaOverlay.style.display = 'none';
        
        // Show sidebar navigation tabs
        if (btnTabEtl) btnTabEtl.style.display = 'flex';
        if (btnTabQa) btnTabQa.style.display = 'flex';
        
        // Hide role banner
        qaRoleNotice.style.display = 'none';
        
        // Show inline correction input console
        qaCorrectionCard.style.display = 'block';
        
        // Show sync button
        syncBtn.style.display = 'flex';
    }
}

// Main fetch engine to load metrics based on current role
async function fetchDashboardContext() {
    try {
        // 1. Fetch aggregated reports (accessible by all roles)
        const reportsRes = await fetch(`/api/reports?role=${state.activeRole}`);
        if (reportsRes.ok) {
            state.reports = await reportsRes.json();
            renderDashboardKPIs();
            renderDashboardCharts();
            renderReportDocuments();
        }

        // 2. Fetch raw data tables (only if Super User or Admin)
        if (state.activeRole !== 'Viewer') {
            const dataRes = await fetch(`/api/data?role=${state.activeRole}`);
            if (dataRes.ok) {
                const data = await dataRes.json();
                state.rawData.crm = data.crm;
                state.rawData.erp = data.erp;
                state.rawData.production = data.production;
                state.rawData.external = data.external;
                state.anomalies = data.anomalies;
                
                renderETLTables();
                renderAnomaliesCenter();
            }
        }

        // 3. Fetch report approval workflow status
        const wfRes = await fetch(`/api/workflow`);
        if (wfRes.ok) {
            const wf = await wfRes.json();
            renderReportWorkflow(wf);
        }
    } catch (err) {
        console.error("Error loading dashboard context: ", err);
    }
}

// Render high-level KPI cards on Dashboard
function renderDashboardKPIs() {
    const sales = state.reports.sales || {};
    const erp = state.reports.erp || {};
    const prod = state.reports.production || {};

    // 1. CRM Sales Card
    document.getElementById('kpi-sales-revenue').textContent = formatCurrency(sales.total_revenue || 0.0);
    document.getElementById('kpi-sales-deals').textContent = `${sales.closed_won_count || 0} Deals Won (Avg: ${formatCurrency(sales.average_deal_size || 0.0)})`;

    // 2. ERP Trial Balance Card
    const erpDiff = erp.difference || 0.0;
    const diffEl = document.getElementById('kpi-ledger-diff');
    const ledgerStatusEl = document.getElementById('kpi-ledger-status');
    
    if (erp.status === 'Balanced') {
        ledgerStatusEl.textContent = "BALANCED";
        ledgerStatusEl.className = "kpi-value text-success";
        diffEl.textContent = "Debits equal Credits perfectly";
        diffEl.className = "kpi-meta text-success";
    } else {
        ledgerStatusEl.textContent = "UNBALANCED";
        ledgerStatusEl.className = "kpi-value text-danger";
        diffEl.textContent = `Discrepancy: ${formatCurrency(erpDiff)}`;
        diffEl.className = "kpi-meta text-danger";
    }

    // 3. Factory Output Card
    const defectRate = prod.overall_defect_rate || 0.0;
    const defectEl = document.getElementById('kpi-defect-rate');
    defectEl.textContent = `${defectRate.toFixed(2)}%`;
    
    if (defectRate > 5.0) {
        defectEl.className = "kpi-value text-danger";
    } else if (defectRate > 2.0) {
        defectEl.className = "kpi-value text-warning";
    } else {
        defectEl.className = "kpi-value text-success";
    }
    document.getElementById('kpi-prod-yield').textContent = `${prod.total_produced || 0} units built (${prod.total_defects || 0} defects)`;
}

// Render Charts utilizing Chart.js
function renderDashboardCharts() {
    const sales = state.reports.sales || {};
    
    // Product revenue bar chart
    const productLabels = (sales.by_product || []).map(p => p.label);
    const productValues = (sales.by_product || []).map(p => p.value);
    
    // Regional revenue doughnut chart
    const regionLabels = (sales.by_region || []).map(r => r.label);
    const regionValues = (sales.by_region || []).map(r => r.value);

    // Clean existing product revenue chart
    if (state.charts.productRev) {
        state.charts.productRev.destroy();
    }
    
    const ctxProd = document.getElementById('chart-product-revenue').getContext('2d');
    state.charts.productRev = new Chart(ctxProd, {
        type: 'bar',
        data: {
            labels: productLabels.length > 0 ? productLabels : ['No Data'],
            datasets: [{
                label: 'Revenue ($)',
                data: productValues.length > 0 ? productValues : [0],
                backgroundColor: [
                    'rgba(138, 43, 226, 0.7)',
                    'rgba(0, 240, 255, 0.7)',
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(16, 185, 129, 0.7)'
                ],
                borderColor: [
                    '#8a2be2',
                    '#00f0ff',
                    '#6366f1',
                    '#10b981'
                ],
                borderWidth: 1.5,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9a98b4' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9a98b4' }
                }
            }
        }
    });

    // Clean regional revenue chart
    if (state.charts.regionRev) {
        state.charts.regionRev.destroy();
    }

    const ctxRegion = document.getElementById('chart-regional-revenue').getContext('2d');
    state.charts.regionRev = new Chart(ctxRegion, {
        type: 'doughnut',
        data: {
            labels: regionLabels.length > 0 ? regionLabels : ['No Data'],
            datasets: [{
                data: regionValues.length > 0 ? regionValues : [0],
                backgroundColor: [
                    'rgba(138, 43, 226, 0.8)',
                    'rgba(0, 240, 255, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: '#121124',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f1f0fa', font: { family: 'Outfit' } }
                }
            }
        }
    });
}

// Render raw database tables in ETL Ingestion tab
function renderETLTables() {
    // 1. CRM Table
    const crmBody = document.getElementById('table-crm-data').querySelector('tbody');
    crmBody.innerHTML = '';
    
    // Check if CRM has anomaly in row
    const crmAnoms = state.anomalies.crm || [];
    
    state.rawData.crm.forEach(row => {
        const isAnom = crmAnoms.some(a => a.id === row.id);
        const rowClass = isAnom ? 'class="row-anomaly"' : '';
        
        crmBody.innerHTML += `
            <tr ${rowClass}>
                <td><strong>${row.id}</strong></td>
                <td>${row.date}</td>
                <td>${row.client}</td>
                <td>${row.product || '<span class="text-danger">NULL</span>'}</td>
                <td class="${row.amount < 0 ? 'text-danger' : ''}">${formatCurrency(row.amount)}</td>
                <td>${row.region}</td>
                <td>${row.sales_agent}</td>
                <td><span class="badge ${row.status === 'Closed Won' ? 'btn-success' : 'alert-warning'}">${row.status}</span></td>
            </tr>
        `;
    });

    // 2. ERP Table
    const erpBody = document.getElementById('table-erp-data').querySelector('tbody');
    erpBody.innerHTML = '';
    const erpAnoms = state.anomalies.erp || [];

    state.rawData.erp.forEach(row => {
        const isAnom = erpAnoms.some(a => a.id === row.id);
        const rowClass = isAnom ? 'class="row-anomaly"' : '';
        
        erpBody.innerHTML += `
            <tr ${rowClass}>
                <td><strong>${row.id}</strong></td>
                <td>${row.date}</td>
                <td>${row.account}</td>
                <td><span class="badge ${row.type === 'Debit' ? 'badge-low' : 'badge-alert'}">${row.type}</span></td>
                <td class="${row.amount < 0 ? 'text-danger' : ''}">${formatCurrency(row.amount)}</td>
                <td><code>${row.authorized_by}</code></td>
            </tr>
        `;
    });

    // 3. Production Table
    const prodBody = document.getElementById('table-prod-data').querySelector('tbody');
    prodBody.innerHTML = '';
    const prodAnoms = state.anomalies.production || [];

    state.rawData.production.forEach(row => {
        const isAnom = prodAnoms.some(a => a.id === row.id);
        const rowClass = isAnom ? 'class="row-anomaly"' : '';
        
        prodBody.innerHTML += `
            <tr ${rowClass}>
                <td><strong>${row.id}</strong></td>
                <td>${row.date}</td>
                <td>${row.machine_id}</td>
                <td>${row.units_produced}</td>
                <td class="${row.defects > row.units_produced || row.defects < 0 ? 'text-danger' : ''}">${row.defects}</td>
                <td class="${row.efficiency_pct < 0 || row.efficiency_pct > 100 ? 'text-danger' : ''}">${row.efficiency_pct.toFixed(1)}%</td>
            </tr>
        `;
    });
}

// Render Anomalies QA Screen
function renderAnomaliesCenter() {
    const anomaliesList = document.getElementById('anomalies-list-container');
    anomaliesList.innerHTML = '';

    let totalAnomCount = 0;
    
    // Combine anomalies lists
    const allAnomalies = [];
    ['crm', 'erp', 'production', 'system'].forEach(source => {
        (state.anomalies[source] || []).forEach(anom => {
            allAnomalies.push({ ...anom, source });
            totalAnomCount++;
        });
    });

    // Update anomaly counts on tab badges
    const qaBadge = document.getElementById('anomaly-badge-count');
    const qaCenterBadge = document.getElementById('anom-count-badge');
    
    if (totalAnomCount > 0) {
        qaBadge.style.display = 'block';
        qaBadge.textContent = totalAnomCount;
        qaCenterBadge.textContent = `${totalAnomCount} Issues Active`;
        qaCenterBadge.className = "anom-count-badge";
    } else {
        qaBadge.style.display = 'none';
        qaCenterBadge.textContent = "Ledger Is Clean";
        qaCenterBadge.className = "anom-count-badge btn-success";
    }

    if (allAnomalies.length === 0) {
        anomaliesList.innerHTML = `
            <div class="alert-banner alert-success text-center">
                🎉 Hurrah! No database anomalies detected. Solaris Nexus Inc. has 100% data integrity.
            </div>
        `;
        document.getElementById('table-correction-data').querySelector('tbody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No anomalies available for correction.</td>
            </tr>
        `;
        return;
    }

    // Render cards
    allAnomalies.forEach(anom => {
        const severityClass = `severity-${anom.severity.toLowerCase()}`;
        anomaliesList.innerHTML += `
            <div class="anomaly-item-card ${severityClass}">
                <div class="anom-info">
                    <h5>[${anom.source.toUpperCase()}] Record ${anom.id} - Field "${anom.field}"</h5>
                    <p>Faulty Value: <code>${anom.value}</code> | Reason: <strong>${anom.reason}</strong></p>
                </div>
                <div class="anom-meta">
                    <span class="anom-severity ${anom.severity.toLowerCase()}">${anom.severity}</span>
                </div>
            </div>
        `;
    });

    // Render correction console table (Admin only)
    if (state.activeRole === 'Admin') {
        const corrBody = document.getElementById('table-correction-data').querySelector('tbody');
        corrBody.innerHTML = '';

        allAnomalies.forEach(anom => {
            // System anomalies like Trial Balance totals cannot be corrected directly by a cell, they must correct the child records
            if (anom.source === 'system') return;
            
            corrBody.innerHTML += `
                <tr>
                    <td><span class="badge badge-alert">${anom.source.toUpperCase()}</span></td>
                    <td><code>${anom.id}</code></td>
                    <td><code>${anom.field}</code></td>
                    <td><del class="text-danger">${anom.value}</del></td>
                    <td>${anom.reason}</td>
                    <td>
                        <input type="text" class="correction-input" id="input-${anom.source}-${anom.id}-${anom.field}" value="${anom.value}">
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="correctRowValue('${anom.source}', '${anom.id}', '${anom.field}')">Save</button>
                    </td>
                </tr>
            `;
        });
    }
}

// Triggers API cell update for Data Correction (Admin Only)
async function correctRowValue(dataset, recordId, field) {
    const inputEl = document.getElementById(`input-${dataset}-${recordId}-${field}`);
    const newValue = inputEl.value;

    try {
        const res = await fetch(`/api/data/update?role=${state.activeRole}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataset,
                id: recordId,
                field,
                value: newValue
            })
        });

        if (res.ok) {
            const data = await res.json();
            // Update local state
            state.anomalies = data.anomalies;
            state.reports = data.reports;
            
            // Reload raw data as well
            const dataRes = await fetch(`/api/data?role=${state.activeRole}`);
            if (dataRes.ok) {
                const raw = await dataRes.json();
                state.rawData.crm = raw.crm;
                state.rawData.erp = raw.erp;
                state.rawData.production = raw.production;
            }

            // Re-render
            renderDashboardKPIs();
            renderDashboardCharts();
            renderETLTables();
            renderAnomaliesCenter();
            renderReportDocuments();

            logTelemetry(`DB: Corrected record "${recordId}" in dataset "${dataset.toUpperCase()}" (${field} set to "${newValue}").`);
            appendSystemMessage(`✅ Successfully corrected **${dataset.toUpperCase()}** ${recordId}: set **${field}** to **${newValue}**. System metrics recalculated.`);
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (err) {
        console.error("Data quality update failed: ", err);
    }
}

// Render report documents
function renderReportDocuments() {
    const sales = state.reports.sales || {};
    const erp = state.reports.erp || {};
    const prod = state.reports.production || {};

    // 1. Sales Report
    document.getElementById('rep-s-total-rev').textContent = formatCurrency(sales.total_revenue || 0.0);
    document.getElementById('rep-s-avg-size').textContent = formatCurrency(sales.average_deal_size || 0.0);
    document.getElementById('rep-s-won-count').textContent = `${sales.closed_won_count || 0} Won Deals`;

    const regionTable = document.getElementById('rep-table-sales-region').querySelector('tbody');
    regionTable.innerHTML = '';
    (sales.by_region || []).forEach(r => {
        regionTable.innerHTML += `
            <tr>
                <td>${r.label}</td>
                <td class="text-right"><strong>${formatCurrency(r.value)}</strong></td>
            </tr>
        `;
    });

    const productTable = document.getElementById('rep-table-sales-product').querySelector('tbody');
    productTable.innerHTML = '';
    (sales.by_product || []).forEach(p => {
        productTable.innerHTML += `
            <tr>
                <td>${p.label}</td>
                <td class="text-right"><strong>${formatCurrency(p.value)}</strong></td>
            </tr>
        `;
    });

    // 2. Trial Balance Report
    const tbStatusBanner = document.getElementById('rep-tb-status-banner');
    if (erp.status === 'Balanced') {
        tbStatusBanner.className = "doc-alert-tb balanced text-center";
        tbStatusBanner.innerHTML = "✨ TRIAL BALANCE BALANCED: General Ledger accounts debits match credits.";
    } else {
        tbStatusBanner.className = "doc-alert-tb unbalanced text-center";
        tbStatusBanner.innerHTML = "⚠️ TRIAL BALANCE OUT OF BALANCE: Ledger discrepancy detected. Review corrections.";
    }

    const tbBody = document.getElementById('rep-table-tb').querySelector('tbody');
    tbBody.innerHTML = '';
    (erp.ledger || []).forEach(row => {
        tbBody.innerHTML += `
            <tr>
                <td>${row.account}</td>
                <td class="text-right">${row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                <td class="text-right">${row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
            </tr>
        `;
    });

    document.getElementById('rep-tb-total-debit').textContent = formatCurrency(erp.total_debits || 0.0);
    document.getElementById('rep-tb-total-credit').textContent = formatCurrency(erp.total_credits || 0.0);
    
    const diffSummary = document.getElementById('rep-tb-diff-summary');
    if (erp.difference > 0) {
        diffSummary.innerHTML = `Ledger Discrepancy: <span class="text-danger">${formatCurrency(erp.difference)}</span>`;
    } else {
        diffSummary.innerHTML = `Ledger Discrepancy: <span class="text-success">$0.00</span>`;
    }

    // 3. Production Report
    document.getElementById('rep-p-yield').textContent = `${prod.total_produced || 0} Units`;
    document.getElementById('rep-p-defects').textContent = `${prod.total_defects || 0} Units`;
    document.getElementById('rep-p-defect-rate').textContent = `${(prod.overall_defect_rate || 0.0).toFixed(2)}%`;

    const prodBody = document.getElementById('rep-table-prod').querySelector('tbody');
    prodBody.innerHTML = '';
    (prod.machines || []).forEach(m => {
        prodBody.innerHTML += `
            <tr>
                <td><strong>${m.machine_id}</strong></td>
                <td>${m.units_produced}</td>
                <td class="${m.defects > 0 ? 'text-warning' : ''}">${m.defects}</td>
                <td class="${m.defect_rate > 5.0 ? 'text-danger' : ''}">${m.defect_rate.toFixed(2)}%</td>
                <td>${m.average_efficiency.toFixed(1)}%</td>
            </tr>
        `;
    });
}

// ETL Ingestion simulator sync
async function triggerETLSync() {
    const syncBtn = document.getElementById('btn-sync-etl');
    const syncIcon = document.getElementById('sync-icon');
    
    // Play animations
    syncBtn.disabled = true;
    syncIcon.classList.add('spinning');
    syncBtn.querySelector('span').textContent = 'Syncing...';

    try {
        const res = await fetch(`/api/data/sync?role=${state.activeRole}`, {
            method: 'POST'
        });

        if (res.ok) {
            // Wait 1 sec for visual effect
            setTimeout(async () => {
                syncIcon.classList.remove('spinning');
                syncBtn.disabled = false;
                syncBtn.querySelector('span').textContent = 'Sync ETL';

                logTelemetry("DB: Databases re-cached and synced from production endpoints.");
                appendSystemMessage("🔄 **ETL Ingestion Pipeline Synced**: Re-acquired direct connections to ERP, CRM, and IoT sources. Reset local data variables.");
                await fetchDashboardContext();
            }, 1000);
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
            syncIcon.classList.remove('spinning');
            syncBtn.disabled = false;
            syncBtn.querySelector('span').textContent = 'Sync ETL';
        }
    } catch (err) {
        console.error("ETL sync failed: ", err);
        syncIcon.classList.remove('spinning');
        syncBtn.disabled = false;
    }
}

// Chatbot UI helpers
function appendSystemMessage(text) {
    const container = document.getElementById('chat-messages-container');
    const parsedText = parseMarkdown(text);
    
    container.innerHTML += `
        <div class="chat-msg system">
            <p>${parsedText}</p>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
}

function appendUserMessage(text) {
    const container = document.getElementById('chat-messages-container');
    container.innerHTML += `
        <div class="chat-msg user">
            <p>${text}</p>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
}

// Sends user chat to backend assistant
async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const query = chatInput.value.trim();
    if (!query) return;

    appendUserMessage(query);
    chatInput.value = '';

    // Show typing dots indicator
    const container = document.getElementById('chat-messages-container');
    const typingIndicatorId = `typing-${Date.now()}`;
    container.innerHTML += `
        <div class="chat-msg system" id="${typingIndicatorId}">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch(`/api/chat?role=${state.activeRole}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: query })
        });

        // Remove typing indicator
        const typingEl = document.getElementById(typingIndicatorId);
        if (typingEl) typingEl.remove();

        if (res.ok) {
            const data = await res.json();
            appendSystemMessage(data.reply);
        } else {
            appendSystemMessage("⚠️ *Aura AI encountered an error processing your question. Please verify connection.*");
        }
    } catch (err) {
        console.error("Chat communication failed: ", err);
        const typingEl = document.getElementById(typingIndicatorId);
        if (typingEl) typingEl.remove();
        appendSystemMessage("⚠️ *Could not connect to Aura AI server.*");
    }
}

// Utility functions
function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(val);
}

// Primitive markdown-to-HTML formatter for clean chat display
function parseMarkdown(text) {
    let html = text;
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    html = html.replace(/^\s*-\s*(.*?)$/gm, '• $1<br>');
    // Code ticks
    html = html.replace(/`/g, '`');
    return html;
}

// Upload CSV file manually
async function uploadCSVFile() {
    const fileInput = document.getElementById('csv-file-input');
    const targetSelect = document.getElementById('upload-target-select');
    
    if (!fileInput || fileInput.files.length === 0) {
        alert("Please select a CSV file to upload.");
        return;
    }
    
    const file = fileInput.files[0];
    const target = targetSelect.value;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const res = await fetch(`/api/data/upload?target=${target}&role=${state.activeRole}`, {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            fileInput.value = '';
            document.getElementById('csv-file-name').textContent = 'No file chosen';
            
            state.anomalies = data.anomalies;
            state.reports = data.reports;
            
            // Reload raw data tables
            const dataRes = await fetch(`/api/data?role=${state.activeRole}`);
            if (dataRes.ok) {
                const raw = await dataRes.json();
                state.rawData.crm = raw.crm;
                state.rawData.erp = raw.erp;
                state.rawData.production = raw.production;
            }
            
            renderDashboardKPIs();
            renderDashboardCharts();
            renderETLTables();
            renderAnomaliesCenter();
            renderReportDocuments();
            
            logTelemetry(`DB: Manually ingested CSV file "${file.name}" into target table "${target.toUpperCase()}".`);
            appendSystemMessage(`📤 **Manual Ingestion Successful**: Ingested new records into the **${target.toUpperCase()}** database. Recalculated BI metrics.`);
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (err) {
        console.error("CSV Ingestion failed: ", err);
        alert("Failed to upload CSV file.");
    }
}

// Client-side ad-hoc table export to CSV
function downloadTableAsCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display === "none") continue;
        
        const row = [];
        const cols = rows[i].querySelectorAll("td, th");
        
        for (let j = 0; j < cols.length; j++) {
            let cellText = cols[j].textContent.trim();
            
            // Exclude action buttons in headers
            if (cellText.includes("Download CSV") || cellText.includes("Save")) {
                continue;
            }
            
            cellText = cellText.replace(/"/g, '""');
            row.push(`"${cellText}"`);
        }
        
        if (row.length > 0) {
            csv.push(row.join(","));
        }
    }
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// State extensions for dynamic modeling
state.publishedMeasures = [];

// Portal Login Handler
function handlePortalLogin() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pwd = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    
    let role = "";
    let userName = "";
    
    if (email === 'admin@solaris.com' && pwd === 'admin123') {
        role = "Admin";
        userName = "Sarah Connor";
    } else if (email === 'super@solaris.com' && pwd === 'super123') {
        role = "Super User";
        userName = "Auditor General";
    } else if (email === 'viewer@solaris.com' && pwd === 'viewer123') {
        role = "Viewer";
        userName = "John Doe";
    } else {
        errorEl.style.display = 'block';
        return;
    }
    
    errorEl.style.display = 'none';
    state.activeRole = role;
    
    // Update Profile UI
    document.getElementById('header-user-name').textContent = userName;
    document.getElementById('header-user-role').textContent = `${role} Role`;
    document.getElementById('header-user-avatar').textContent = userName.charAt(0);
    
    // Switch views
    if (role === 'Viewer') {
        // Direct entry to Report Mode (Viewer has no access to choices)
        document.getElementById('login-portal-screen').style.display = 'none';
        document.getElementById('aurabi-app-container').style.display = 'flex';
        enterPortalWorkspace('Report');
    } else {
        // Show choice workspace cards for Admin / Super User
        document.getElementById('login-auth-card').style.display = 'none';
        document.getElementById('portal-choice-card').style.display = 'block';
    }
}

// Switches workspace based on choice
function enterPortalWorkspace(hubType) {
    document.getElementById('login-portal-screen').style.display = 'none';
    document.getElementById('aurabi-app-container').style.display = 'flex';
    
    applyRoleSecurity();
    fetchDashboardContext();
    
    if (hubType === 'ETL') {
        switchTab('tab-etl');
        appendSystemMessage(`👋 **Welcome to the Developer Hub!** Connected database channels, name connections, or edit DAX models.`);
    } else {
        switchTab('tab-dashboard');
        const user = document.getElementById('header-user-name').textContent;
        appendSystemMessage(`👋 **Welcome to the Analytics Hub, ${user}!** View executive KPIs and read reports.`);
    }
}

// Portal Logout Handler
function handlePortalLogout() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    
    // Re-enable auth card display
    document.getElementById('login-auth-card').style.display = 'block';
    document.getElementById('portal-choice-card').style.display = 'none';
    
    document.getElementById('aurabi-app-container').style.display = 'none';
    document.getElementById('login-portal-screen').style.display = 'flex';
    
    state.activeRole = 'Viewer';
}

// Dynamic Connection Manager
function establishExternalConnection() {
    const connName = document.getElementById('conn-name-input').value.trim();
    const connUrl = document.getElementById('conn-url-input').value.trim();
    const connDest = document.getElementById('conn-dest-select').value;
    
    if (!connName || !connUrl) {
        alert("Please provide both a connection name and an API endpoint URL.");
        return;
    }
    
    // Add connection badge
    const list = document.getElementById('connected-pipelines-list');
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.style.background = "rgba(16, 185, 129, 0.1)";
    badge.style.border = "1px solid rgba(16, 185, 129, 0.3)";
    badge.style.color = "var(--color-success)";
    badge.style.padding = "6px 12px";
    badge.textContent = `🟢 ${connName} (${connUrl} ➔ ${connDest.toUpperCase()})`;
    list.appendChild(badge);
    
    // Reset inputs
    document.getElementById('conn-name-input').value = '';
    document.getElementById('conn-url-input').value = '';
    
    logTelemetry(`PIPELINE: Connector "${connName}" established to URL "${connUrl}" pulling into table "${connDest.toUpperCase()}".`);
    appendSystemMessage(`🔌 **Ingestion Pipeline Ingress**: Added external connector **${connName}** pulling endpoint **${connUrl}** into target schema **${connDest.toUpperCase()}**.`);
}

// Run DAX Calculator Action
let currentComputedValue = null;
let currentComputedFormula = "";

function runDaxCalculation() {
    const formula = document.getElementById('dax-custom-input').value.trim();
    const resultCard = document.getElementById('dax-result-card');
    const resultVal = document.getElementById('dax-result-value');
    const publishBtn = document.getElementById('btn-publish-dax');
    
    if (!formula) {
        alert("Please select or enter a formula to calculate.");
        return;
    }
    
    const result = evaluateDaxFormula(formula);
    resultCard.style.display = 'block';
    
    if (typeof result === 'string') {
        resultVal.textContent = result;
        resultVal.style.color = 'var(--text-primary)';
        if (publishBtn) publishBtn.style.display = 'none';
    } else {
        resultVal.style.color = 'var(--color-accent)';
        currentComputedValue = result;
        currentComputedFormula = formula;
        if (publishBtn) publishBtn.style.display = 'inline-block';
        
        if (formula.includes("defects") || formula.includes("/") || formula.includes("%")) {
            resultVal.textContent = result.toFixed(2) + "%";
        } else {
            resultVal.textContent = formatCurrency(result);
        }
    }
}

// Publish Custom Calculated columns to DB
function publishDaxToDatabase() {
    if (currentComputedValue === null || !currentComputedFormula) return;
    
    let formattedVal = "";
    if (currentComputedFormula.includes("defects") || currentComputedFormula.includes("/") || currentComputedFormula.includes("%")) {
        formattedVal = currentComputedValue.toFixed(2) + "%";
    } else {
        formattedVal = formatCurrency(currentComputedValue);
    }
    
    // Add to state
    state.publishedMeasures.push({
        formula: currentComputedFormula,
        value: formattedVal
    });
    
    // Render in dashboard
    renderPublishedMeasures();
    
    // Reset publish button
    document.getElementById('btn-publish-dax').style.display = 'none';
    
    logTelemetry(`MODEL: Custom measure "${currentComputedFormula}" published with value "${formattedVal}".`);
    appendSystemMessage(`🧮 **Published Measure**: Calculation **${currentComputedFormula}** pushed to the reporting database. It is now live on the end-user dashboard.`);
}

// Render dynamic measures to dashboard tab
function renderPublishedMeasures() {
    const section = document.getElementById('custom-measures-dashboard-section');
    const grid = document.getElementById('custom-measures-grid');
    
    if (!section || !grid) return;
    
    if (state.publishedMeasures.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    grid.innerHTML = "";
    
    state.publishedMeasures.forEach((measure, idx) => {
        const card = document.createElement("div");
        card.className = "kpi-card";
        card.innerHTML = `
            <div class="kpi-info" style="text-align: left;">
                <span class="kpi-title" style="font-size: 11px; white-space: normal; word-break: break-all;">${measure.formula}</span>
                <h3 class="kpi-value" style="color: var(--color-accent); font-size: 20px; font-weight: 700; margin-top: 4px;">${measure.value}</h3>
                <span class="kpi-meta">Dynamic Calculated Measure</span>
            </div>
            <div class="kpi-icon" style="background: rgba(0, 240, 255, 0.1); color: var(--color-accent); width: 36px; height: 36px; font-size: 18px;">🧮</div>
        `;
        grid.appendChild(card);
    });
}

// Client-side simple DAX evaluation engine
function evaluateDaxFormula(formula) {
    if (!formula) return "Enter formula";
    formula = formula.trim();
    
    try {
        let dataset = "";
        let column = "";
        let operation = "";
        
        const match = formula.match(/^(SUM|AVERAGE|COUNT)\((CRM|ERP|Production)\[([a-zA-Z0-9_]+)\]\)(?:\s+WHERE\s+(.+))?$/i);
        
        if (match) {
            operation = match[1].toUpperCase();
            dataset = match[2].toLowerCase();
            column = match[3].toLowerCase();
            const whereClause = match[4];
            
            let dataList = [];
            if (dataset === 'crm') dataList = state.rawData.crm;
            else if (dataset === 'erp') dataList = state.rawData.erp;
            else if (dataset === 'production') dataList = state.rawData.production;
            
            if (whereClause) {
                const filterMatch = whereClause.match(/([a-zA-Z0-9_]+)\s*=\s*'([^']+)'/i);
                if (filterMatch) {
                    const filterCol = filterMatch[1].toLowerCase();
                    const filterVal = filterMatch[2];
                    dataList = dataList.filter(row => String(row[filterCol] || '').toLowerCase() === filterVal.toLowerCase());
                }
            }
            
            if (dataList.length === 0) return 0;
            
            const values = dataList.map(row => {
                let val = row[column];
                if (val === undefined) {
                     const key = Object.keys(row).find(k => k.toLowerCase() === column);
                     val = key ? row[key] : 0;
                }
                return Number(val) || 0;
            });
            
            if (operation === 'SUM') {
                return values.reduce((sum, v) => sum + v, 0);
            } else if (operation === 'AVERAGE') {
                const total = values.reduce((sum, v) => sum + v, 0);
                return total / values.length;
            } else if (operation === 'COUNT') {
                return values.length;
            }
        }
        
        if (formula.includes("defects") && formula.includes("units_produced")) {
            const sumDefects = state.rawData.production.reduce((sum, row) => sum + (Number(row.defects) || 0), 0);
            const sumUnits = state.rawData.production.reduce((sum, row) => sum + (Number(row.units_produced) || 0), 0);
            if (sumUnits === 0) return 0;
            return (sumDefects / sumUnits) * 100;
        }
        
        return "Unsupported formula pattern. Try matching Preset formats.";
    } catch (e) {
        return "Evaluation Error: " + e.message;
    }
}

// Client-side ad-hoc table export to CSV
function downloadTableAsCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display === "none") continue;
        
        const row = [];
        const cols = rows[i].querySelectorAll("td, th");
        
        for (let j = 0; j < cols.length; j++) {
            let cellText = cols[j].textContent.trim();
            if (cellText.includes("Download CSV") || cellText.includes("Save")) {
                continue;
            }
            cellText = cellText.replace(/"/g, '""');
            row.push(`"${cellText}"`);
        }
        
        if (row.length > 0) {
            csv.push(row.join(","));
        }
    }
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Global live auditor logging
function logTelemetry(message) {
    const logBox = document.getElementById('admin-telemetry-log');
    if (!logBox) return;
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = document.createElement('div');
    logLine.textContent = `[${timestamp}] ${message}`;
    logBox.appendChild(logLine);
    logBox.scrollTop = logBox.scrollHeight;
}

// Render report approval workflow steps
function renderReportWorkflow(wf) {
    const badge = document.getElementById('workflow-badge-status');
    const assigned = document.getElementById('wf-assigned-person');
    const historyList = document.getElementById('wf-history-list');
    const actionContainer = document.getElementById('wf-action-container');
    
    if (!badge || !assigned || !historyList || !actionContainer) return;
    
    // Reset steps styles
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`wf-step-${i}`);
        if (el) {
            el.style.border = '1px solid transparent';
            el.style.background = 'rgba(255,255,255,0.01)';
            el.style.opacity = '0.5';
            el.style.color = 'var(--text-secondary)';
        }
    }
    
    // Highlight step
    let activeStepNum = Math.min(wf.step, 4);
    const activeStepEl = document.getElementById(`wf-step-${activeStepNum}`);
    if (activeStepEl) {
        activeStepEl.style.border = '1px solid var(--color-accent)';
        activeStepEl.style.background = 'rgba(0,240,255,0.02)';
        activeStepEl.style.opacity = '1';
        activeStepEl.style.color = 'var(--color-accent)';
    }
    
    // Update labels
    badge.textContent = wf.status;
    if (wf.step === 5) {
        badge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        badge.style.color = 'var(--color-success)';
        badge.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    } else {
        badge.style.backgroundColor = 'rgba(0, 240, 255, 0.1)';
        badge.style.color = 'var(--color-accent)';
        badge.style.border = '1px solid rgba(0,240,255,0.2)';
    }
    
    assigned.textContent = wf.assigned_to;
    
    // History
    historyList.innerHTML = "";
    wf.history.forEach(log => {
        const item = document.createElement("li");
        item.textContent = log;
        historyList.appendChild(item);
    });
    
    // Clear and build buttons dynamically
    actionContainer.innerHTML = "";
    
    if (wf.step === 1) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.id = 'btn-wf-advance';
        btn.style.padding = '10px 16px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '600';
        btn.textContent = "Submit for SME Review";
        if (state.activeRole !== 'Admin') {
            btn.disabled = true;
            btn.title = "Only BI Specialist (Admin) role can submit report.";
        }
        btn.addEventListener('click', () => advanceReportWorkflow());
        actionContainer.appendChild(btn);
    } else if (wf.step === 2) {
        // PII Security check: require email recipient
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'wf-email-recipient';
        emailInput.className = 'correction-input';
        emailInput.placeholder = 'teammember@solaris.com';
        emailInput.style.padding = '8px 12px';
        emailInput.style.borderRadius = '8px';
        emailInput.style.fontSize = '12px';
        emailInput.style.width = '200px';
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.id = 'btn-wf-advance';
        btn.style.padding = '10px 16px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '600';
        btn.textContent = "Approve & Email Link";
        
        if (state.activeRole !== 'Super User' && state.activeRole !== 'Admin') {
            btn.disabled = true;
            btn.title = "Only SME (Super User) can audit and approve.";
            emailInput.disabled = true;
        }
        
        btn.addEventListener('click', () => {
            const email = emailInput.value.trim();
            if (!email) {
                alert("Please provide a recipient email to forward the report link.");
                return;
            }
            if (!email.toLowerCase().endsWith("@solaris.com")) {
                logTelemetry(`SECURITY ALERT: Blocked PII egress leak attempt to unknown external email: ${email}`);
                alert(`PII Egress Blocked: Recipient '${email}' is outside the authorized corporate directory (@solaris.com).`);
                return;
            }
            advanceReportWorkflow(email);
        });
        
        actionContainer.appendChild(emailInput);
        actionContainer.appendChild(btn);
    } else if (wf.step === 3) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.id = 'btn-wf-advance';
        btn.style.padding = '10px 16px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '600';
        btn.textContent = "Simulate Team Approval Link";
        btn.addEventListener('click', () => advanceReportWorkflow());
        actionContainer.appendChild(btn);
    } else if (wf.step === 4) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.id = 'btn-wf-advance';
        btn.style.padding = '10px 16px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '600';
        btn.textContent = "Publish to Corporate Directory";
        if (state.activeRole !== 'Admin') {
            btn.disabled = true;
            btn.title = "Only BI Specialist (Admin) role can publish.";
        }
        btn.addEventListener('click', () => advanceReportWorkflow());
        actionContainer.appendChild(btn);
    } else {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.padding = '10px 16px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '600';
        btn.style.backgroundColor = 'rgba(255,255,255,0.05)';
        btn.style.color = 'var(--text-muted)';
        btn.textContent = "Published Successfully";
        btn.disabled = true;
        actionContainer.appendChild(btn);
    }
}

// Call API to advance workflow
async function advanceReportWorkflow(recipientEmail = null) {
    let action = "";
    const badge = document.getElementById('workflow-badge-status').textContent;
    
    if (badge === "Draft") action = "submit_review";
    else if (badge === "Pending SME Review") action = "sme_approve";
    else if (badge === "Pending Team Feedback") action = "team_approve";
    else if (badge === "Approved by Team") action = "publish_group";
    else return;
    
    try {
        const payload = { action };
        if (recipientEmail) {
            payload.recipient_email = recipientEmail;
        }
        
        const res = await fetch(`/api/workflow/advance?role=${state.activeRole}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const wf = await res.json();
            renderReportWorkflow(wf);
            logTelemetry(`WORKFLOW: Advanced stage context to: "${wf.status}".`);
            appendSystemMessage(`🔄 **Workflow Advanced**: Report lifecycle progressed to **${wf.status}**.`);
        } else {
            const err = await res.json();
            if (err.detail && err.detail.includes("PII Leakage")) {
                logTelemetry(`SECURITY ALERT: Blocked PII egress leak attempt from API.`);
            }
            alert(`Workflow Error: ${err.detail}`);
        }
    } catch (err) {
        console.error("Workflow advancement failed: ", err);
    }
}

// Base64 encode helper
function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Simulates sending a GCP Pub/Sub push event
async function publishPubSubMockEvent() {
    const target = document.getElementById('pubsub-target-select').value;
    const payload = document.getElementById('pubsub-csv-payload').value.trim();
    
    if (!payload) {
        alert("Please enter CSV payload lines to publish.");
        return;
    }
    
    // Base64 encode the payload
    const base64Data = base64Encode(payload);
    
    // Construct standard GCP Pub/Sub push message structure
    const envelope = {
        message: {
            data: base64Data,
            attributes: {
                target: target
            },
            messageId: "msg-" + Math.random().toString(36).substring(2, 10),
            publishTime: new Date().toISOString()
        },
        subscription: "projects/solaris-nexus/subscriptions/aurabi-sub"
    };
    
    try {
        logTelemetry(`PUBSUB: Broadcasting GCP Pub/Sub Push message envelope to backend...`);
        
        const res = await fetch(`/api/pubsub/push?role=${state.activeRole}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(envelope)
        });
        
        if (res.ok) {
            const data = await res.json();
            logTelemetry(`PUBSUB: Message processed successfully! target database loaded.`);
            appendSystemMessage(`🔔 **GCP Pub/Sub Ingress Triggered**: Decoded base64 payload. Ingested data into **${target.toUpperCase()}**.`);
            
            // Reload raw data
            const dataRes = await fetch(`/api/data?role=${state.activeRole}`);
            if (dataRes.ok) {
                const raw = await dataRes.json();
                state.rawData.crm = raw.crm;
                state.rawData.erp = raw.erp;
                state.rawData.production = raw.production;
                
                renderETLTables();
                renderAnomaliesCenter();
                renderDashboardKPIs();
                renderDashboardCharts();
                renderReportDocuments();
            }
        } else {
            const err = await res.json();
            alert(`Pub/Sub Error: ${err.detail}`);
        }
    } catch (err) {
        console.error("Pub/Sub trigger failed: ", err);
    }
}
