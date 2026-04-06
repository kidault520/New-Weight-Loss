const crypto = require('crypto');
const { toBeijingDateString } = require('./timezone');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Calculate BMI
const calculateBMI = (weight, height) => {
  if (!weight || !height) return null;
  const heightInMeters = height / 100;
  return parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
};

// Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
const calculateBMR = (weight, height, age, gender) => {
  if (!weight || !height || !age || !gender) return null;
  
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  
  return Math.round(bmr);
};

// Calculate daily calorie needs based on activity level
const calculateDailyCalories = (bmr, activityLevel) => {
  if (!bmr || !activityLevel) return null;
  
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  
  const multiplier = activityMultipliers[activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
};

// Format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return null;
  return toBeijingDateString(date);
};

// Get date range for period
const getDateRange = (period) => {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

// Calculate age from birth date
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

// Generate nutrition recommendations
const generateNutritionRecommendations = (userProfile, healthData) => {
  const recommendations = [];
  
  if (userProfile && healthData) {
    const { weight, height, age, gender, activity_level } = userProfile;
    
    if (weight && height && age && gender) {
      const bmr = calculateBMR(weight, height, age, gender);
      const dailyCalories = calculateDailyCalories(bmr, activity_level);
      
      recommendations.push({
        type: 'calories',
        message: `根据您的基础代谢率，建议每日摄入${dailyCalories}卡路里`,
        value: dailyCalories
      });
      
      // Protein recommendation (1.2-2.0g per kg body weight)
      const proteinMin = Math.round(weight * 1.2);
      const proteinMax = Math.round(weight * 2.0);
      recommendations.push({
        type: 'protein',
        message: `建议每日蛋白质摄入量：${proteinMin}-${proteinMax}克`,
        value: { min: proteinMin, max: proteinMax }
      });
      
      // Water recommendation (35ml per kg body weight)
      const waterRecommendation = Math.round(weight * 35);
      recommendations.push({
        type: 'water',
        message: `建议每日饮水量：${waterRecommendation}毫升`,
        value: waterRecommendation
      });
    }
  }
  
  return recommendations;
};

module.exports = {
  generateRandomString,
  calculateBMI,
  calculateBMR,
  calculateDailyCalories,
  formatDate,
  getDateRange,
  isValidEmail,
  sanitizeInput,
  calculateAge,
  generateNutritionRecommendations
};