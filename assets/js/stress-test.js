/**
 * Food Security Stress Test Simulation
 * Based on "Association between Food Security and Stressful Life Events among Canadian Adults" (El-Hajj & Benhin, 2021)
 */

(function() {
    'use strict';

    // --- Data Model (Source: El-Hajj & Benhin 2021) ---
    // Base Odds derived from 5.2% population prevalence
    const BASE_PROBABILITY = 0.052; 
    const BASE_ODDS = BASE_PROBABILITY / (1 - BASE_PROBABILITY);

    // Factors and their Adjusted Odds Ratios (AOR)
    const FACTORS = {
        housing: {
            owner: 1.0,      // Reference
            renter: 3.08     // AOR: 3.08***
        },
        income: {
            high: 1.0,       // Reference (Top 80%)
            low: 2.70        // AOR: 2.70*** (Bottom 20%)
        },
        education: {
            hs: 1.0,         // Reference (High School)
            degree: 0.43     // AOR: 0.43* (Protective)
        },
        family: {
            single: 1.0,     // Reference
            couple: 0.51     // AOR: 0.51* (Protective)
        }
    };

    const EVENTS = {
        job_loss: { 
            id: 'job_loss', 
            label: 'Lost Job', 
            aor: 2.48, 
            desc: 'Involuntary job loss increases odds by ~2.5x.' 
        },
        worsening_finances: { 
            id: 'worsening_finances', 
            label: 'Financial Crisis', 
            aor: 7.25, 
            desc: 'A major worsening of finances is the strongest predictor (7.25x).' 
        },
        illness: { 
            id: 'illness', 
            label: 'Serious Illness', 
            aor: 2.34, 
            desc: 'Injury or illness to self or family member.' 
        },
        crime: { 
            id: 'crime', 
            label: 'Victim of Crime', 
            aor: 2.27, 
            desc: 'Being a victim of crime doubles the odds.' 
        },
        divorce: { 
            id: 'divorce', 
            label: 'Divorce', 
            aor: 1.12, 
            desc: 'Marital breakdown adds stress.' 
        }
    };

    // --- State ---
    let state = {
        housing: 'owner',
        income: 'high',
        education: 'hs',
        family: 'single',
        activeEvents: []
    };

    // --- DOM Elements ---
    let container;

    function init() {
        container = document.getElementById('stress-test-container');
        if (!container) return;
        renderInterface();
        updateSimulation();
    }

    function renderInterface() {
        container.innerHTML = `
            <div class="stress-header">
                <h4>Can You Survive the Shock?</h4>
                <p>Configure a household profile and apply <strong>Stressful Life Events</strong> to simulate the risk of food insecurity.</p>
            </div>
            
            <div class="stress-dashboard">
                <!-- Left Panel: Controls -->
                <div class="stress-panel-left">
                    
                    <div class="control-group">
                        <h5>Household Profile</h5>
                        
                        <div class="stress-toggle-row">
                            <button class="stress-btn active" data-cat="housing" data-val="owner">Homeowner</button>
                            <button class="stress-btn" data-cat="housing" data-val="renter">Renter</button>
                        </div>
                        
                        <div class="stress-toggle-row">
                            <button class="stress-btn active" data-cat="income" data-val="high">Mid/High Income</button>
                            <button class="stress-btn" data-cat="income" data-val="low">Low Income</button>
                        </div>

                        <div class="stress-toggle-row">
                            <button class="stress-btn" data-cat="education" data-val="hs">High School</button>
                            <button class="stress-btn active" data-cat="education" data-val="degree">Uni Degree</button>
                        </div>

                        <div class="stress-toggle-row">
                            <button class="stress-btn active" data-cat="family" data-val="single">Single</button>
                            <button class="stress-btn" data-cat="family" data-val="couple">Couple</button>
                        </div>
                    </div>

                    <div class="control-group">
                        <h5>Life Events (Click to Add)</h5>
                        <div class="event-grid" id="event-grid"></div>
                    </div>

                </div>

                <!-- Right Panel: Visualization -->
                <div class="stress-panel-right">
                    <div class="risk-label">Estimated Food Insecurity Risk</div>
                    
                    <div class="risk-meter-container">
                        <div class="risk-circle">
                            <div class="risk-fill" id="risk-fill"></div>
                            <div class="risk-needle" id="risk-needle"></div>
                        </div>
                        <div class="risk-value" id="risk-value">5.2%</div>
                    </div>

                    <div class="risk-message" id="risk-message">
                        Configure the simulation to see results.
                    </div>

                    <div class="paper-ref">
                        Based on Adjusted Odds Ratios from El-Hajj & Benhin (2021).<br>
                        "Low Income" = Bottom 20%. "Worsening Finances" is distinct from income level.
                    </div>
                </div>
            </div>
        `;

        // Render Event Buttons
        const eventGrid = document.getElementById('event-grid');
        Object.values(EVENTS).forEach(evt => {
            const btn = document.createElement('button');
            btn.className = 'event-btn';
            btn.textContent = evt.label;
            btn.dataset.id = evt.id;
            // Capture the evt.id correctly in the closure
            btn.onclick = function() { toggleEvent(evt.id, btn); };
            eventGrid.appendChild(btn);
        });

        // Add Listeners to Profile Toggles
        document.querySelectorAll('.stress-btn').forEach(btn => {
            btn.onclick = function() {
                const cat = this.dataset.cat;
                // Deactivate siblings in same category
                const siblings = container.querySelectorAll(`.stress-btn[data-cat="${cat}"]`);
                siblings.forEach(b => b.classList.remove('active'));
                
                // Activate self
                this.classList.add('active');
                
                // Update State
                state[cat] = this.dataset.val;
                updateSimulation();
            };
        });
    }

    function toggleEvent(id, btnElement) {
        const index = state.activeEvents.indexOf(id);
        if (index === -1) {
            state.activeEvents.push(id);
            btnElement.classList.add('active');
        } else {
            state.activeEvents.splice(index, 1);
            btnElement.classList.remove('active');
        }
        updateSimulation();
    }

    function updateSimulation() {
        // 1. Calculate Multiplier
        let multiplier = 1.0;

        // Profile Factors
        if (FACTORS.housing[state.housing]) multiplier *= FACTORS.housing[state.housing];
        if (FACTORS.income[state.income]) multiplier *= FACTORS.income[state.income];
        if (FACTORS.education[state.education]) multiplier *= FACTORS.education[state.education];
        if (FACTORS.family[state.family]) multiplier *= FACTORS.family[state.family];

        // Event Factors
        state.activeEvents.forEach(evtId => {
            if (EVENTS[evtId]) multiplier *= EVENTS[evtId].aor;
        });

        // 2. Calculate Probability
        const currentOdds = BASE_ODDS * multiplier;
        const probability = currentOdds / (1 + currentOdds);
        const percent = (probability * 100).toFixed(1);

        // 3. Update UI
        updateGauge(percent);
        updateMessage(percent, multiplier);
    }

    function updateGauge(percent) {
        const needle = document.getElementById('risk-needle');
        const fill = document.getElementById('risk-fill');
        const value = document.getElementById('risk-value');
        
        // Map 0-100% to -90deg to +90deg (180 degree span)
        // Cap visual at 100%
        const numPercent = parseFloat(percent);
        const visualPercent = Math.min(numPercent, 100);
        
        // 0% -> -90deg
        // 50% -> 0deg
        // 100% -> +90deg
        const degrees = (visualPercent / 100) * 180;
        
        if (needle) needle.style.transform = `rotate(${degrees - 90}deg)`;
        if (fill) fill.style.transform = `rotate(${degrees - 180}deg)`;

        if (value) {
            value.textContent = `${percent}%`;
            // Color change based on risk thresholds
            if (numPercent < 10) value.style.color = '#2ecc71'; // Green
            else if (numPercent < 30) value.style.color = '#f39c12'; // Orange
            else value.style.color = '#c0392b'; // Red
        }
    }

    function updateMessage(percent, multiplier) {
        const msgEl = document.getElementById('risk-message');
        if (!msgEl) return;

        let text = "";
        const numPercent = parseFloat(percent);
        
        if (state.activeEvents.length === 0) {
            if (numPercent < 6) {
                text = "<strong>Stable Baseline:</strong> This profile represents a secure household with minimal risk factors.";
            } else {
                text = "<strong>Structural Vulnerability:</strong> Even without active crisis events, this demographic profile carries elevated risk due to systemic factors.";
            }
        } else {
            const eventLabels = state.activeEvents.map(id => EVENTS[id].label);
            const eventsText = eventLabels.join(" + ");
            
            if (numPercent > 50) {
                text = `<strong>Critical Risk:</strong> The combination of structural vulnerability and <em>${eventsText}</em> creates a crisis scenario.`;
            } else if (multiplier > 5) {
                text = `<strong>High Impact:</strong> Experiencing <em>${eventsText}</em> dramatically increases the odds of food insecurity (over ${multiplier.toFixed(1)}x baseline).`;
            } else {
                text = `<strong>Resilience:</strong> Protective factors (like Higher Education or Homeownership) are buffering the impact of <em>${eventsText}</em>.`;
            }
        }
        
        msgEl.innerHTML = text;
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
