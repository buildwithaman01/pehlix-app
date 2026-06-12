import { ResultService } from '../result.service.js';

describe('ResultService - Core Business Logic', () => {

  describe('selectReferenceRange', () => {
    const paramMasterDoc = {
      name: 'Hemoglobin',
      normalLow: 12.0,
      normalHigh: 15.0,
      criticalLow: 7.0,
      criticalHigh: 20.0,
      referenceRanges: [
        {
          ageMin: 0, ageMax: 18, ageUnit: 'years',
          genderMatch: ['male', 'female'],
          normalLow: 11.5, normalHigh: 14.5,
          label: 'Pediatric'
        },
        {
          ageMin: 19, ageMax: 150, ageUnit: 'years',
          genderMatch: ['male'],
          normalLow: 13.8, normalHigh: 17.2,
          label: 'Adult Male'
        },
        {
          ageMin: 19, ageMax: 150, ageUnit: 'years',
          genderMatch: ['female'],
          normalLow: 12.1, normalHigh: 15.1,
          label: 'Adult Female'
        }
      ]
    };

    it('should select Adult Male range for 30-year-old male', () => {
      const range = ResultService.selectReferenceRange(paramMasterDoc, 30, 'years', 'male');
      expect(range.label).toBe('Adult Male');
      expect(range.normalLow).toBe(13.8);
      expect(range.normalHigh).toBe(17.2);
    });

    it('should select Adult Female range for 25-year-old female', () => {
      const range = ResultService.selectReferenceRange(paramMasterDoc, 25, 'years', 'female');
      expect(range.label).toBe('Adult Female');
      expect(range.normalLow).toBe(12.1);
    });

    it('should select Pediatric range for 10-year-old child', () => {
      const range = ResultService.selectReferenceRange(paramMasterDoc, 10, 'years', 'male');
      expect(range.label).toBe('Pediatric');
      expect(range.normalLow).toBe(11.5);
    });

    it('should fall back to default if no reference ranges match', () => {
      const emptyParamMasterDoc = {
        normalLow: 10,
        normalHigh: 20,
        referenceRanges: []
      };
      const range = ResultService.selectReferenceRange(emptyParamMasterDoc, 30, 'years', 'male');
      expect(range.label).toBe('Standard');
      expect(range.normalLow).toBe(10);
    });
  });

  describe('calculateDerivedValues', () => {
    const testMasterDoc = {
      derivedFormulas: [
        {
          targetParameter: 'MCH',
          formula: 'MCV * MCHC / 100',
          inputs: ['MCV', 'MCHC']
        }
      ]
    };

    it('should correctly calculate MCH from MCV and MCHC', async () => {
      const parameters = [
        { parameterName: 'MCV', value: '85' },
        { parameterName: 'MCHC', value: '33' }
      ];

      const result = await ResultService.calculateDerivedValues(parameters, testMasterDoc);
      
      const mchParam = result.find(p => p.parameterName === 'MCH');
      expect(mchParam).toBeDefined();
      expect(mchParam.isDerived).toBe(true);
      // 85 * 33 / 100 = 28.05
      expect(mchParam.value).toBe(28.05);
    });

    it('should not calculate if inputs are missing', async () => {
      const parameters = [
        { parameterName: 'MCV', value: '85' }
        // Missing MCHC
      ];

      const result = await ResultService.calculateDerivedValues(parameters, testMasterDoc);
      
      const mchParam = result.find(p => p.parameterName === 'MCH');
      expect(mchParam).toBeUndefined();
    });
  });

});
