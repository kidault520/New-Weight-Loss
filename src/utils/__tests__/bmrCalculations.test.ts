/**
 * bmrCalculations 测试
 * 测试BMR、BMI等健康计算工具函数
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateBMI,
  getBMICategory,
  calculateStepsCalories,
  calculateWalkingCalories,
  kgToLbs,
  lbsToKg,
  cmToFeetInches,
  feetInchesToCm,
  calculateAge,
} from '../bmrCalculations';

describe('bmrCalculations', () => {
  describe('calculateBMR', () => {
    it('should calculate BMR for male correctly', () => {
      const profile = {
        gender: 'male' as const,
        age: 30,
        current_weight: 70,
        height: 175,
      };
      // BMR = (10 * 70) + (6.25 * 175) - (5 * 30) + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
      const bmr = calculateBMR(profile);
      expect(bmr).toBe(1649); // rounded
    });

    it('should calculate BMR for female correctly', () => {
      const profile = {
        gender: 'female' as const,
        age: 25,
        current_weight: 60,
        height: 165,
      };
      // BMR = (10 * 60) + (6.25 * 165) - (5 * 25) - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
      const bmr = calculateBMR(profile);
      expect(bmr).toBe(1345); // rounded
    });

    it('should return default BMR when required fields are missing', () => {
      const profile = {
        gender: 'male' as const,
        age: undefined as any,
        current_weight: 70,
        height: 175,
      };
      const bmr = calculateBMR(profile);
      expect(bmr).toBe(1500); // default
    });

    it('should handle edge cases', () => {
      const profile = {
        gender: 'male' as const,
        age: 18,
        current_weight: 50,
        height: 160,
      };
      const bmr = calculateBMR(profile);
      expect(bmr).toBeGreaterThan(0);
      expect(typeof bmr).toBe('number');
    });
  });

  describe('calculateBMI', () => {
    it('should calculate BMI correctly', () => {
      // BMI = weight(kg) / height(m)^2
      // 70kg, 175cm = 70 / (1.75^2) = 70 / 3.0625 = 22.86
      const bmi = calculateBMI(70, 175);
      expect(bmi).toBe(22.9);
    });

    it('should handle different weight and height combinations', () => {
      expect(calculateBMI(60, 165)).toBe(22.0);
      expect(calculateBMI(80, 180)).toBe(24.7);
      expect(calculateBMI(50, 160)).toBe(19.5);
    });

    it('should return a number with one decimal place', () => {
      const bmi = calculateBMI(70, 175);
      const decimalPlaces = (bmi.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('getBMICategory', () => {
    it('should return correct category for underweight', () => {
      expect(getBMICategory(18.0)).toBe('偏瘦');
      expect(getBMICategory(17.5)).toBe('偏瘦');
    });

    it('should return correct category for normal weight', () => {
      expect(getBMICategory(20.0)).toBe('正常');
      expect(getBMICategory(23.5)).toBe('正常');
    });

    it('should return correct category for overweight', () => {
      expect(getBMICategory(25.0)).toBe('偏胖');
      expect(getBMICategory(27.0)).toBe('偏胖');
    });

    it('should return correct category for obese', () => {
      expect(getBMICategory(28.0)).toBe('肥胖');
      expect(getBMICategory(30.0)).toBe('肥胖');
    });
  });

  describe('calculateStepsCalories', () => {
    it('should calculate calories from steps correctly', () => {
      // weight * distance(km)
      // 10000 steps * 0.78m stride = 7.8km
      // 70kg * 7.8km = 546 calories
      const calories = calculateStepsCalories(70, 10000);
      expect(calories).toBe(546);
    });

    it('should use custom stride length', () => {
      const calories = calculateStepsCalories(70, 10000, 0.8);
      expect(calories).toBeGreaterThan(0);
    });
  });

  describe('calculateWalkingCalories', () => {
    it('should calculate walking calories correctly', () => {
      // weight * distance
      const calories = calculateWalkingCalories(70, 5);
      expect(calories).toBe(350);
    });
  });

  describe('kgToLbs', () => {
    it('should convert kg to lbs correctly', () => {
      expect(kgToLbs(70)).toBe(154.3);
      expect(kgToLbs(60)).toBe(132.3);
    });

    it('should return a number with one decimal place', () => {
      const lbs = kgToLbs(70);
      const decimalPlaces = (lbs.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('lbsToKg', () => {
    it('should convert lbs to kg correctly', () => {
      expect(lbsToKg(154.3)).toBe(70.0);
      expect(lbsToKg(132.3)).toBe(60.0);
    });

    it('should return a number with one decimal place', () => {
      const kg = lbsToKg(154.3);
      const decimalPlaces = (kg.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('cmToFeetInches', () => {
    it('should convert cm to feet and inches correctly', () => {
      // 175cm = 5 feet 8.9 inches ≈ 5 feet 9 inches
      const result = cmToFeetInches(175);
      expect(result.feet).toBe(5);
      expect(result.inches).toBe(9);
    });

    it('should handle different heights', () => {
      const result1 = cmToFeetInches(165);
      expect(result1.feet).toBeGreaterThan(0);
      expect(result1.inches).toBeGreaterThanOrEqual(0);
      expect(result1.inches).toBeLessThan(12);
    });
  });

  describe('feetInchesToCm', () => {
    it('should convert feet and inches to cm correctly', () => {
      // 5 feet 9 inches = 175.26cm ≈ 175.3cm
      const cm = feetInchesToCm(5, 9);
      expect(cm).toBe(175.3);
    });
  });

  describe('calculateAge', () => {
    it('should calculate age correctly from Date', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate);
      expect(age).toBe(30);
    });

    it('should calculate age correctly from string', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 25;
      const birthDateString = `${birthYear}-01-01`;
      const age = calculateAge(birthDateString);
      expect(age).toBe(25);
    });

    it('should handle birthday not yet occurred this year', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 30, today.getMonth() + 1, today.getDate());
      const age = calculateAge(birthDate);
      expect(age).toBe(29); // birthday hasn't occurred yet this year
    });
  });
});




















