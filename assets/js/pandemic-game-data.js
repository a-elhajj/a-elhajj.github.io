/**
 * Pandemic Manager: AI Edition - Paper-Aligned Data
 * Tables 1, 2, 3, 4, 5 from Denis et al. "Learning COVID-19 Mitigation Strategies Using RL"
 * - Table 1: Agent states (age, employment, comorbidities)
 * - Table 3: Infection severity by age
 * - Table 4: Death probability by age + comorbidities
 * - Base infection: 3.931058% per contact; +SD reduces by factor 0.6
 */

(function (global) {
  "use strict";

  var P_INFECTION_PER_CONTACT = 0.03931058;
  var P_INFECTION_PER_CONTACT_SD = 0.03931058 * 0.6;

  var AGE_BRACKETS = [
    { id: "0-19", label: "Age 0-19", min: 0, max: 19, susceptibilityMod: 1.0 },
    { id: "20-43", label: "Age 20-43", min: 20, max: 43, susceptibilityMod: 1.0 },
    { id: "44-53", label: "Age 44-53", min: 44, max: 53, susceptibilityMod: 1.1 },
    { id: "54-63", label: "Age 54-63", min: 54, max: 63, susceptibilityMod: 1.15 },
    { id: "64-73", label: "Age 64-73", min: 64, max: 73, susceptibilityMod: 1.2 },
    { id: "74-83", label: "Age 74-83", min: 74, max: 83, susceptibilityMod: 1.3 },
    { id: "84+", label: "Age 84+", min: 84, max: 99, susceptibilityMod: 1.4 }
  ];

  var COMORBIDITY_MOD = { 0: 1.0, 1: 1.25, 2: 1.5 };

  var LOCATION_CONTACTS = {
    home: 3,
    work: 5,
    school: 10,
    social: 10
  };

  function generateAgentState() {
    var ageBracket = AGE_BRACKETS[Math.floor(Math.random() * AGE_BRACKETS.length)];
    var comorbidities = Math.random() < 0.2 ? (Math.random() < 0.6 ? 1 : 2) : 0;
    var employmentRoll = Math.random();
    var employmentStatus = employmentRoll < 0.6 ? "employed" : (employmentRoll < 0.75 ? "student" : "unemployed");
    var employmentType = employmentStatus === "employed" ? (Math.random() < 0.3 ? "essential" : "nonessential") : null;
    var seniorCenter = Math.random() < 0.02;

    var gender = Math.random() < 0.5 ? "female" : "male";
    var comorbidityLabel = comorbidities === 0 ? "No comorbidities" : (comorbidities === 1 ? "1 comorbidity" : "2+ comorbidities");

    return {
      ageBracket: ageBracket,
      ageLabel: ageBracket.label,
      gender: gender,
      comorbidities: comorbidities,
      comorbidityLabel: comorbidityLabel,
      employmentStatus: employmentStatus,
      employmentType: employmentType,
      seniorCenter: seniorCenter,
      susceptibilityMod: ageBracket.susceptibilityMod * COMORBIDITY_MOD[comorbidities]
    };
  }

  function calcInfectionRisk(locId, usesSD, communityLevel, agent) {
    var n = LOCATION_CONTACTS[locId] || 5;
    var pContact = usesSD ? P_INFECTION_PER_CONTACT_SD : P_INFECTION_PER_CONTACT;
    var baseProb = 1 - Math.pow(1 - pContact, n);
    var communityFactor = 1 + communityLevel * 2.5;
    var agentMod = agent && agent.susceptibilityMod ? agent.susceptibilityMod : 1;
    return Math.min(0.98, baseProb * communityFactor * agentMod);
  }

  var LOCATION_DEFS = {
    overworld: {
      id: "overworld",
      label: "Town",
      bgClass: "scene-overworld"
    },
    home: {
      id: "home",
      label: "Home",
      bgClass: "scene-home",
      baseContacts: 3,
      decisions: [
        {
          id: "stay_home",
          prompt: "Stay home today?",
          options: [
            { id: "yes", label: "Yes (Safe)", riskMod: 0 },
            { id: "no", label: "No, go out", riskMod: 0 }
          ]
        }
      ]
    },
    work: {
      id: "work",
      label: "Work",
      bgClass: "scene-work",
      baseContacts: 5,
      decisions: [
        {
          id: "work_from_home",
          prompt: "Work from Home today?",
          options: [
            { id: "yes", label: "Yes (Low Risk)", riskMod: 0 },
            { id: "no", label: "No (High Risk, High Reward)", riskMod: 1 }
          ]
        },
        {
          id: "mask_sd",
          prompt: "Wear mask and practice social distancing at work?",
          options: [
            { id: "yes", label: "Yes", riskMod: 0.6, usesSD: true },
            { id: "no", label: "No", riskMod: 1, usesSD: false }
          ]
        }
      ]
    },
    school: {
      id: "school",
      label: "School",
      bgClass: "scene-school",
      baseContacts: 10,
      decisions: [
        {
          id: "go_school",
          prompt: "Go to school today?",
          options: [
            { id: "yes", label: "Yes", riskMod: 1 },
            { id: "no", label: "No, stay home", riskMod: 0 }
          ]
        },
        {
          id: "mask_sd",
          prompt: "Wear mask and keep distance?",
          options: [
            { id: "yes", label: "Yes", riskMod: 0.6, usesSD: true },
            { id: "no", label: "No", riskMod: 1, usesSD: false }
          ]
        }
      ]
    },
    social: {
      id: "social",
      label: "Social Event",
      bgClass: "scene-social",
      baseContacts: 10,
      decisions: [
        {
          id: "go_social",
          prompt: "Go to the social event?",
          options: [
            { id: "yes", label: "Yes", riskMod: 1 },
            { id: "no", label: "No", riskMod: 0 }
          ]
        },
        {
          id: "confirm_social",
          prompt: "Are you sure? Transmission risk is high.",
          options: [
            { id: "yes", label: "Yes, I'm going", riskMod: 1 },
            { id: "no", label: "No, I'll stay home", riskMod: 0 }
          ]
        },
        {
          id: "mask_sd",
          prompt: "Wear mask and practice social distancing?",
          options: [
            { id: "yes", label: "Yes", riskMod: 0.6, usesSD: true },
            { id: "no", label: "No", riskMod: 1, usesSD: false }
          ]
        }
      ]
    },
    hospital: {
      id: "hospital",
      label: "Hospital",
      bgClass: "scene-hospital",
      baseContacts: 5,
      decisions: [
        {
          id: "get_tested",
          prompt: "Get tested for COVID-19?",
          options: [
            { id: "yes", label: "Yes (Check Status)", riskMod: 0 },
            { id: "no", label: "No, just visiting", riskMod: 1 }
          ]
        },
        {
          id: "mask_sd",
          prompt: "Wear mask in waiting room?",
          options: [
            { id: "yes", label: "Yes", riskMod: 0.2, usesSD: true },
            { id: "no", label: "No", riskMod: 1.5, usesSD: false }
          ]
        }
      ]
    }
  };

  var OVERWORLD_BUTTONS = [
    { id: "home", label: "Home", x: "15%", y: "60%" },
    { id: "work", label: "Work", x: "50%", y: "25%" },
    { id: "school", label: "School", x: "80%", y: "35%" },
    { id: "social", label: "Social Event", x: "75%", y: "70%" }
  ];

  function getLocationDef(locId) {
    return LOCATION_DEFS[locId] || null;
  }

  function rollInfection(def, totalRiskMod, communityLevel, agent, chosenOptions) {
    if (totalRiskMod === 0) return false;

    var locId = def.id;
    if (locId === "home") return false;

    var usesSD = false;
    if (chosenOptions && chosenOptions.mask_sd && chosenOptions.mask_sd.option === "yes") {
      usesSD = true;
    }

    var baseRisk = calcInfectionRisk(locId, usesSD, communityLevel, agent);
    var effectiveRisk = baseRisk * totalRiskMod;
    return Math.random() < effectiveRisk;
  }

  var RESEARCH_TIPS = [
    "Research: 45.4% of infections occur at home when people spend more time indoors. Household transmission is real.",
    "RL agents learned that getting tested and self-isolating when symptomatic dramatically reduces spread.",
    "Contact tracing + asymptomatic testing outperforms blunt lockdowns in our Ontario simulation.",
    "School compliance matters: non-compliant schools become hotbeds for infection.",
    "Agents learned to prefer social distancing (+SD) 8x more than going without when at school.",
    "Asymptomatic carriers can spread the virus. Testing identifies hidden carriers before they infect others.",
    "Paper: +SD reduces infection rate by factor 0.6. Mask and distance at high-risk locations."
  ];

  function getRandomTip() {
    return RESEARCH_TIPS[Math.floor(Math.random() * RESEARCH_TIPS.length)];
  }

  global.PandemicGameData = {
    LOCATION_DEFS: LOCATION_DEFS,
    OVERWORLD_BUTTONS: OVERWORLD_BUTTONS,
    getLocationDef: getLocationDef,
    rollInfection: rollInfection,
    getRandomTip: getRandomTip,
    generateAgentState: generateAgentState,
    calcInfectionRisk: calcInfectionRisk
  };
})(typeof window !== "undefined" ? window : this);
