// script.js

/*===============================================
  1. CONFIGURATION & CONSTANTS
  — Define all scoring flags, weights, and thresholds here
===============================================*/
const FLAG_RULES = {
  tobacco:          ["Yes - Smoking", "Yes - Chewing", "Yes - Vaping"],
  alcohol:          ["Moderate", "Heavy"],
  drugs:            ["Yes - Current", "Yes - Past"],
  rehab:            ["Yes - Current", "Yes - Completed"],
  disabilityIncome: ["Yes"],
  working:          ["No"],
  painMeds:         ["Daily"],
  felony:           ["Yes - Felony"],
  license:          ["Yes"],
  hospital:         ["Yes - Emergency", "Yes - Surgery", "Yes - Mental Health"],
  adl:              ["Yes"],
  mentalMeds:       ["Yes"],
  mobility:         ["Walker", "Wheelchair"]
};

const BMI_THRESHOLDS = [
  { min: 40,   score: 3 },
  { min: 35,   score: 2 },
  { min: 0,    score: 0 }  // default if below 35
];

// Special-condition overrides (score=99 means automatic decline)
const OVERRIDE_CONDITIONS = {
  kidney:   { value: "Yes", score: 99 },
  hiv:      { value: "Yes", score: 99 },
  amputation: { values: ["Paraplegic", "Quadriplegic"], score: 99 }
};

// Cancer scoring
const CANCER_SCORES = {
  "Yes - Active":           4,
  "Yes - Remission <5 yrs": 2,
  "Yes - Remission >5 yrs": 1
};

// Diabetes scoring
const DIABETES_SCORES = {
  "Type 1": 2,
  "Type 2": 2,
  "No":     0
};

// Blood pressure scoring
const BP_SCORES = {
  Controlled:   1,
  Uncontrolled: 2,
  Normal:       0
};

// Respiratory scoring
const RESPIRATORY_SCORES = {
  Asthma:      2,
  COPD:        2,
  "Sleep Apnea": 2,
  None:        0
};

/*===============================================
  2. HELPER FUNCTIONS
  — Generic utilities for form access, BMI, etc.
===============================================*/

/**
 * Get the checked value of a named radio group
 * @param {string} name - name attribute of the radios
 * @returns {string|null}
 */
function getVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

/**
 * Calculate BMI given weight in lbs and height in inches
 * @param {number} weight
 * @param {number} heightInInches
 * @returns {number} rounded BMI
 */
function calculateBMI(weight, heightInInches) {
  const raw = (weight / (heightInInches ** 2)) * 703;
  return Math.round(raw * 10) / 10;
}

/*===============================================
  3. CORE SCORING LOGIC
===============================================*/

/**
 * Compute the total risk score
 * @returns {{ score: number, bmi: number }}
 */
function computeScore() {
  let score = 0;

  // Vitals
  const feet = parseInt(document.getElementById("heightFeet").value, 10);
  const inches = parseInt(document.getElementById("heightInches").value, 10);
  const weight = parseFloat(document.getElementById("weight").value);
  const heightInInches = feet * 12 + inches;
  const bmi = calculateBMI(weight, heightInInches);

  // Flag-based scoring
  for (let key in FLAG_RULES) {
    if (FLAG_RULES[key].includes(getVal(key))) {
      score++;
    }
  }

  // Diabetes
  score += DIABETES_SCORES[getVal("diabetes")] || 0;

  // Insulin
  if (getVal("insulin") === "Yes") score++;

  // Blood pressure
  score += BP_SCORES[getVal("bp")] || 0;

  // Extra BP penalty for uncontrolled
  if (getVal("bp") === "Uncontrolled") score++;

  // Respiratory issues
  score += RESPIRATORY_SCORES[getVal("respiratory")] || 0;

  // CPAP
  if (getVal("cpap") === "No") score++;

  // Seizures
  if (getVal("seizures") === "Yes") score += 2;

  // Overrides (kidney, HIV, paralysis)
  if (getVal("kidney") === OVERRIDE_CONDITIONS.kidney.value) {
    score = OVERRIDE_CONDITIONS.kidney.score;
  }
  if (getVal("hiv") === OVERRIDE_CONDITIONS.hiv.value) {
    score = OVERRIDE_CONDITIONS.hiv.score;
  }
  if (OVERRIDE_CONDITIONS.amputation.values.includes(getVal("amputation"))) {
    score = OVERRIDE_CONDITIONS.amputation.score;
  }

  // Liver
  if (getVal("liver") === "Yes") score += 3;

  // Cancer
  score += CANCER_SCORES[getVal("cancer")] || 0;

  // Mental health
  if (["Depression", "Bipolar", "Schizophrenia"].includes(getVal("mental"))) {
    score += 2;
  }

  // BMI-based scoring
  for (let threshold of BMI_THRESHOLDS) {
    if (bmi >= threshold.min) {
      score += threshold.score;
      break;
    }
  }

  return { score, bmi };
}

/*===============================================
  4. OUTCOME DETERMINATION
===============================================*/

/**
 * Given a risk score and gender, returns the rating, recommendation,
 * eligibility, and life expectancy.
 */
function determineOutcome(score, gender) {
  let mr = "100%";
  let recommendation = "Standard";
  let le = gender === "M" ? 360 - (score * 12) : 384 - (score * 12);
  let eligibility = "Good Candidate";
  const declined = (score === 99);

  if (declined) {
    mr = recommendation = "Decline";
    eligibility = "Not Eligible";
    le = 0;
  } else if (score >= 9) {
    mr = "350%+";
    recommendation = "Decline";
    eligibility = "Not Eligible";
    le = Math.max(le, 0);
  } else if (score >= 7) {
    mr = "325%";
    recommendation = "Table 6";
    eligibility = "Borderline";
  } else if (score >= 5) {
    mr = "275%";
    recommendation = "Table 4";
    eligibility = "Borderline";
  } else if (score >= 3) {
    mr = "200–225%";
    recommendation = "Table 2";
    eligibility = "Good Candidate";
  }

  // Boost borderline with healthy habits
  if (
    eligibility === "Borderline" &&
    getVal("diet") === "Yes" &&
    getVal("exercise") === "Yes"
  ) {
    eligibility = "Good Candidate";
  }

  return { mr, recommendation, eligibility, le };
}

/*===============================================
  5. RENDERING
===============================================*/

/**
 * Inserts the results HTML into the page.
 */
function renderResults({ bmi, score }, outcome) {
  document.getElementById("results").innerHTML = `
    <h2>Results</h2>
    <p><strong>BMI:</strong> ${bmi}</p>
    <p><strong>Risk Score:</strong> ${score}</p>
    <p><strong>Mortality Rating:</strong> ${outcome.mr}</p>
    <p><strong>Estimated Life Expectancy:</strong> ${outcome.le} months</p>
    <p><strong>Recommendation:</strong> ${outcome.recommendation}</p>
    <p><strong>Life Insurance Candidacy:</strong> ${outcome.eligibility}</p>
  `;
}

/*===============================================
  6. INITIALIZATION & EVENT BINDING
===============================================*/

/**
 * Wire up the form submission to calculate and render.
 */
function init() {
  const form = document.getElementById("leForm");
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    const { score, bmi } = computeScore();
    const gender = getVal("gender");
    const outcome = determineOutcome(score, gender);
    renderResults({ score, bmi }, outcome);
  });
}

// kick things off
init();
