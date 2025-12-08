import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RobotCommand {
  type: 'forward' | 'backward' | 'turn_left' | 'turn_right';
}

interface Position {
  x: number;
  y: number;
}

interface Direction {
  name: 'up' | 'right' | 'down' | 'left';
  rotation: number;
}

interface Challenge {
  id: number;
  name: string;
  description: string;
  startPos: Position;
  startDir: Direction;
  goalPos: Position;
  optimalMoves: number;
  maxMoves: number;
}

// Challenge definitions - server-side source of truth
const CHALLENGES: Record<string, Challenge[]> = {
  'intro-robotics-r-3': [
    {
      id: 1,
      name: 'First Steps',
      description: 'Move the robot forward 2 steps',
      startPos: { x: 0, y: 2 },
      startDir: { name: 'right', rotation: 90 },
      goalPos: { x: 2, y: 2 },
      optimalMoves: 2,
      maxMoves: 5,
    },
    {
      id: 2,
      name: 'Turn Around',
      description: 'Turn right and move forward',
      startPos: { x: 2, y: 0 },
      startDir: { name: 'down', rotation: 180 },
      goalPos: { x: 2, y: 2 },
      optimalMoves: 3,
      maxMoves: 6,
    },
    {
      id: 3,
      name: 'L-Shape Path',
      description: 'Navigate an L-shaped path',
      startPos: { x: 0, y: 0 },
      startDir: { name: 'right', rotation: 90 },
      goalPos: { x: 2, y: 2 },
      optimalMoves: 5,
      maxMoves: 10,
    },
  ],
};

const DIRECTIONS: Direction[] = [
  { name: 'up', rotation: 0 },
  { name: 'right', rotation: 90 },
  { name: 'down', rotation: 180 },
  { name: 'left', rotation: 270 },
];

function simulateRobot(
  commands: RobotCommand[],
  challenge: Challenge
): { success: boolean; finalPos: Position; path: Position[]; invalidMove?: string } {
  let pos = { ...challenge.startPos };
  let dirIndex = DIRECTIONS.findIndex((d) => d.name === challenge.startDir.name);
  const path: Position[] = [{ ...pos }];

  for (const cmd of commands) {
    if (cmd.type === 'turn_left') {
      dirIndex = (dirIndex - 1 + DIRECTIONS.length) % DIRECTIONS.length;
    } else if (cmd.type === 'turn_right') {
      dirIndex = (dirIndex + 1) % DIRECTIONS.length;
    } else if (cmd.type === 'forward') {
      const newPos = { ...pos };
      switch (DIRECTIONS[dirIndex].name) {
        case 'up':
          newPos.y -= 1;
          break;
        case 'down':
          newPos.y += 1;
          break;
        case 'left':
          newPos.x -= 1;
          break;
        case 'right':
          newPos.x += 1;
          break;
      }
      // Check bounds (5x5 grid)
      if (newPos.x < 0 || newPos.x > 4 || newPos.y < 0 || newPos.y > 4) {
        return {
          success: false,
          finalPos: pos,
          path,
          invalidMove: 'Robot moved out of bounds!',
        };
      }
      pos = newPos;
      path.push({ ...pos });
    } else if (cmd.type === 'backward') {
      const newPos = { ...pos };
      switch (DIRECTIONS[dirIndex].name) {
        case 'up':
          newPos.y += 1;
          break;
        case 'down':
          newPos.y -= 1;
          break;
        case 'left':
          newPos.x += 1;
          break;
        case 'right':
          newPos.x -= 1;
          break;
      }
      if (newPos.x < 0 || newPos.x > 4 || newPos.y < 0 || newPos.y > 4) {
        return {
          success: false,
          finalPos: pos,
          path,
          invalidMove: 'Robot moved out of bounds!',
        };
      }
      pos = newPos;
      path.push({ ...pos });
    }
  }

  const success = pos.x === challenge.goalPos.x && pos.y === challenge.goalPos.y;
  return { success, finalPos: pos, path };
}

function calculateStars(commands: RobotCommand[], challenge: Challenge): number {
  const moveCount = commands.length;
  if (moveCount <= challenge.optimalMoves) return 3;
  if (moveCount <= challenge.optimalMoves + 2) return 2;
  return 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from auth
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { module_id, challenge_id, commands } = await req.json();

    if (!module_id || challenge_id === undefined || !commands) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: module_id, challenge_id, commands' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get challenge definition
    const challenges = CHALLENGES[module_id];
    if (!challenges) {
      return new Response(JSON.stringify({ error: 'Invalid module_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const challenge = challenges.find((c) => c.id === challenge_id);
    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Invalid challenge_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate commands array
    if (!Array.isArray(commands) || commands.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Commands must be a non-empty array',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (commands.length > challenge.maxMoves) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Too many moves! Maximum allowed: ${challenge.maxMoves}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Simulate robot movement
    const result = simulateRobot(commands, challenge);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          feedback: result.invalidMove || `Goal not reached. Try again!`,
          finalPos: result.finalPos,
          goalPos: challenge.goalPos,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate stars
    const stars = calculateStars(commands, challenge);

    // Save progress to database
    const { error: insertError } = await supabaseClient.from('robotics_progress').upsert(
      {
        user_id: user.id,
        module_id,
        challenge_id,
        stars_earned: stars,
        completed: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,module_id,challenge_id',
      }
    );

    if (insertError) {
      console.error('Database error:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Failed to save progress',
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate feedback
    let feedback = '🎉 Success! ';
    if (stars === 3) {
      feedback += 'Perfect solution! ⭐⭐⭐';
    } else if (stars === 2) {
      feedback += 'Great job! Can you do it in fewer moves? ⭐⭐';
    } else {
      feedback += 'You did it! Try optimizing your solution. ⭐';
    }

    return new Response(
      JSON.stringify({
        success: true,
        stars_earned: stars,
        feedback,
        optimal_moves: challenge.optimalMoves,
        your_moves: commands.length,
        finalPos: result.finalPos,
        goalPos: challenge.goalPos,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
