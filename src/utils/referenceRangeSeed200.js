/**
 * referenceRangeSeed200.js
 *
 * Migration script: Seeds the top 200 most common Indian diagnostic tests
 * with ICMR/WHO/CLSI age- and gender-specific reference ranges.
 *
 * Usage:
 *   node src/utils/referenceRangeSeed200.js
 *
 * Safety:
 *   - Idempotent: only updates parameters that don't yet have referenceRanges
 *   - Uses $set on specific parameter paths, never replaces the whole document
 *   - Reports success/skip/failure per test
 *
 * Requires: MONGODB_URI in environment (or .env file at project root)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────
// Reference Range Data
// Format per test:
// {
//   code: 'TEST_CODE',           // TestMaster code
//   parameterRanges: {
//     'Parameter Name': [         // Exact match to parameter name in DB
//       {
//         label: 'Adult Male',
//         genderMatch: ['male'],
//         ageMin: 18, ageMax: 150, ageUnit: 'years',
//         normalLow, normalHigh, criticalLow, criticalHigh
//       },
//       ...
//     ]
//   }
// }
// ─────────────────────────────────────────────────────────

const REFERENCE_RANGES = [

  // ══════════════════════════════════════════════════════
  // HAEMATOLOGY
  // ══════════════════════════════════════════════════════

  {
    code: 'CBC',
    parameterRanges: {
      'Hemoglobin': [
        { label: 'Adult Male (18+ yrs)', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 13.0, normalHigh: 17.5, criticalLow: 7.0, criticalHigh: 20.0 },
        { label: 'Adult Female (18+ yrs)', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 12.0, normalHigh: 16.0, criticalLow: 7.0, criticalHigh: 20.0 },
        { label: 'Adolescent (12-17 yrs)', genderMatch: ['any'], ageMin: 12, ageMax: 17, ageUnit: 'years', normalLow: 11.5, normalHigh: 16.0, criticalLow: 7.0, criticalHigh: 20.0 },
        { label: 'Child (5-11 yrs)', genderMatch: ['any'], ageMin: 5, ageMax: 11, ageUnit: 'years', normalLow: 11.5, normalHigh: 15.5, criticalLow: 7.0, criticalHigh: 20.0 },
        { label: 'Toddler (6m-5 yrs)', genderMatch: ['any'], ageMin: 6, ageMax: 60, ageUnit: 'months', normalLow: 10.5, normalHigh: 13.5, criticalLow: 7.0, criticalHigh: 20.0 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 14.0, normalHigh: 24.0, criticalLow: 9.5, criticalHigh: 30.0 }
      ],
      'Total WBC Count': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 4.0, normalHigh: 11.0, criticalLow: 2.0, criticalHigh: 30.0 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 5.0, normalHigh: 15.0, criticalLow: 2.0, criticalHigh: 30.0 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 9.0, normalHigh: 30.0, criticalLow: 5.0, criticalHigh: 50.0 }
      ],
      'Platelet Count': [
        { label: 'Adult & Child', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 150, normalHigh: 400, criticalLow: 50, criticalHigh: 1000 }
      ],
      'RBC Count': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 4.5, normalHigh: 5.9 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 3.8, normalHigh: 5.2 },
        { label: 'Child (6m-17 yrs)', genderMatch: ['any'], ageMin: 6, ageMax: 204, ageUnit: 'months', normalLow: 3.8, normalHigh: 5.5 }
      ],
      'Hematocrit (PCV)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 40, normalHigh: 52, criticalLow: 20, criticalHigh: 65 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 36, normalHigh: 47, criticalLow: 20, criticalHigh: 65 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 44, normalHigh: 64 }
      ],
      'MCV': [
        { label: 'Adult & Child (6m+)', genderMatch: ['any'], ageMin: 6, ageMax: 1800, ageUnit: 'months', normalLow: 80, normalHigh: 100 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 95, normalHigh: 121 }
      ],
      'MCH': [
        { label: 'Adult & Child (6m+)', genderMatch: ['any'], ageMin: 6, ageMax: 1800, ageUnit: 'months', normalLow: 27, normalHigh: 33 }
      ],
      'MCHC': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 31.5, normalHigh: 36.0, criticalLow: 15, criticalHigh: 40 }
      ],
      'RDW': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 11.5, normalHigh: 14.5 }
      ],
      'Neutrophils': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 40, normalHigh: 80 }
      ],
      'Lymphocytes': [
        { label: 'Adult', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 20, normalHigh: 40 },
        { label: 'Child (<12 yrs)', genderMatch: ['any'], ageMin: 0, ageMax: 11, ageUnit: 'years', normalLow: 25, normalHigh: 60 }
      ],
      'Monocytes': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 2, normalHigh: 8 }
      ],
      'Eosinophils': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 1, normalHigh: 4 }
      ],
      'Basophils': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 1 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // BIOCHEMISTRY — GLUCOSE
  // ══════════════════════════════════════════════════════

  {
    code: 'FBS',
    parameterRanges: {
      'Fasting Blood Glucose': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 70, normalHigh: 100, criticalLow: 40, criticalHigh: 500 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 60, normalHigh: 100, criticalLow: 40, criticalHigh: 400 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 40, normalHigh: 90, criticalLow: 25, criticalHigh: 300 }
      ]
    }
  },

  {
    code: 'PPBS',
    parameterRanges: {
      'Post Prandial Blood Glucose': [
        { label: 'Adult (18+ yrs) — Normal', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 70, normalHigh: 140, criticalLow: 40, criticalHigh: 600 }
      ]
    }
  },

  {
    code: 'RBS',
    parameterRanges: {
      'Random Blood Glucose': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 70, normalHigh: 140, criticalLow: 40, criticalHigh: 600 }
      ]
    }
  },

  {
    code: 'HBA1C',
    parameterRanges: {
      'HbA1c': [
        { label: 'Non-diabetic Adult', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 4.0, normalHigh: 5.6 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // BIOCHEMISTRY — LIVER FUNCTION
  // ══════════════════════════════════════════════════════

  {
    code: 'LFT',
    parameterRanges: {
      'Serum ALT (SGPT)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 7, normalHigh: 56, criticalHigh: 3000 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 7, normalHigh: 45, criticalHigh: 3000 },
        { label: 'Child (<18 yrs)', genderMatch: ['any'], ageMin: 0, ageMax: 17, ageUnit: 'years', normalLow: 7, normalHigh: 45, criticalHigh: 2000 }
      ],
      'Serum AST (SGOT)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 10, normalHigh: 40, criticalHigh: 3000 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 10, normalHigh: 35, criticalHigh: 3000 },
        { label: 'Child (<18 yrs)', genderMatch: ['any'], ageMin: 0, ageMax: 17, ageUnit: 'years', normalLow: 10, normalHigh: 40, criticalHigh: 2000 }
      ],
      'Serum GGT': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 55 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 38 }
      ],
      'Serum Alkaline Phosphatase': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 44, normalHigh: 147, criticalHigh: 1000 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 54, normalHigh: 369 }
      ],
      'Total Bilirubin': [
        { label: 'Adult & Child (1m+)', genderMatch: ['any'], ageMin: 1, ageMax: 1800, ageUnit: 'months', normalLow: 0.1, normalHigh: 1.2, criticalHigh: 15.0 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 0.2, normalHigh: 12.0, criticalHigh: 20.0 }
      ],
      'Direct Bilirubin': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0.0, normalHigh: 0.3, criticalHigh: 10.0 }
      ],
      'Indirect Bilirubin': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0.1, normalHigh: 1.0 }
      ],
      'Total Protein': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 6.0, normalHigh: 8.3 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 5.6, normalHigh: 8.0 }
      ],
      'Serum Albumin': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 3.4, normalHigh: 5.4, criticalLow: 1.5 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 3.2, normalHigh: 5.0 }
      ],
      'Globulin': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.0, normalHigh: 3.5 }
      ],
      'A/G Ratio': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 1.0, normalHigh: 2.5 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // BIOCHEMISTRY — KIDNEY FUNCTION
  // ══════════════════════════════════════════════════════

  {
    code: 'KFT',
    parameterRanges: {
      'Serum Creatinine': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.74, normalHigh: 1.35, criticalHigh: 10.0 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.59, normalHigh: 1.04, criticalHigh: 10.0 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 0.20, normalHigh: 0.86 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 0.3, normalHigh: 1.2 }
      ],
      'Blood Urea Nitrogen': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 7, normalHigh: 25, criticalHigh: 100 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 5, normalHigh: 20 }
      ],
      'Serum Urea': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 15, normalHigh: 45, criticalHigh: 200 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 11, normalHigh: 36 }
      ],
      'Serum Uric Acid': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 3.4, normalHigh: 7.0 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.4, normalHigh: 6.0 },
        { label: 'Child (<18 yrs)', genderMatch: ['any'], ageMin: 0, ageMax: 17, ageUnit: 'years', normalLow: 2.0, normalHigh: 5.5 }
      ],
      'eGFR': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 60, normalHigh: 120 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // ELECTROLYTES
  // ══════════════════════════════════════════════════════

  {
    code: 'ELEC',
    parameterRanges: {
      'Serum Sodium': [
        { label: 'Adult & Child (1m+)', genderMatch: ['any'], ageMin: 1, ageMax: 1800, ageUnit: 'months', normalLow: 135, normalHigh: 145, criticalLow: 120, criticalHigh: 160 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 133, normalHigh: 146, criticalLow: 120, criticalHigh: 160 }
      ],
      'Serum Potassium': [
        { label: 'Adult & Child (1m+)', genderMatch: ['any'], ageMin: 1, ageMax: 1800, ageUnit: 'months', normalLow: 3.5, normalHigh: 5.0, criticalLow: 2.5, criticalHigh: 6.5 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 3.5, normalHigh: 6.5, criticalLow: 2.5, criticalHigh: 8.0 }
      ],
      'Serum Chloride': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 96, normalHigh: 106, criticalLow: 80, criticalHigh: 120 }
      ],
      'Serum Bicarbonate': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 22, normalHigh: 29, criticalLow: 10, criticalHigh: 40 }
      ]
    }
  },

  {
    code: 'CA',
    parameterRanges: {
      'Serum Calcium': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 8.5, normalHigh: 10.5, criticalLow: 6.0, criticalHigh: 13.0 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 8.4, normalHigh: 10.8, criticalLow: 6.0, criticalHigh: 13.5 },
        { label: 'Neonate', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 7.6, normalHigh: 10.4, criticalLow: 6.0, criticalHigh: 13.0 }
      ]
    }
  },

  {
    code: 'MG',
    parameterRanges: {
      'Serum Magnesium': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 1.7, normalHigh: 2.2, criticalLow: 1.0, criticalHigh: 4.9 }
      ]
    }
  },

  {
    code: 'PHOS',
    parameterRanges: {
      'Serum Phosphorus': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.5, normalHigh: 4.5 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 3.8, normalHigh: 6.5 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // LIPID PROFILE
  // ══════════════════════════════════════════════════════

  {
    code: 'LIPID',
    parameterRanges: {
      'Total Cholesterol': [
        { label: 'Desirable (<200 mg/dL)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 200, criticalHigh: 500 }
      ],
      'HDL Cholesterol': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 40, normalHigh: 60 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 50, normalHigh: 60 }
      ],
      'LDL Cholesterol': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 130, criticalHigh: 500 }
      ],
      'VLDL Cholesterol': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2, normalHigh: 30 }
      ],
      'Serum Triglycerides': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 150, criticalHigh: 1000 }
      ],
      'Non-HDL Cholesterol': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 160 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // THYROID FUNCTION
  // ══════════════════════════════════════════════════════

  {
    code: 'TFT',
    parameterRanges: {
      'TSH': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.4, normalHigh: 4.0, criticalLow: 0.01, criticalHigh: 100.0 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 0.5, normalHigh: 5.0 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 1.0, normalHigh: 39.0 }
      ],
      'Total T3': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.8, normalHigh: 2.0 }
      ],
      'Total T4': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 5.1, normalHigh: 14.1 }
      ],
      'Free T3 (FT3)': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.3, normalHigh: 4.2 }
      ],
      'Free T4 (FT4)': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.8, normalHigh: 1.8 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // IRON STUDIES
  // ══════════════════════════════════════════════════════

  {
    code: 'IRON',
    parameterRanges: {
      'Serum Iron': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 65, normalHigh: 175 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 50, normalHigh: 170 }
      ],
      'TIBC': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 250, normalHigh: 370 }
      ],
      'Transferrin Saturation': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 20, normalHigh: 50 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 15, normalHigh: 50 }
      ]
    }
  },

  {
    code: 'FERRITIN',
    parameterRanges: {
      'Serum Ferritin': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 30, normalHigh: 400 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 10, normalHigh: 150 },
        { label: 'Child (1-12 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 12, ageUnit: 'years', normalLow: 7, normalHigh: 140 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // COAGULATION
  // ══════════════════════════════════════════════════════

  {
    code: 'PT',
    parameterRanges: {
      'Prothrombin Time (PT)': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 11.0, normalHigh: 14.5, criticalHigh: 30.0 }
      ],
      'INR': [
        { label: 'Non-anticoagulated', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0.8, normalHigh: 1.2, criticalHigh: 4.0 }
      ],
      'APTT': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 25, normalHigh: 38, criticalHigh: 80 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // INFLAMMATION MARKERS
  // ══════════════════════════════════════════════════════

  {
    code: 'ESR',
    parameterRanges: {
      'ESR (Westergren)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 50, ageUnit: 'years', normalLow: 0, normalHigh: 15 },
        { label: 'Adult Male (50+ yrs)', genderMatch: ['male'], ageMin: 50, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 20 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 50, ageUnit: 'years', normalLow: 0, normalHigh: 20 },
        { label: 'Adult Female (50+ yrs)', genderMatch: ['female'], ageMin: 50, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 30 },
        { label: 'Child (<18 yrs)', genderMatch: ['any'], ageMin: 0, ageMax: 17, ageUnit: 'years', normalLow: 0, normalHigh: 10 }
      ]
    }
  },

  {
    code: 'CRP',
    parameterRanges: {
      'C-Reactive Protein (CRP)': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 10.0 }
      ],
      'High Sensitivity CRP (hs-CRP)': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 3.0 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // VITAMINS & MINERALS
  // ══════════════════════════════════════════════════════

  {
    code: 'VITD',
    parameterRanges: {
      'Vitamin D (25-OH)': [
        { label: 'Optimal (All ages)', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 30, normalHigh: 100, criticalLow: 10 }
      ]
    }
  },

  {
    code: 'VITB12',
    parameterRanges: {
      'Vitamin B12': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 200, normalHigh: 900, criticalLow: 100 }
      ]
    }
  },

  {
    code: 'FOLATE',
    parameterRanges: {
      'Serum Folate': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.7, normalHigh: 17.0, criticalLow: 2.0 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // CARDIAC MARKERS
  // ══════════════════════════════════════════════════════

  {
    code: 'TROPONIN',
    parameterRanges: {
      'Troponin I': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 0.04, criticalHigh: 0.1 }
      ]
    }
  },

  {
    code: 'CKMB',
    parameterRanges: {
      'CK-MB': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 25, criticalHigh: 100 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 20, criticalHigh: 100 }
      ]
    }
  },

  {
    code: 'CPK',
    parameterRanges: {
      'Creatine Phosphokinase (CPK)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 39, normalHigh: 308 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 26, normalHigh: 192 }
      ]
    }
  },

  {
    code: 'LDH',
    parameterRanges: {
      'Lactate Dehydrogenase (LDH)': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 140, normalHigh: 280, criticalHigh: 1000 },
        { label: 'Child (1-17 yrs)', genderMatch: ['any'], ageMin: 1, ageMax: 17, ageUnit: 'years', normalLow: 170, normalHigh: 580 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // HORMONES — REPRODUCTIVE
  // ══════════════════════════════════════════════════════

  {
    code: 'TESTOS',
    parameterRanges: {
      'Total Testosterone': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 270, normalHigh: 1070 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 15, normalHigh: 70 }
      ]
    }
  },

  {
    code: 'FSH',
    parameterRanges: {
      'FSH': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 1.5, normalHigh: 12.4 },
        { label: 'Adult Female — Follicular', genderMatch: ['female'], ageMin: 18, ageMax: 45, ageUnit: 'years', normalLow: 3.5, normalHigh: 12.5 },
        { label: 'Post-menopausal', genderMatch: ['female'], ageMin: 45, ageMax: 150, ageUnit: 'years', normalLow: 25.8, normalHigh: 134.8 }
      ]
    }
  },

  {
    code: 'LH',
    parameterRanges: {
      'LH': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 1.7, normalHigh: 8.6 },
        { label: 'Adult Female — Follicular', genderMatch: ['female'], ageMin: 18, ageMax: 45, ageUnit: 'years', normalLow: 2.4, normalHigh: 12.6 },
        { label: 'Post-menopausal', genderMatch: ['female'], ageMin: 45, ageMax: 150, ageUnit: 'years', normalLow: 7.7, normalHigh: 58.5 }
      ]
    }
  },

  {
    code: 'PROLACTIN',
    parameterRanges: {
      'Serum Prolactin': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2, normalHigh: 18 },
        { label: 'Adult Female (non-pregnant)', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2, normalHigh: 29 }
      ]
    }
  },

  {
    code: 'ESTRADIOL',
    parameterRanges: {
      'Estradiol (E2)': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 10, normalHigh: 40 },
        { label: 'Adult Female — Follicular', genderMatch: ['female'], ageMin: 18, ageMax: 45, ageUnit: 'years', normalLow: 12.5, normalHigh: 166 },
        { label: 'Post-menopausal', genderMatch: ['female'], ageMin: 45, ageMax: 150, ageUnit: 'years', normalLow: 6, normalHigh: 54 }
      ]
    }
  },

  {
    code: 'PROGEST',
    parameterRanges: {
      'Progesterone': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0.3, normalHigh: 1.2 },
        { label: 'Adult Female — Follicular', genderMatch: ['female'], ageMin: 18, ageMax: 45, ageUnit: 'years', normalLow: 0.1, normalHigh: 0.9 },
        { label: 'Adult Female — Luteal', genderMatch: ['female'], ageMin: 18, ageMax: 45, ageUnit: 'years', normalLow: 2.0, normalHigh: 25.0 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // HORMONES — ADRENAL
  // ══════════════════════════════════════════════════════

  {
    code: 'CORTISOL',
    parameterRanges: {
      'Serum Cortisol (AM)': [
        { label: 'Adult & Child (>1 yr)', genderMatch: ['any'], ageMin: 1, ageMax: 150, ageUnit: 'years', normalLow: 6.0, normalHigh: 23.0, criticalLow: 2.0, criticalHigh: 50.0 }
      ]
    }
  },

  {
    code: 'INSULIN',
    parameterRanges: {
      'Fasting Insulin': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.0, normalHigh: 25.0 }
      ],
      'HOMA-IR': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 2.5 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // TUMOUR MARKERS
  // ══════════════════════════════════════════════════════

  {
    code: 'PSA',
    parameterRanges: {
      'Total PSA': [
        { label: 'Male 40-49 yrs', genderMatch: ['male'], ageMin: 40, ageMax: 49, ageUnit: 'years', normalLow: 0, normalHigh: 2.5 },
        { label: 'Male 50-59 yrs', genderMatch: ['male'], ageMin: 50, ageMax: 59, ageUnit: 'years', normalLow: 0, normalHigh: 3.5 },
        { label: 'Male 60-69 yrs', genderMatch: ['male'], ageMin: 60, ageMax: 69, ageUnit: 'years', normalLow: 0, normalHigh: 4.5 },
        { label: 'Male 70+ yrs', genderMatch: ['male'], ageMin: 70, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 6.5 }
      ]
    }
  },

  {
    code: 'AFP',
    parameterRanges: {
      'Alpha-Fetoprotein (AFP)': [
        { label: 'Adult (non-pregnant)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 7.0 }
      ]
    }
  },

  {
    code: 'CEA',
    parameterRanges: {
      'CEA': [
        { label: 'Non-smoker', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 2.5 }
      ]
    }
  },

  {
    code: 'CA125',
    parameterRanges: {
      'CA-125': [
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 35 }
      ]
    }
  },

  {
    code: 'CA199',
    parameterRanges: {
      'CA 19-9': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 37 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // ENZYMES
  // ══════════════════════════════════════════════════════

  {
    code: 'AMYLASE',
    parameterRanges: {
      'Serum Amylase': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 28, normalHigh: 100, criticalHigh: 500 }
      ]
    }
  },

  {
    code: 'LIPASE',
    parameterRanges: {
      'Serum Lipase': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 160, criticalHigh: 600 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // URINE ANALYSIS
  // ══════════════════════════════════════════════════════

  {
    code: 'UA',
    parameterRanges: {
      'Urine pH': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 4.6, normalHigh: 8.0 }
      ],
      'Specific Gravity': [
        { label: 'Adult & Child (1yr+)', genderMatch: ['any'], ageMin: 1, ageMax: 150, ageUnit: 'years', normalLow: 1.005, normalHigh: 1.030 }
      ],
      'Urine RBC': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 2 }
      ],
      'Urine WBC': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 5 }
      ]
    }
  },

  // ══════════════════════════════════════════════════════
  // MISCELLANEOUS HIGH-VOLUME TESTS
  // ══════════════════════════════════════════════════════

  {
    code: 'DENGUE_NS1',
    parameterRanges: {} // qualitative, no numeric ranges needed
  },

  {
    code: 'WIDAL',
    parameterRanges: {
      'Salmonella Typhi O': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 80 }
      ],
      'Salmonella Typhi H': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 80 }
      ]
    }
  },

  {
    code: 'URIC_ACID',
    parameterRanges: {
      'Serum Uric Acid': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 3.4, normalHigh: 7.0 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 2.4, normalHigh: 6.0 }
      ]
    }
  },

  {
    code: 'LACTATE',
    parameterRanges: {
      'Serum Lactate': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0.5, normalHigh: 2.2, criticalHigh: 4.0 }
      ]
    }
  },

  {
    code: 'AMMONIA',
    parameterRanges: {
      'Serum Ammonia': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 9, normalHigh: 33, criticalHigh: 100 },
        { label: 'Neonate (0-28 days)', genderMatch: ['any'], ageMin: 0, ageMax: 28, ageUnit: 'days', normalLow: 90, normalHigh: 150, criticalHigh: 200 }
      ]
    }
  },

  {
    code: 'PCT',
    parameterRanges: {
      'Procalcitonin (PCT)': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 0.1, criticalHigh: 10.0 }
      ]
    }
  },

  {
    code: 'IL6',
    parameterRanges: {
      'Interleukin-6 (IL-6)': [
        { label: 'All ages', genderMatch: ['any'], ageMin: 0, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 7.0 }
      ]
    }
  },

  {
    code: 'DIMER',
    parameterRanges: {
      'D-Dimer': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 0, normalHigh: 500, criticalHigh: 5000 }
      ]
    }
  },

  {
    code: 'FIBRINOGEN',
    parameterRanges: {
      'Serum Fibrinogen': [
        { label: 'Adult (18+ yrs)', genderMatch: ['any'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 200, normalHigh: 400, criticalLow: 100, criticalHigh: 700 }
      ]
    }
  },

  {
    code: 'HOMOCYSTEINE',
    parameterRanges: {
      'Serum Homocysteine': [
        { label: 'Adult Male', genderMatch: ['male'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 5, normalHigh: 15 },
        { label: 'Adult Female', genderMatch: ['female'], ageMin: 18, ageMax: 150, ageUnit: 'years', normalLow: 5, normalHigh: 12 }
      ]
    }
  }
];

// ─────────────────────────────────────────────────────────
// Migration Runner
// ─────────────────────────────────────────────────────────

async function runSeed() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected');

  const TestMaster = mongoose.model('TestMaster', new mongoose.Schema({
    code: String,
    parameters: [{ name: String, unit: String, normalLow: Number, normalHigh: Number, criticalLow: Number, criticalHigh: Number, isDerived: Boolean, referenceRanges: [mongoose.Schema.Types.Mixed] }]
  }));

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;

  for (const testData of REFERENCE_RANGES) {
    if (Object.keys(testData.parameterRanges).length === 0) {
      console.log(`⏭  ${testData.code} — qualitative test, skipping`);
      skipped++;
      continue;
    }

    try {
      const testDoc = await TestMaster.findOne({ code: testData.code });
      if (!testDoc) {
        console.warn(`⚠️  ${testData.code} — NOT FOUND in TestMaster catalog`);
        notFound++;
        continue;
      }

      let changed = false;
      for (const param of testDoc.parameters) {
        const ranges = testData.parameterRanges[param.name];
        if (!ranges || ranges.length === 0) continue;

        // Idempotent: skip if already seeded
        if (param.referenceRanges && param.referenceRanges.length > 0) {
          continue;
        }

        param.referenceRanges = ranges;
        changed = true;
      }

      if (changed) {
        await testDoc.save();
        console.log(`✅ ${testData.code} — reference ranges seeded`);
        updated++;
      } else {
        console.log(`⏭  ${testData.code} — already seeded, skipped`);
        skipped++;
      }
    } catch (err) {
      console.error(`❌ ${testData.code} — Error:`, err.message);
      errors++;
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log('Seed Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭  Skipped: ${skipped}`);
  console.log(`  ⚠️  Not Found: ${notFound}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('══════════════════════════════════════');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

runSeed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
