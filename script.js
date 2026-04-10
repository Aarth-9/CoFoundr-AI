document.addEventListener('DOMContentLoaded', () => {

    // --- AUTHENTICATION STATE ---
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    const loginBtn = document.getElementById('login-btn');
    const userIn = document.getElementById('login-user');
    const passIn = document.getElementById('login-pass');
    const loginError = document.getElementById('login-error');

    // DOM pointers for UI masking
    const roleName = document.getElementById('logged-user-name');
    const roleTitle = document.getElementById('logged-user-role');
    const roleAvatar = document.getElementById('logged-avatar');
    
    // Global Navigation State pointers (hoisted for reuse)
    const ideaMenu = document.getElementById('idea-menu');
    const managerMenu = document.getElementById('manager-menu');
    const founderMenu = document.getElementById('founder-menu');
    const menuItems = document.querySelectorAll('.menu-item');
    const panels = document.querySelectorAll('.content-panel');

    function switchPanel(targetId) {
        menuItems.forEach(item => item.classList.remove('active'));
        const targetMenu = document.querySelector(`[data-target="${targetId}"]`);
        if(targetMenu) targetMenu.classList.add('active');

        panels.forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(targetId);
        if(targetPanel) targetPanel.classList.add('active');
    }

    // Restore click listeners for navigation menus
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            switchPanel(e.currentTarget.getAttribute('data-target'));
        });
    });


    // Hardcoded MVP Accounts
    const accounts = {
        'idea': { pass: '123', role: 'Idea Generator', icon: '<i class="fa-solid fa-lightbulb"></i>', color: 'var(--accent-blue)' },
        'manager': { pass: '123', role: 'Operations Manager', icon: '<i class="fa-solid fa-chart-line"></i>', color: 'var(--accent-purple)' },
        'founder': { pass: 'admin', role: 'Global Admin', icon: '<i class="fa-solid fa-crown"></i>', color: 'var(--gradient-primary)' }
    };

    loginBtn.addEventListener('click', () => {
        const u = userIn.value.trim().toLowerCase();
        const p = passIn.value.trim();
        
        if(accounts[u] && accounts[u].pass === p) {
            // SUCCESS
            loginScreen.style.display = 'none';
            appLayout.style.display = 'flex';
            
            // Set User Info
            roleName.innerText = accounts[u].role;
            roleTitle.innerText = "Premium Tier • Connected";
            roleAvatar.innerHTML = accounts[u].icon;
            roleAvatar.style.background = accounts[u].color;

            // Enforce Exact Menu Masking & Routing
            if(u === 'idea') {
                if(ideaMenu) ideaMenu.style.display = 'block';
                if(managerMenu) managerMenu.style.display = 'none';
                if(founderMenu) founderMenu.style.display = 'none';
                switchPanel('panel-brainstorm');
            } else if (u === 'manager') {
                if(ideaMenu) ideaMenu.style.display = 'none';
                if(managerMenu) managerMenu.style.display = 'block';
                if(founderMenu) founderMenu.style.display = 'none';
                switchPanel('panel-metrics');
            } else if (u === 'founder') {
                // Founder is isolated to purely the founder admin hub
                if(ideaMenu) ideaMenu.style.display = 'none';
                if(managerMenu) managerMenu.style.display = 'none';
                if(founderMenu) founderMenu.style.display = 'block';
                switchPanel('panel-founder-hub');
            }
        } else {
            loginError.style.display = 'block';
        }
    });

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            switchPanel(e.currentTarget.getAttribute('data-target'));
        });
    });


    // --- IDEA MODE: BRAINSTORM CHAT ---
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatHistory = document.getElementById('chat-history');
    
    // Track context for pitch deck generator
    let conversationHistory = ""; 

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if(!text) return;

        // User message UI
        const userHtml = `
            <div class="message user-message">
                <div class="msg-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="msg-bubble">${text}</div>
            </div>
        `;
        chatHistory.insertAdjacentHTML('beforeend', userHtml);
        
        conversationHistory += `\nUser: ${text}`;
        chatInput.value = "";
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // AI Loading UI
        const aiId = "msg-" + Date.now();
        const aiLoadingHtml = `
            <div class="message ai-message" id="${aiId}">
                <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-bubble"><i class="fa-solid fa-circle-notch fa-spin"></i> Processing...</div>
            </div>
        `;
        chatHistory.insertAdjacentHTML('beforeend', aiLoadingHtml);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            // We pass the entire conversation history along with the new text to enable the LangGraph backend to synthesize the final action plan
            const currentContext = conversationHistory; 
            const res = await fetch('/api/idea-agent', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: text, history: [currentContext] })
            });
            const data = await res.json();
            
            // Format text using Marked.js for full markdown support (Lists, headings, bolding)
            let formatText = marked.parse(data.reply);
            
            conversationHistory += `\nAI: ${data.reply}`;
            document.querySelector(`#${aiId} .msg-bubble`).innerHTML = formatText;

            // NEW: LangGraph Routing Hook
            if (data.is_finalized && data.action_plan) {
                // Unhide the Action Plan menu
                const menuActionPlan = document.getElementById('menu-actionplan');
                if (menuActionPlan) menuActionPlan.style.display = 'flex';

                // Populate the Action Plan Panel
                const planOutput = document.getElementById('action-plan-output');
                if(planOutput) planOutput.innerHTML = marked.parse(data.action_plan);
                
                // Switch UI automatically
                switchPanel('panel-actionplan');
            }

        } catch(e) {
            document.querySelector(`#${aiId} .msg-bubble`).innerHTML = `<span style="color:red">Connection Error. Check backend.</span>`;
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // --- IDEA MODE: PITCH DECK FACTORY ---
    const generatePitchBtn = document.getElementById('generate-pitch-btn');
    const deckOutput = document.getElementById('deck-output');
    const updateDeckBtn = document.getElementById('deck-update-btn');
    const deckFeedbackInput = document.getElementById('deck-feedback-input');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    let currentDeckContext = ""; // Store for iterative feedback

    // Helper function to hit the Pitch Deck Endpoint
    async function executePitchDeck(feedback = "") {
        generatePitchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
        generatePitchBtn.disabled = true;
        updateDeckBtn.disabled = true;
        
        const loadingMsg = feedback ? "Applying your feedback recursively..." : "Compiling initial structured markdown...";
        deckOutput.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-cog fa-spin"></i>
                <h3>Synthesizing Presentation</h3>
                <p>${loadingMsg}</p>
            </div>
        `;

        try {
            const contextMsg = feedback ? currentDeckContext : `Context of startup idea:\n${conversationHistory}`;
            const res = await fetch('/api/pitch-deck', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: contextMsg, feedback: feedback })
            });
            const data = await res.json();
            
            // Render markdown and update internal state
            currentDeckContext = data.reply;
            deckOutput.innerHTML = marked.parse(data.reply);
            
            if (feedback) deckFeedbackInput.value = ""; // Clear feedback input

        } catch(e) {
            deckOutput.innerHTML = `Error: ${e.message}`;
        }
        
        generatePitchBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Deck`;
        generatePitchBtn.disabled = false;
        updateDeckBtn.disabled = false;
    }

    // Initial Generation
    generatePitchBtn.addEventListener('click', () => {
        if(conversationHistory.length < 15) {
            alert("Brainstorm in the chat first! The AI needs context to build your deck.");
            switchPanel('panel-brainstorm');
            return;
        }
        executePitchDeck();
    });

    // Feedback Update loop
    updateDeckBtn.addEventListener('click', () => {
        const feedback = deckFeedbackInput.value.trim();
        if(!feedback) return;
        if(!currentDeckContext) {
            alert("Generate a deck first before providing feedback!");
            return;
        }
        executePitchDeck(feedback);
    });

    // PDF Download Engine
    downloadPdfBtn.addEventListener('click', () => {
        if(!currentDeckContext) {
            alert("Nothing to export! Generate a deck first.");
            return;
        }
        
        // Hide the empty state wrapper if it somehow persists
        const opt = {
            margin:       0.5,
            filename:     'CoFoundr_Pitch_Deck.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        const deckTarget = document.getElementById('deck-output');
        
        // Temporarily style it for white-background PDF printing
        const originalColor = deckTarget.style.color;
        deckTarget.style.color = '#000';
        
        const childElements = deckTarget.querySelectorAll('*');
        const childColors = [];
        childElements.forEach(el => {
            childColors.push(el.style.color);
            el.style.color = '#000';
        });

        html2pdf().set(opt).from(deckTarget).save().then(() => {
            // Revert styles back to the dark mode theme
            deckTarget.style.color = originalColor;
            childElements.forEach((el, index) => {
                el.style.color = childColors[index];
            });
        });
    });

    // --- MANAGER MODE: KANBAN GENERATOR ---
    const analyzeBtn = document.getElementById('analyze-kpi-btn');
    const kanbanRisks = document.getElementById('kanban-risk-items');
    const kanbanTasks = document.getElementById('kanban-task-items');

    analyzeBtn.addEventListener('click', async () => {
        const mrr = document.getElementById('kpi-mrr').value;
        const burn = document.getElementById('kpi-burn').value;
        const churn = document.getElementById('kpi-churn').value;

        analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;
        analyzeBtn.disabled = true;
        
        kanbanRisks.innerHTML = `<div class="empty-card">Analyzing...</div>`;
        kanbanTasks.innerHTML = `<div class="empty-card">Analyzing...</div>`;

        try {
            const res = await fetch('/api/manager-agent', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ mrr, burn_rate: burn, churn })
            });
            const data = await res.json();
            
            kanbanRisks.innerHTML = "";
            kanbanTasks.innerHTML = "";

            if(data.risks && data.risks.length > 0) {
                data.risks.forEach(risk => {
                    const el = document.createElement('div');
                    el.className = "kanban-card";
                    el.innerText = risk;
                    kanbanRisks.appendChild(el);
                });
            }

            if(data.tasks && data.tasks.length > 0) {
                data.tasks.forEach(task => {
                    const el = document.createElement('div');
                    el.className = "kanban-card";
                    el.innerText = task;
                    kanbanTasks.appendChild(el);
                });
            }
            
        } catch(e) {
            kanbanRisks.innerHTML = `<div class="empty-card" style="color:red">Error fetching data. Check .env keys.</div>`;
            kanbanTasks.innerHTML = "";
        }

        analyzeBtn.innerText = "Analyze Strategy";
        analyzeBtn.disabled = false;
    });

    // --- EXTERNAL AI AGENTS (Groq / OpenAI) ---
    bindAgentWidget('generate-market-btn', 'market-output', '/api/market-research', true, null, "context");
    bindAgentWidget('generate-gtm-btn', 'gtm-output', '/api/gtm-agent', true, null, "context");


    // --- UTILITIES FOR GENERIC WIDGETS ---
    async function bindAgentWidget(btnId, outId, apiRoute, isMarkdown = false, parseJson = null, payloadMode = "generic") {
        const btn = document.getElementById(btnId);
        const out = document.getElementById(outId);
        if(!btn || !out) return;

        btn.addEventListener('click', async () => {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating...`;
            btn.disabled = true;

            try {
                let payload = {};
                if(payloadMode === "generic") payload = { context: "" };
                else if(payloadMode === "context") payload = { context: conversationHistory || "Dummy Context" };

                const res = await fetch(apiRoute, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if(data.error) {
                    out.innerHTML = `<span style="color:red">${data.error}</span>`;
                } else if(isMarkdown) {
                    out.innerHTML = marked.parse(data.report || data.plan || data.message || "");
                } else if(parseJson) {
                    out.innerHTML = parseJson(data);
                } else {
                    out.innerHTML = `<pre style="color:var(--text-primary); text-align:left;">${JSON.stringify(data, null, 2)}</pre>`;
                }
            } catch (e) {
                out.innerHTML = `<span style="color:red">API Connection Failed.</span>`;
            }
            btn.innerText = "Re-Generate";
            btn.disabled = false;
        });
    }

    // 1. Competitor Matrix Parsing
    function parseCompetitors(data) {
        if(!data.competitors) return "Failed parsing competitors.";
        let html = "";
        data.competitors.forEach((c, idx) => {
            const colors = ['var(--accent-blue)', 'var(--accent-purple)', '#F59E0B'];
            const badges = ['Market Leader', 'Challenger', 'Niche Player'];
            html += `
            <div class="glass-card" style="padding: 20px; text-align: center; position: relative;">
                <span class="badge ${idx===0 ? 'badge-active': (idx===1?'badge-away':'badge-pro')}" style="position: absolute; top: -10px; right: -10px;">${badges[idx]}</span>
                <h3 style="color: #fff; margin-bottom: 10px; font-size: 20px;">${c.name}</h3>
                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 15px;">Target: ${c.target}</p>
                <div style="font-size: 32px; font-weight: bold; color: ${colors[idx % 3]}; margin-bottom: 10px;">${c.share} Share</div>
                <p style="font-size: 14px; color: #E2E8F0; text-align:left;"><i class="fa-solid fa-check" style="color: #10B981;"></i> ${c.pro}<br><i class="fa-solid fa-xmark" style="color: var(--accent-red);"></i> ${c.con}</p>
            </div>`;
        });
        return html;
    }

    bindAgentWidget('scan-competitor-btn', 'competitor-grid', '/api/competitors', false, parseCompetitors, "context");

    // 2. Manager Health
    function parseHealth(data) {
        return `<div style="text-align:center; padding: 20px;">
            <h3 style="color: #10B981; font-size: 32px; margin-bottom: 10px; text-shadow: 0 0 20px rgba(16,185,129,0.4);"><i class="fa-solid fa-check-circle"></i> Uptime: ${data.uptime}</h3>
            <p style="color: #E2E8F0; font-size: 16px;">Latency: <span class="text-neon-blue">${data.latency}</span></p>
            <p style="color: var(--text-secondary); margin-top: 10px; font-size: 14px;">Recent Deployments: ${data.deployments.join(', ')}</p>
        </div>`;
    }
    bindAgentWidget('health-btn', 'health-output', '/api/health-agent', false, parseHealth);

    // 3. Manager Resources
    function parseResources(data) {
        const fStr = data.frontend || "0%"; const bStr = data.backend || "0%"; const aStr = data.ai || "0%";
        return `<div style="display: flex; gap: 40px; width: 100%; justify-content: space-around;">
            <div style="text-align: center;">
                <div class="radial-wedge" style="background: conic-gradient(var(--accent-blue) 0% ${fStr}, rgba(255,255,255,0.05) ${fStr} 100%);"><span>${fStr}</span></div>
                <h3 style="color: var(--text-primary);">Frontend</h3>
            </div>
            <div style="text-align: center;">
                <div class="radial-wedge" style="background: conic-gradient(var(--accent-purple) 0% ${bStr}, rgba(255,255,255,0.05) ${bStr} 100%);"><span>${bStr}</span></div>
                <h3 style="color: var(--text-primary);">Backend Core</h3>
            </div>
            <div style="text-align: center;">
                <div class="radial-wedge" style="background: conic-gradient(#F59E0B 0% ${aStr}, rgba(255,255,255,0.05) ${aStr} 100%);"><span>${aStr}</span></div>
                <h3 style="color: var(--text-primary);">AI Tuning</h3>
            </div>
        </div>`;
    }
    bindAgentWidget('resource-btn', 'resource-output', '/api/resource-agent', false, parseResources);

    // 4. Manager Funnel
    function parseFunnel(data) {
        const l = parseFloat(data.landing) || 1;
        const s = parseFloat(data.signup) || 1;
        const p = parseFloat(data.paid) || 1;
        const p1 = "100%";
        const p2 = Math.round((s/l)*100) + "%";
        const p3 = Math.round((p/l)*100) + "%";
        return `<div class="horizontal-bar-container">
            <div class="horizontal-bar-row">
                <div class="horizontal-bar-label"><span>Landing Page Visitors</span><span style="color:#fff; font-weight:bold;">${data.landing}</span></div>
                <div class="horizontal-bar-track"><div class="horizontal-bar-fill" style="width: ${p1};"></div></div>
            </div>
            <div class="horizontal-bar-row">
                <div class="horizontal-bar-label"><span>Signups</span><span style="color:#fff; font-weight:bold;">${data.signup}</span></div>
                <div class="horizontal-bar-track"><div class="horizontal-bar-fill" style="width: ${p2}; background: var(--accent-purple);"></div></div>
            </div>
            <div class="horizontal-bar-row">
                <div class="horizontal-bar-label"><span>Paid Subscriptions</span><span style="color:#fff; font-weight:bold;">${data.paid}</span></div>
                <div class="horizontal-bar-track"><div class="horizontal-bar-fill" style="width: ${p3}; background: #10B981;"></div></div>
            </div>
        </div>`;
    }
    bindAgentWidget('funnel-btn', 'funnel-output', '/api/funnel-agent', false, parseFunnel);

    // 5. Founder Investor
    bindAgentWidget('investor-btn', 'investor-output', '/api/investor-agent', true, null, "generic");

    // 6. Founder Billing
    bindAgentWidget('billing-btn', 'billing-output', '/api/billing-agent');

    // 7. Founder Audit
    bindAgentWidget('audit-btn', 'audit-output', '/api/audit-agent');

    // --- CHART.JS SUB-PANEL OVERRIDES ---
    function initChartOverrides() {
        if (!window.startupMockData || !window.Chart) return;
        Chart.defaults.color = "#9CA3AF";
        Chart.defaults.font.family = "'Inter', sans-serif";

        // 1. Health Panel Line Chart
        const cHealth = document.getElementById('chart-health-line');
        if (cHealth) {
            new Chart(cHealth.getContext('2d'), {
                type: 'line',
                data: {
                    labels: window.startupMockData.slice(-24).map((_, i) => i + "h"),
                    datasets: [
                        { label: 'CPU Load %', data: window.startupMockData.slice(-24).map(d => Math.floor(Math.random()*40)+10), borderColor: 'var(--accent-blue)', tension: 0.3 },
                        { label: 'Memory %', data: window.startupMockData.slice(-24).map(d => Math.floor(Math.random()*30)+40), borderColor: 'var(--accent-purple)', tension: 0.3 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#374151' } }, x: { grid: { display: false } } } }
            });
        }

        // 2. Resources Panel Bar Chart
        const cRes = document.getElementById('chart-resources-bar');
        if (cRes) {
            new Chart(cRes.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'],
                    datasets: [
                        { label: 'Frontend', data: [120, 150, 130, 180], backgroundColor: 'var(--accent-blue)' },
                        { label: 'Backend', data: [200, 180, 190, 210], backgroundColor: 'var(--accent-purple)' },
                        { label: 'AI Tuning', data: [50, 80, 120, 150], backgroundColor: 'var(--accent-info)' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, grid: { color: '#374151' } } } }
            });
        }

        // 3. Funnel Panel Pie Chart
        const cFun = document.getElementById('chart-funnel-pie');
        if (cFun) {
            new Chart(cFun.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['Dropped (Landing)', 'Dropped (Signup)', 'Converted (Paid)'],
                    datasets: [{ data: [12450 - 3210, 3210 - 415, 415], backgroundColor: ['rgba(255,255,255,0.05)', 'var(--accent-purple)', 'var(--accent-green)'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }
    }
    
    setTimeout(initChartOverrides, 500);

});
