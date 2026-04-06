const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User profile validation
const validateUserProfile = [
  body('name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('age').optional().isInt({ min: 1, max: 150 }),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('height').optional().isFloat({ min: 50, max: 300 }),
  body('target_weight').optional().isFloat({ min: 20, max: 500 }),
  body('activity_level').optional().isIn(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  validate
];

// Health record validation
const validateHealthRecord = [
  body('record_type').isIn(['weight', 'water', 'steps', 'food', 'exercise', 'measurements', 'calories']),
  body('value').isNumeric(),
  body('unit').optional().isLength({ max: 20 }),
  body('notes').optional().isLength({ max: 500 }),
  body('recorded_at').optional().isISO8601(),
  validate
];

// Exercise record validation
const validateExerciseRecord = [
  body('exercise_name').isLength({ min: 1, max: 100 }).trim(),
  body('duration_minutes').isInt({ min: 1, max: 1440 }),
  body('calories_burned').optional().isFloat({ min: 0 }),
  body('exercise_type').optional().isIn(['cardio', 'strength', 'flexibility', 'sports', 'other']),
  body('intensity').optional().isIn(['low', 'moderate', 'high']),
  body('notes').optional().isLength({ max: 500 }),
  validate
];

// Emotion record validation
const validateEmotionRecord = [
  body('emotion').isIn(['happy', 'sad', 'angry', 'worried', 'tired', 'excited', 'neutral']),
  body('intensity').optional().isFloat({ min: 0, max: 1 }),
  body('message').optional().isLength({ max: 500 }),
  validate
];

// Meal plan validation
const validateMealPlan = [
  body('name').isLength({ min: 1, max: 100 }).trim(),
  body('description').optional().isLength({ max: 500 }),
  body('duration_days').optional().isInt({ min: 1, max: 365 }),
  validate
];

// Auth validation
const validateAuth = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }),
  body('name').optional().isLength({ min: 1, max: 100 }).trim(),
  validate
];

module.exports = {
  validate,
  validateUserProfile,
  validateHealthRecord,
  validateExerciseRecord,
  validateEmotionRecord,
  validateMealPlan,
  validateAuth
};