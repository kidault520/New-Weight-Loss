# Health App Backend API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Health Check
```http
GET /api/status
```
Returns server status and timestamp.

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Logout User
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### User Profile

#### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

#### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "age": 25,
  "gender": "male",
  "height": 175,
  "target_weight": 70,
  "activity_level": "moderate"
}
```

### Health Records

#### Get Health Records
```http
GET /api/health/records?start_date=2024-01-01&end_date=2024-12-31&type=weight
Authorization: Bearer <token>
```

#### Add Health Record
```http
POST /api/health/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "record_type": "weight",
  "value": 70.5,
  "unit": "kg",
  "notes": "Morning weight",
  "recorded_at": "2024-01-01T08:00:00Z"
}
```

#### Update Health Record
```http
PUT /api/health/records/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": 71.0,
  "notes": "Updated weight"
}
```

#### Delete Health Record
```http
DELETE /api/health/records/{id}
Authorization: Bearer <token>
```

### AI Features

#### Chat with AI
```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "我想了解一些健康建议",
  "conversation_id": "optional-conversation-id"
}
```

#### Analyze Food Image
```http
POST /api/ai/analyze-food
Authorization: Bearer <token>
Content-Type: application/json

{
  "image_url": "https://example.com/food-image.jpg",
  "description": "Optional food description"
}
```

#### Get Emotion Statistics
```http
GET /api/ai/emotions/stats?start_date=2024-01-01&end_date=2024-12-31
Authorization: Bearer <token>
```

### Exercise Records

#### Get Exercise Records
```http
GET /api/exercise/records?start_date=2024-01-01&exercise_type=cardio
Authorization: Bearer <token>
```

#### Add Exercise Record
```http
POST /api/exercise/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "exercise_name": "跑步",
  "duration_minutes": 30,
  "calories_burned": 300,
  "exercise_type": "cardio",
  "intensity": "moderate",
  "notes": "晨跑"
}
```

#### Get Exercise Statistics
```http
GET /api/exercise/stats?period=week
Authorization: Bearer <token>
```

### Meal Plans

#### Get Meal Plans
```http
GET /api/mealplans
Authorization: Bearer <token>
```

#### Create Meal Plan
```http
POST /api/mealplans
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "减脂餐食计划",
  "description": "7天健康减脂餐",
  "duration_days": 7,
  "preferences": {
    "dietary_restrictions": ["vegetarian"],
    "allergies": ["nuts"]
  }
}
```

#### Activate Meal Plan
```http
PUT /api/mealplans/{id}/activate
Authorization: Bearer <token>
```

### Emotion Records

#### Get Emotion Records
```http
GET /api/emotions/records?start_date=2024-01-01&emotion=happy
Authorization: Bearer <token>
```

#### Add Emotion Record
```http
POST /api/emotions/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "emotion": "happy",
  "intensity": 0.8,
  "message": "今天心情很好！"
}
```

#### Get Emotion Statistics
```http
GET /api/emotions/stats?period=month
Authorization: Bearer <token>
```

#### Get Emotion Insights
```http
GET /api/emotions/insights
Authorization: Bearer <token>
```

## Error Responses

All endpoints return errors in the following format:
```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error