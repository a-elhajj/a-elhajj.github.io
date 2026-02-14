/**
 * Pandemic Manager: AI Edition - Paper-Aligned Data
 * Denis et al. "Learning COVID-19 Mitigation Strategies Using RL"
 * - Table 1: Agent states (age, employment, comorbidities)
 * - Table 2: Action categories (Work, Social, School, Home + SD)
 * - Table 6: Infection events (%) by location - B1 (baseline), B2 (with SD)
 */

(function (global) {
  "use strict";

  /* Table 6: Infection events (%) - B1=no SD, B2=with SD. Scaled ~0.4 for per-visit probability. */
  var TABLE6_BASE = {
    social: { noSD: 0.057, withSD: 0.040 },
    school: { noSD: 0.038, withSD: 0.030 },
    work: { noSD: 0.048, withSD: 0.032 },
    hospital: { noSD: 0.040, withSD: 0.024 }
  };

  /* Table 1: Agent states - Age susceptibility (Table 3 severity correlates with susceptibility) */
  var AGE_BRACKETS = [
    { id: "0-19", label: "Age 0-19", min: 0, max: 19, susceptibilityMod: 0.95 },
    { id: "20-43", label: "Age 20-43", min: 20, max: 43, susceptibilityMod: 1.0 },
    { id: "44-53", label: "Age 44-53", min: 44, max: 53, susceptibilityMod: 1.05 },
    { id: "54-63", label: "Age 54-63", min: 54, max: 63, susceptibilityMod: 1.1 },
    { id: "64-73", label: "Age 64-73", min: 64, max: 73, susceptibilityMod: 1.15 },
    { id: "74-83", label: "Age 74-83", min: 74, max: 83, susceptibilityMod: 1.2 },
    { id: "84+", label: "Age 84+", min: 84, max: 99, susceptibilityMod: 1.25 }
  ];

  /* Table 1: # Comorbidities {0, 1, 2+} - gentler modifiers for infection susceptibility */
  var COMORBIDITY_MOD = { 0: 1.0, 1: 1.08, 2: 1.15, 3: 1.2 };

  function generateAgentState() {
    var ageBracket = AGE_BRACKETS[Math.floor(Math.random() * AGE_BRACKETS.length)];
    // Increased comorbidity chance to 50% for more gameplay variety
    var comorbidities = Math.random() < 0.5 ? (Math.random() < 0.6 ? 1 : 2) : 0;
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
    var locKey = locId === "social" ? "social" : locId === "school" ? "school" : locId === "work" ? "work" : "hospital";
    var base = TABLE6_BASE[locKey] || TABLE6_BASE.work;
    var baseProb = usesSD ? base.withSD : base.noSD;
    var communityFactor = 1 + communityLevel * 0.8;
    var agentMod = agent && agent.susceptibilityMod ? agent.susceptibilityMod : 1;
    return Math.min(0.85, baseProb * communityFactor * agentMod);
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
            { id: "no", label: "No", riskMod: 1.2, usesSD: false }
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
    /* Cap at 0.95 so infection is never guaranteed - paper uses probabilities */
    effectiveRisk = Math.min(0.95, effectiveRisk);
    return Math.random() < effectiveRisk;
  }

  var RESEARCH_TIPS = [
    "Paper Table 6: 45.4% of infections occur at home when people spend more time indoors (LB scenario). Household transmission is real.",
    "Table 6: Being social 14.3% (B1) vs 9.9% (B2) with SD—mask and distance cut risk.",
    "Table 6: At school 9.6% (B1) vs 7.4% (B2) with SD. School + SD reduces infection events.",
    "Table 1: Your age and # comorbidities define your agent state and susceptibility.",
    "Contact tracing + asymptomatic testing (LB+ATT) outperforms blunt lockdowns in our Ontario simulation.",
    "Q-learning agents discovered work-from-home as a dominant strategy.",
    "Agent states from Table 1 (age, employment, comorbidities) affect infection probability."
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
