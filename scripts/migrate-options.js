/**
 * migrate-options.js
 *
 * One-time migration: adds the `options` array to all existing TestMaster
 * documents in the production database for parameters that have unit === 'status'.
 *
 * SAFE TO RUN MULTIPLE TIMES — uses $set with the specific options map only.
 * Does NOT touch other fields.
 *
 * Run: node scripts/migrate-options.js
 * (from the pehlix-app directory, after setting MONGODB_URI in .env)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import TestMaster from '../src/modules/staff/testMaster.model.js';

// Map of parameter name → options array
// These are the medically correct discrete options for categorical tests
const OPTIONS_MAP = {
  'HBsAg':                   ['Reactive', 'Non-Reactive'],
  'HCV Antibody':             ['Reactive', 'Non-Reactive'],
  'HIV 1 & 2':               ['Reactive', 'Non-Reactive'],
  'VDRL Slide Test':          ['Reactive', 'Non-Reactive'],
  'Dengue NS1 Antigen':       ['Positive', 'Negative'],
  'Dengue IgM':               ['Positive', 'Negative'],
  'Dengue IgG':               ['Positive', 'Negative'],
  'Pregnancy Test':           ['Positive', 'Negative'],
  'Sugar (Urine)':            ['Nil', 'Trace', '+1', '+2', '+3', '+4'],
  'Protein (Urine)':          ['Nil', 'Trace', '+1', '+2', '+3'],
  'G6PD Activity Qualitative Screen': ['Deficient', 'Intermediate', 'Normal'],
  'Hb Electrophoresis (Hemoglobin Typing)': ['Normal HbAA', 'HbAS (Sickle Trait)', 'HbSS (Sickle Disease)', 'HbSC', 'HbAC', 'HbC Trait', 'Other Hemoglobinopathy'],
  'Coombs Test Direct (DAT)':     ['Positive', 'Negative', 'Weakly Positive'],
  'Coombs Test Indirect (IAT)':   ['Positive', 'Negative', 'Weakly Positive'],
  'Sickling Test (HbS Screening)': ['Positive', 'Negative'],
  'Typhoid IgM Antibody Rapid':   ['Positive', 'Negative'],
  'Typhoid IgG Antibody Rapid':   ['Positive', 'Negative'],
  'Leptospira IgM Antibody ELISA': ['Reactive', 'Non-Reactive'],
  'Scrub Typhus IgM Antibody ELISA': ['Reactive', 'Non-Reactive'],
  'Brucella Antibody Slide Agglutination': ['Positive', 'Negative'],
  'Chikungunya IgM Antibody ELISA': ['Reactive', 'Non-Reactive'],
  'Stool Routine and Microscopic': ['Normal', 'Abnormal'],
  'Stool Occult Blood (FOBT)':    ['Positive', 'Negative'],
  'Stool Reducing Substances':    ['Positive', 'Negative'],
  'Sputum AFB Smear Stain':       ['No AFB Seen', 'Scanty (1-9 AFB/100 HPF)', '1+ (10-99 AFB/100 HPF)', '2+ (1-10 AFB/HPF)', '3+ (>10 AFB/HPF)'],
  'Gram Stain Smear Examination': ['Gram Positive Cocci', 'Gram Negative Cocci', 'Gram Positive Bacilli', 'Gram Negative Bacilli', 'Mixed Flora', 'No Organisms Seen'],
  'KOH Mount for Fungal Hyphae':  ['Fungal Hyphae Seen', 'Yeast Cells Seen', 'No Fungal Elements Seen'],
  'HBeAg (Hepatitis B e Antigen)': ['Reactive', 'Non-Reactive'],
  'Anti-HBe Antibody':            ['Reactive', 'Non-Reactive'],
  'Anti-HBc IgM Antibody':        ['Reactive', 'Non-Reactive'],
  'Anti-HBc Total Antibody':      ['Reactive', 'Non-Reactive'],
  'TPHA (Treponema Pallidum Hemagglutination)': ['Positive', 'Negative'],
  'VDRL/RPR Screen Card Test':    ['Reactive', 'Non-Reactive'],
};

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  let updatedDocs = 0;
  let updatedParams = 0;

  const paramNames = Object.keys(OPTIONS_MAP);

  // Find all TestMaster docs that have at least one matching parameter name
  const tests = await TestMaster.find({
    'parameters.name': { $in: paramNames }
  });

  console.log(`Found ${tests.length} TestMaster documents to update`);

  for (const test of tests) {
    let modified = false;

    for (const param of test.parameters) {
      const options = OPTIONS_MAP[param.name];
      if (options && (!param.options || param.options.length === 0)) {
        param.options = options;
        modified = true;
        updatedParams++;
      }
    }

    if (modified) {
      await test.save();
      updatedDocs++;
      console.log(`  ✅ Updated: ${test.name} (${test.code})`);
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Updated ${updatedDocs} TestMaster documents`);
  console.log(`   Added options to ${updatedParams} parameters`);
  
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
