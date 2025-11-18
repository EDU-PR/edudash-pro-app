# Robotics Challenge Validation Edge Function

## Purpose
Server-side validation for interactive robotics challenges. Prevents client-side manipulation and ensures consistent scoring.

## Endpoint
`POST /functions/v1/validate-robotics-challenge`

## Authentication
Requires valid Supabase auth token in `Authorization` header.

## Request Body
```json
{
  "module_id": "intro-robotics-r-3",
  "challenge_id": 1,
  "commands": [
    { "type": "forward" },
    { "type": "forward" },
    { "type": "turn_right" }
  ]
}
```

## Command Types
- `forward` - Move forward one step
- `backward` - Move backward one step
- `turn_left` - Rotate 90° counter-clockwise
- `turn_right` - Rotate 90° clockwise

## Response (Success)
```json
{
  "success": true,
  "stars_earned": 3,
  "feedback": "🎉 Success! Perfect solution! ⭐⭐⭐",
  "optimal_moves": 2,
  "your_moves": 2,
  "finalPos": { "x": 2, "y": 2 },
  "goalPos": { "x": 2, "y": 2 }
}
```

## Response (Failure)
```json
{
  "success": false,
  "feedback": "Goal not reached. Try again!",
  "finalPos": { "x": 1, "y": 2 },
  "goalPos": { "x": 2, "y": 2 }
}
```

## Star Calculation
- **3 stars**: Optimal solution (≤ optimal_moves)
- **2 stars**: Good solution (optimal_moves + 1-2)
- **1 star**: Working solution (within maxMoves)

## Modules & Challenges

### intro-robotics-r-3 (Ages R-3)
1. **First Steps** - Move forward 2 steps (optimal: 2, max: 5)
2. **Turn Around** - Turn right and move (optimal: 3, max: 6)
3. **L-Shape Path** - Navigate L-shape (optimal: 5, max: 10)

## Security Features
- Server-side simulation (tamper-proof)
- Grid bounds validation (5x5)
- Move count limits per challenge
- RLS policies on robotics_progress table
- Progress saved only on server validation

## Database Integration
Auto-saves to `robotics_progress` table:
```sql
{
  user_id: uuid,
  module_id: text,
  challenge_id: integer,
  stars_earned: integer,
  completed: boolean,
  updated_at: timestamp
}
```

## Adding New Challenges
1. Add challenge definition to `CHALLENGES` object in `index.ts`
2. Update this README with challenge details
3. Create corresponding frontend UI
4. Redeploy function: `supabase functions deploy validate-robotics-challenge`

## Future Modules
- Block Coding Adventures (4-6) - Blockly integration
- Robot Sensors & Logic (Premium)
- AI-Powered Robotics (Premium)
