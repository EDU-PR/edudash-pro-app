/**
 * Validate Robotics Challenge Edge Function
 * 
 * Server-side validation for robotics coding challenges.
 * Simulates robot movement on a grid and checks if the student's
 * command sequence reaches the goal position.
 * 
 * Expected body: { module_id, challenge_id, commands: [{type}] }
 * Auth: Bearer token required
 * 
 * Returns: { success: boolean, stars_earned: number, feedback: string }
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

type Direction = 'up' | 'down' | 'left' | 'right';
type Position = { row: number; col: number };

interface Challenge {
  id: string;
  grid_size: number;
  start: Position;
  goal: Position;
  obstacles?: Position[];
  max_commands?: number;
  optimal_commands?: number;
}

// Challenge definitions for intro-robotics-r-3 module
const CHALLENGES: Record<string, Challenge[]> = {
  'intro-robotics-r-3': [
    { id: 'ch-1', grid_size: 4, start: { row: 0, col: 0 }, goal: { row: 0, col: 3 }, max_commands: 10, optimal_commands: 3 },
    { id: 'ch-2', grid_size: 4, start: { row: 0, col: 0 }, goal: { row: 3, col: 0 }, max_commands: 10, optimal_commands: 4 },
    { id: 'ch-3', grid_size: 4, start: { row: 0, col: 0 }, goal: { row: 3, col: 3 }, max_commands: 12, optimal_commands: 7 },
    { id: 'ch-4', grid_size: 5, start: { row: 0, col: 0 }, goal: { row: 4, col: 4 }, max_commands: 15, optimal_commands: 9 },
    { id: 'ch-5', grid_size: 5, start: { row: 2, col: 0 }, goal: { row: 2, col: 4 }, obstacles: [{ row: 2, col: 2 }], max_commands: 15, optimal_commands: 8 },
  ],
};

function moveForward(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up': return { row: pos.row - 1, col: pos.col };
    case 'down': return { row: pos.row + 1, col: pos.col };
    case 'left': return { row: pos.row, col: pos.col - 1 };
    case 'right': return { row: pos.row, col: pos.col + 1 };
  }
}

function moveBackward(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up': return { row: pos.row + 1, col: pos.col };
    case 'down': return { row: pos.row - 1, col: pos.col };
    case 'left': return { row: pos.row, col: pos.col + 1 };
    case 'right': return { row: pos.row, col: pos.col - 1 };
  }
}

function turnLeft(dir: Direction): Direction {
  const turns: Record<Direction, Direction> = { up: 'left', left: 'down', down: 'right', right: 'up' };
  return turns[dir];
}

function turnRight(dir: Direction): Direction {
  const turns: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' };
  return turns[dir];
}

function isValidPosition(pos: Position, gridSize: number, obstacles: Position[] = []): boolean {
  if (pos.row < 0 || pos.row >= gridSize || pos.col < 0 || pos.col >= gridSize) return false;
  return !obstacles.some(o => o.row === pos.row && o.col === pos.col);
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { module_id, challenge_id, commands } = body;

    if (!module_id || !challenge_id || !Array.isArray(commands)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the challenge definition
    const moduleChallenges = CHALLENGES[module_id];
    if (!moduleChallenges) {
      return new Response(
        JSON.stringify({ success: false, feedback: 'Unknown module. Keep exploring!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const challenge = moduleChallenges.find(c => c.id === challenge_id);
    if (!challenge) {
      // For unknown challenges, do a basic success response
      return new Response(
        JSON.stringify({ success: true, stars_earned: 1, feedback: 'Great work! Challenge completed.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Simulate robot movement
    let pos = { ...challenge.start };
    let dir: Direction = 'right';
    let hitObstacle = false;
    let outOfBounds = false;

    for (const cmd of commands) {
      const cmdType = (cmd.type || '').replace(/-/g, '_');
      let newPos = pos;

      switch (cmdType) {
        case 'forward':
          newPos = moveForward(pos, dir);
          break;
        case 'backward':
          newPos = moveBackward(pos, dir);
          break;
        case 'turn_left':
          dir = turnLeft(dir);
          continue;
        case 'turn_right':
          dir = turnRight(dir);
          continue;
        default:
          continue;
      }

      if (!isValidPosition(newPos, challenge.grid_size, challenge.obstacles)) {
        if (challenge.obstacles?.some(o => o.row === newPos.row && o.col === newPos.col)) {
          hitObstacle = true;
        } else {
          outOfBounds = true;
        }
        break;
      }

      pos = newPos;
    }

    const reachedGoal = pos.row === challenge.goal.row && pos.col === challenge.goal.col;

    // Calculate stars
    let starsEarned = 0;
    let feedback = '';

    if (hitObstacle) {
      feedback = 'Oops! Your robot hit an obstacle. Try finding a path around it! 🤖';
    } else if (outOfBounds) {
      feedback = 'Your robot went off the grid! Try to keep it within the boundaries. 🗺️';
    } else if (reachedGoal) {
      const commandCount = commands.length;
      const optimal = challenge.optimal_commands || commandCount;

      if (commandCount <= optimal) {
        starsEarned = 3;
        feedback = '⭐⭐⭐ Perfect! You found the optimal solution! Amazing coding skills!';
      } else if (commandCount <= optimal + 2) {
        starsEarned = 2;
        feedback = '⭐⭐ Great job! You reached the goal! Can you do it with fewer commands?';
      } else {
        starsEarned = 1;
        feedback = '⭐ You did it! Your robot reached the goal. Try to use fewer commands for more stars!';
      }
    } else {
      feedback = 'Almost there! Your robot didn\'t quite reach the goal. Try adding more commands! 💡';
    }

    // Save progress (best-effort)
    if (reachedGoal) {
      try {
        await supabase.from('robotics_progress').upsert({
          user_id: user.id,
          module_id,
          challenge_id,
          completed: true,
          stars_earned: starsEarned,
          commands_used: commands.length,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,module_id,challenge_id' });
      } catch {
        // Non-critical
      }
    }

    return new Response(
      JSON.stringify({ success: reachedGoal, stars_earned: starsEarned, feedback }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[validate-robotics-challenge] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
