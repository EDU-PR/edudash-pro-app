/**
 * Seed Rich Preschool Lessons
 * 
 * This script creates comprehensive, interactive preschool lessons
 * with proper activities and learning content.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Young Eagles preschool
const PRESCHOOL_ID = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
const TEACHER_ID = 'a1fd12d2-5f09-4a23-822d-f3071bfc544b'; // Valid teacher from existing lessons

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Define rich preschool lessons
const richLessons = [
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    title: '🅰️ Vowel Sounds Safari',
    subject: 'literacy',
    description: 'An exciting safari adventure discovering the 5 vowels (A, E, I, O, U) through animal sounds, songs, and interactive games. Perfect for early literacy development.',
    short_description: 'Learn vowels A, E, I, O, U with fun animal friends!',
    content: {
      overview: 'Join Dash on a vowel safari! Children learn to recognize and pronounce the 5 vowels through animal encounters.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'The Vowel Song',
          instructions: 'Sing: A-E-I-O-U, these are vowels yes its true! Each vowel makes a special sound, lets explore and look around!',
          teacher_script: 'Today we are going on a special safari to meet 5 very important letters called VOWELS!'
        },
        {
          phase: 'exploration',
          duration: '15 minutes',
          title: 'Animal Vowel Friends',
          activities: [
            { vowel: 'A', animal: 'Alligator', sound: 'Short A as in apple', action: 'Open mouth wide like an alligator and say Aaaa!' },
            { vowel: 'E', animal: 'Elephant', sound: 'Short E as in egg', action: 'Swing trunk like elephant and say Eh-Eh-Eh!' },
            { vowel: 'I', animal: 'Iguana', sound: 'Short I as in igloo', action: 'Stick out tongue like iguana and say Ih-Ih-Ih!' },
            { vowel: 'O', animal: 'Octopus', sound: 'Short O as in octagon', action: 'Wave 8 arms like octopus and say Oh-Oh-Oh!' },
            { vowel: 'U', animal: 'Umbrella Bird', sound: 'Short U as in umbrella', action: 'Hold hands over head like umbrella and say Uh-Uh-Uh!' }
          ]
        },
        {
          phase: 'practice',
          duration: '10 minutes',
          title: 'Vowel Hunt Game',
          instructions: 'Hide letter cards around the room. Children find vowels and sort them into the vowel basket.'
        },
        {
          phase: 'assessment',
          duration: '5 minutes',
          title: 'Vowel Bingo',
          instructions: 'Call out vowel sounds and words. Children cover the matching vowel on their bingo card.'
        }
      ],
      interactive_activities: [
        { name: 'Vowel Matching', type: 'drag_and_drop', description: 'Match each vowel to its animal friend' },
        { name: 'Sound Sort', type: 'sorting', description: 'Sort pictures by their beginning vowel sound' },
        { name: 'Missing Vowel', type: 'fill_in', description: 'Fill in the missing vowel: C_T, D_G, P_N' }
      ],
      differentiation: {
        support: 'Focus on just 2-3 vowels, use more visual cues',
        extension: 'Introduce long vowel sounds, find vowels in children\'s names'
      }
    },
    age_group: '3-6',
    duration_minutes: 35,
    objectives: ['Identify all 5 vowels (A, E, I, O, U)', 'Produce short vowel sounds', 'Distinguish vowels from consonants', 'Recognize vowels in simple words'],
    materials_needed: ['Vowel flashcards', 'Animal puppets or pictures', 'Letter sorting baskets', 'Vowel bingo cards', 'Safari explorer hats (optional)'],
    difficulty_level: 'beginner'
  },
  {
    id: 'd4e5f6a7-b8c9-0123-defa-456789012345',
    title: '🎨 Color Matching Magic',
    subject: 'art',
    description: 'A magical journey through the world of colors! Children learn to identify, match, and mix primary and secondary colors through hands-on activities and creative play.',
    short_description: 'Match, mix, and explore beautiful colors!',
    content: {
      overview: 'Become a Color Wizard! Learn to identify colors, match objects, and discover how colors mix together.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'Color Rainbow Song',
          instructions: 'Sing the rainbow colors song together while holding up colored scarves or ribbons.',
          teacher_script: 'Today we will become Color Wizards! We will learn about colors and do magical color mixing!'
        },
        {
          phase: 'exploration',
          duration: '15 minutes',
          title: 'Primary Colors Discovery',
          activities: [
            { color: 'Red', items: ['apple', 'fire truck', 'strawberry'], feeling: 'warm and exciting' },
            { color: 'Blue', items: ['sky', 'ocean', 'blueberries'], feeling: 'calm and peaceful' },
            { color: 'Yellow', items: ['sun', 'banana', 'lemon'], feeling: 'bright and happy' }
          ]
        },
        {
          phase: 'experiment',
          duration: '10 minutes',
          title: 'Color Mixing Magic',
          instructions: 'Use paint or colored water to show: Red + Yellow = Orange, Blue + Yellow = Green, Red + Blue = Purple',
          safety: 'Use washable paints and cover surfaces'
        },
        {
          phase: 'game',
          duration: '10 minutes',
          title: 'Color Hunt & Match',
          instructions: 'Children find objects around the room and place them on matching colored mats'
        }
      ],
      interactive_activities: [
        { name: 'Color Matching', type: 'drag_and_drop', description: 'Drag objects to the matching color basket' },
        { name: 'Color Mixing Lab', type: 'interactive', description: 'Mix two colors to make a new one' },
        { name: 'Rainbow Builder', type: 'sequencing', description: 'Put rainbow colors in the correct order' },
        { name: 'Color Memory', type: 'memory_game', description: 'Match pairs of colored cards' }
      ],
      songs: [
        { title: 'Rainbow Colors', lyrics: 'Red, orange, yellow, green, blue, purple too! These are rainbow colors, how about you?' },
        { title: 'Mix Mix Mix', lyrics: 'Red and yellow, mix mix mix, what do we get? Orange! Orange! Thats what we get!' }
      ]
    },
    age_group: '3-6',
    duration_minutes: 40,
    objectives: ['Identify primary colors (red, blue, yellow)', 'Match objects to colors', 'Understand basic color mixing', 'Name secondary colors (orange, green, purple)'],
    materials_needed: ['Colored paper or mats', 'Washable paints', 'Color sorting objects', 'Rainbow scarves', 'Mixing cups'],
    difficulty_level: 'beginner'
  },
  {
    id: 'e5f6a7b8-c9d0-1234-efab-567890123456',
    title: '🔢 Number Recognition 1-10',
    subject: 'mathematics',
    description: 'An engaging journey through numbers 1 to 10! Children learn to recognize numerals, count objects, and understand quantity through hands-on activities and games.',
    short_description: 'Learn to recognize and count numbers 1 to 10!',
    content: {
      overview: 'Count along with Dash! Learn to recognize numbers 1-10 and understand what each number means.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'Counting Song',
          instructions: 'Sing: 1-2-3-4-5, once I caught a fish alive! 6-7-8-9-10, then I let it go again!',
          actions: 'Hold up fingers while counting, act out catching and releasing fish'
        },
        {
          phase: 'number_intro',
          duration: '15 minutes',
          title: 'Meet the Numbers',
          numbers: [
            { num: 1, rhyme: 'Number 1 is like a stick, standing tall and very quick!', action: 'Stand straight like a stick' },
            { num: 2, rhyme: 'Number 2 is like a swan, gliding on the water pond!', action: 'Make swan neck with arm' },
            { num: 3, rhyme: 'Number 3 has bumps galore, 1-2-3, lets count some more!', action: 'Trace 3 bumps in air' },
            { num: 4, rhyme: 'Number 4 stands like a chair, with a seat up in the air!', action: 'Make L shape with arm' },
            { num: 5, rhyme: 'Number 5 gives high fives, just like our hands are alive!', action: 'High five!' },
            { num: 6, rhyme: 'Number 6 curls like a snail, with a loop thats like a tail!', action: 'Curl body' },
            { num: 7, rhyme: 'Number 7 has a hat, sitting on a line so flat!', action: 'Pat head' },
            { num: 8, rhyme: 'Number 8 is two circles stacked, like a snowman front and back!', action: 'Make two circles' },
            { num: 9, rhyme: 'Number 9 has one balloon, flying up to meet the moon!', action: 'Float like balloon' },
            { num: 10, rhyme: 'Number 10 is 1 and 0, the biggest number here we know!', action: 'Make big arms' }
          ]
        },
        {
          phase: 'counting_practice',
          duration: '10 minutes',
          title: 'Count and Match',
          instructions: 'Give children sets of objects. They count and place the correct number card next to each set.'
        },
        {
          phase: 'game',
          duration: '10 minutes',
          title: 'Number Hopscotch',
          instructions: 'Create a number path 1-10 on the floor. Children hop and say each number.'
        }
      ],
      interactive_activities: [
        { name: 'Count the Objects', type: 'counting', description: 'Count items and tap the matching number' },
        { name: 'Number Tracing', type: 'tracing', description: 'Trace numbers 1-10 with finger' },
        { name: 'Number Match', type: 'matching', description: 'Match numeral to quantity of objects' },
        { name: 'Missing Number', type: 'sequence', description: 'Find the missing number in sequence: 1, 2, _, 4' },
        { name: 'Number Order', type: 'ordering', description: 'Put numbers 1-10 in correct order' }
      ]
    },
    age_group: '3-6',
    duration_minutes: 40,
    objectives: ['Recognize numerals 1-10', 'Count objects up to 10', 'Match quantities to numbers', 'Order numbers correctly', 'Understand one-to-one correspondence'],
    materials_needed: ['Number flashcards', 'Counting manipulatives (blocks, beads)', 'Number line', 'Dice', 'Ten frames'],
    difficulty_level: 'beginner'
  },
  {
    id: 'f6a7b8c9-d0e1-2345-fabc-678901234567',
    title: '🔤 Alphabet Adventure A-Z',
    subject: 'literacy',
    description: 'An exciting journey through the entire alphabet! Children learn letter recognition, sounds, and words starting with each letter through songs, actions, and interactive activities.',
    short_description: 'Explore all 26 letters of the alphabet!',
    content: {
      overview: 'Go on an alphabet adventure! Learn to recognize all 26 letters and their sounds.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'Alphabet Song',
          instructions: 'Sing the ABC song together while pointing to letters on an alphabet chart.'
        },
        {
          phase: 'letter_focus',
          duration: '20 minutes',
          title: 'Letter of the Day Deep Dive',
          note: 'Focus on 2-3 letters per lesson. This content covers all letters for reference.',
          letters: [
            { letter: 'A', word: 'Apple', action: 'Bite an imaginary apple', sound: '/a/ as in ant' },
            { letter: 'B', word: 'Ball', action: 'Bounce an imaginary ball', sound: '/b/ as in bat' },
            { letter: 'C', word: 'Cat', action: 'Pretend to be a cat', sound: '/k/ as in car' },
            { letter: 'D', word: 'Dog', action: 'Pant like a puppy', sound: '/d/ as in dig' },
            { letter: 'E', word: 'Elephant', action: 'Swing trunk arm', sound: '/e/ as in egg' },
            { letter: 'F', word: 'Fish', action: 'Swim like a fish', sound: '/f/ as in fun' },
            { letter: 'G', word: 'Gorilla', action: 'Beat chest', sound: '/g/ as in go' },
            { letter: 'H', word: 'Horse', action: 'Gallop in place', sound: '/h/ as in hat' },
            { letter: 'I', word: 'Ice cream', action: 'Lick ice cream cone', sound: '/i/ as in igloo' },
            { letter: 'J', word: 'Jump', action: 'Jump up!', sound: '/j/ as in jam' },
            { letter: 'K', word: 'Kangaroo', action: 'Hop like kangaroo', sound: '/k/ as in kite' },
            { letter: 'L', word: 'Lion', action: 'Roar!', sound: '/l/ as in log' },
            { letter: 'M', word: 'Monkey', action: 'Scratch like monkey', sound: '/m/ as in map' },
            { letter: 'N', word: 'Nose', action: 'Touch your nose', sound: '/n/ as in net' },
            { letter: 'O', word: 'Octopus', action: 'Wave 8 arms', sound: '/o/ as in octagon' },
            { letter: 'P', word: 'Penguin', action: 'Waddle', sound: '/p/ as in pig' },
            { letter: 'Q', word: 'Queen', action: 'Wave like royalty', sound: '/kw/ as in quilt' },
            { letter: 'R', word: 'Robot', action: 'Move like robot', sound: '/r/ as in run' },
            { letter: 'S', word: 'Snake', action: 'Slither and hiss', sound: '/s/ as in sun' },
            { letter: 'T', word: 'Tiger', action: 'Show claws', sound: '/t/ as in top' },
            { letter: 'U', word: 'Umbrella', action: 'Open umbrella', sound: '/u/ as in up' },
            { letter: 'V', word: 'Volcano', action: 'Explode!', sound: '/v/ as in van' },
            { letter: 'W', word: 'Whale', action: 'Spout water', sound: '/w/ as in wet' },
            { letter: 'X', word: 'X-ray', action: 'Show bones', sound: '/ks/ as in fox' },
            { letter: 'Y', word: 'Yak', action: 'Make yak sound', sound: '/y/ as in yes' },
            { letter: 'Z', word: 'Zebra', action: 'Gallop with stripes', sound: '/z/ as in zoo' }
          ]
        },
        {
          phase: 'practice',
          duration: '10 minutes',
          title: 'Letter Hunt',
          instructions: 'Find objects in the room that start with todays letters.'
        }
      ],
      interactive_activities: [
        { name: 'Letter Match', type: 'matching', description: 'Match uppercase to lowercase letters' },
        { name: 'Beginning Sound Sort', type: 'sorting', description: 'Sort pictures by beginning sound' },
        { name: 'Letter Tracing', type: 'tracing', description: 'Trace letters with finger or stylus' },
        { name: 'Alphabet Order', type: 'sequencing', description: 'Put letters in ABC order' }
      ]
    },
    age_group: '3-6',
    duration_minutes: 35,
    objectives: ['Recognize all 26 letters', 'Match uppercase and lowercase', 'Produce letter sounds', 'Identify beginning sounds in words'],
    materials_needed: ['Alphabet chart', 'Letter flashcards', 'Picture cards', 'Letter manipulatives', 'Alphabet puzzle'],
    difficulty_level: 'beginner'
  },
  {
    id: 'a7b8c9d0-e1f2-3456-abcd-789012345678',
    title: '🔷 Shapes All Around Us',
    subject: 'mathematics',
    description: 'Discover shapes everywhere! Children learn to identify, name, and describe basic 2D shapes through exploration, songs, and hands-on activities.',
    short_description: 'Find and learn about circles, squares, triangles and more!',
    content: {
      overview: 'Shapes are everywhere! Learn to identify circles, squares, triangles, rectangles, and more.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'Shape Song',
          instructions: 'Sing: "Shapes are everywhere I look, in my room and in my book! Circles, squares, and triangles too, I can find them, how about you?"'
        },
        {
          phase: 'shape_exploration',
          duration: '15 minutes',
          title: 'Meet the Shapes',
          shapes: [
            { 
              name: 'Circle', 
              description: 'Round and round with no corners at all',
              real_world: ['sun', 'clock', 'wheel', 'pizza', 'cookie'],
              action: 'Draw circle in air with finger',
              song: 'A circle is round, round, round, with no corners to be found!'
            },
            { 
              name: 'Square', 
              description: '4 equal sides and 4 corners',
              real_world: ['window', 'cracker', 'block', 'napkin'],
              action: 'Make square with fingers',
              song: 'A square has 4 sides, all the same, square is its name!'
            },
            { 
              name: 'Triangle', 
              description: '3 sides and 3 corners/points',
              real_world: ['pizza slice', 'sail', 'roof', 'mountain'],
              action: 'Make triangle with hands over head',
              song: 'Triangle, triangle, 1-2-3 sides, like a pizza slice for you and me!'
            },
            { 
              name: 'Rectangle', 
              description: '4 sides, 2 long and 2 short',
              real_world: ['door', 'book', 'phone', 'bed'],
              action: 'Make tall rectangle with arms',
              song: 'Rectangle has 4 sides too, 2 are long and 2 are short, its true!'
            },
            { 
              name: 'Oval', 
              description: 'Like a stretched circle',
              real_world: ['egg', 'face', 'spoon', 'mirror'],
              action: 'Draw oval in air',
              song: 'Oval is like a circle stretched, like an egg thats just been fetched!'
            }
          ]
        },
        {
          phase: 'game',
          duration: '15 minutes',
          title: 'Shape Hunt',
          instructions: 'Go on a classroom shape hunt! Find real objects that match each shape and place them on shape mats.'
        }
      ],
      interactive_activities: [
        { name: 'Shape Sorting', type: 'sorting', description: 'Sort objects by shape into correct bins' },
        { name: 'Shape Matching', type: 'matching', description: 'Match shapes to their shadows' },
        { name: 'Shape Building', type: 'construction', description: 'Use sticks to build shapes' },
        { name: 'Shape Patterns', type: 'patterns', description: 'Complete shape patterns: circle, square, circle, ?' },
        { name: 'I Spy Shapes', type: 'identification', description: 'Find shapes hidden in pictures' }
      ]
    },
    age_group: '3-6',
    duration_minutes: 35,
    objectives: ['Identify basic shapes by name', 'Count sides and corners', 'Find shapes in the environment', 'Sort objects by shape', 'Create simple patterns with shapes'],
    materials_needed: ['Shape cutouts', 'Shape sorting toys', 'Pattern blocks', 'Shape stamps', 'Real objects of various shapes'],
    difficulty_level: 'beginner'
  },
  {
    id: 'b8c9d0e1-f2a3-4567-bcde-890123456789',
    title: '🐾 Animals and Their Sounds',
    subject: 'science',
    description: 'Meet amazing animals from the farm, jungle, ocean, and forest! Children learn animal names, sounds, movements, and habitats through interactive play.',
    short_description: 'Learn about animals and the sounds they make!',
    content: {
      overview: 'Explore the animal kingdom! Learn about different animals, where they live, and the sounds they make.',
      lesson_flow: [
        {
          phase: 'introduction',
          duration: '5 minutes',
          title: 'Old MacDonald Song',
          instructions: 'Sing Old MacDonald with different animals, letting children choose which animal to add.'
        },
        {
          phase: 'animal_exploration',
          duration: '20 minutes',
          title: 'Animal Adventures',
          habitats: [
            {
              name: 'Farm Animals',
              animals: [
                { animal: 'Cow', sound: 'Moo', movement: 'Walk slowly', fact: 'Cows give us milk!' },
                { animal: 'Pig', sound: 'Oink', movement: 'Roll in mud', fact: 'Pigs are very smart!' },
                { animal: 'Chicken', sound: 'Cluck', movement: 'Flap wings', fact: 'Chickens give us eggs!' },
                { animal: 'Horse', sound: 'Neigh', movement: 'Gallop', fact: 'Horses can sleep standing up!' },
                { animal: 'Sheep', sound: 'Baa', movement: 'Walk in group', fact: 'Sheep give us wool!' }
              ]
            },
            {
              name: 'Jungle Animals',
              animals: [
                { animal: 'Lion', sound: 'Roar', movement: 'Prowl', fact: 'Lions are called the King of the Jungle!' },
                { animal: 'Elephant', sound: 'Trumpet', movement: 'Stomp', fact: 'Elephants have great memory!' },
                { animal: 'Monkey', sound: 'Ooh ooh ah ah', movement: 'Climb and swing', fact: 'Monkeys love bananas!' },
                { animal: 'Snake', sound: 'Hiss', movement: 'Slither', fact: 'Snakes have no legs!' }
              ]
            },
            {
              name: 'Ocean Animals',
              animals: [
                { animal: 'Fish', sound: 'Blub blub', movement: 'Swim', fact: 'Fish breathe through gills!' },
                { animal: 'Whale', sound: 'Singing sound', movement: 'Swim and spout', fact: 'Whales are the biggest animals!' },
                { animal: 'Dolphin', sound: 'Click click', movement: 'Jump and flip', fact: 'Dolphins are very friendly!' }
              ]
            }
          ]
        },
        {
          phase: 'game',
          duration: '10 minutes',
          title: 'Animal Charades',
          instructions: 'Children take turns acting like an animal while others guess which animal it is.'
        }
      ],
      interactive_activities: [
        { name: 'Animal Sound Match', type: 'matching', description: 'Match animals to their sounds' },
        { name: 'Habitat Sort', type: 'sorting', description: 'Sort animals into farm, jungle, or ocean' },
        { name: 'Animal Puzzle', type: 'puzzle', description: 'Complete animal puzzles' },
        { name: 'Baby Animals', type: 'matching', description: 'Match baby animals to parents' }
      ]
    },
    age_group: '3-6',
    duration_minutes: 35,
    objectives: ['Name common animals', 'Imitate animal sounds', 'Identify animal habitats', 'Describe animal characteristics', 'Match baby animals to parents'],
    materials_needed: ['Animal figures or puppets', 'Habitat picture cards', 'Animal sound recordings', 'Animal puzzles', 'Animal books'],
    difficulty_level: 'beginner'
  }
];

// Activities for each lesson
const lessonActivities = [
  // Vowel Sounds Safari activities
  {
    lesson_id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    title: 'Vowel Animal Matching',
    description: 'Match each vowel letter to its animal friend: A-Alligator, E-Elephant, I-Iguana, O-Octopus, U-Umbrella Bird',
    activity_type: 'game',
    duration_minutes: 8,
    order_index: 1,
    content: { steps: ['Look at the vowel letter', 'Find the animal that starts with that sound', 'Drag the animal to the vowel'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    title: 'Missing Vowel Fill-In',
    description: 'Complete words by adding the missing vowel: C_T (cat), D_G (dog), P_N (pen)',
    activity_type: 'game',
    duration_minutes: 10,
    order_index: 2,
    content: { steps: ['Look at the incomplete word', 'Say the word out loud', 'Choose the correct vowel'] },
    is_required: true,
    points_possible: 15
  },
  // Color Matching Magic activities
  {
    lesson_id: 'd4e5f6a7-b8c9-0123-defa-456789012345',
    title: 'Color Sorting Game',
    description: 'Sort colorful objects into matching colored baskets',
    activity_type: 'game',
    duration_minutes: 10,
    order_index: 1,
    content: { steps: ['Look at the object', 'What color is it?', 'Drag it to the matching basket'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'd4e5f6a7-b8c9-0123-defa-456789012345',
    title: 'Color Mixing Lab',
    description: 'Mix primary colors to discover secondary colors: Red + Yellow = Orange',
    activity_type: 'exercise',
    duration_minutes: 12,
    order_index: 2,
    content: { steps: ['Choose two colors', 'Mix them together', 'See what new color appears!'] },
    is_required: true,
    points_possible: 15
  },
  // Number Recognition activities
  {
    lesson_id: 'e5f6a7b8-c9d0-1234-efab-567890123456',
    title: 'Count and Tap',
    description: 'Count the objects on screen and tap the matching number',
    activity_type: 'exercise',
    duration_minutes: 10,
    order_index: 1,
    content: { steps: ['Count the items carefully', 'Find the correct number', 'Tap it!'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'e5f6a7b8-c9d0-1234-efab-567890123456',
    title: 'Number Tracing',
    description: 'Trace numbers 1-10 by following the dotted lines',
    activity_type: 'exercise',
    duration_minutes: 10,
    order_index: 2,
    content: { steps: ['Start at the green dot', 'Follow the arrows', 'Trace the number'] },
    is_required: true,
    points_possible: 10
  },
  // Alphabet Adventure activities
  {
    lesson_id: 'f6a7b8c9-d0e1-2345-fabc-678901234567',
    title: 'Letter Sound Match',
    description: 'Match letters to pictures that start with that sound',
    activity_type: 'game',
    duration_minutes: 10,
    order_index: 1,
    content: { steps: ['Look at the letter', 'Say its sound', 'Find the picture that starts with that sound'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'f6a7b8c9-d0e1-2345-fabc-678901234567',
    title: 'ABC Order',
    description: 'Put scrambled letters in alphabetical order',
    activity_type: 'game',
    duration_minutes: 8,
    order_index: 2,
    content: { steps: ['Sing the ABC song in your head', 'Find which letter comes next', 'Drag letters into order'] },
    is_required: true,
    points_possible: 10
  },
  // Shapes activities
  {
    lesson_id: 'a7b8c9d0-e1f2-3456-abcd-789012345678',
    title: 'Shape Sorting',
    description: 'Sort shapes into the correct shape bins',
    activity_type: 'game',
    duration_minutes: 10,
    order_index: 1,
    content: { steps: ['Look at the shape', 'Is it round? Square? Triangle?', 'Put it in the right bin'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'a7b8c9d0-e1f2-3456-abcd-789012345678',
    title: 'I Spy Shapes',
    description: 'Find hidden shapes in fun pictures',
    activity_type: 'quiz',
    duration_minutes: 10,
    order_index: 2,
    content: { steps: ['Look at the picture carefully', 'Find the shape mentioned', 'Tap on it!'] },
    is_required: true,
    points_possible: 10
  },
  // Animals activities
  {
    lesson_id: 'b8c9d0e1-f2a3-4567-bcde-890123456789',
    title: 'Animal Sound Quiz',
    description: 'Listen to the sound and pick the right animal',
    activity_type: 'quiz',
    duration_minutes: 10,
    order_index: 1,
    content: { steps: ['Listen carefully to the sound', 'Which animal makes that sound?', 'Tap the correct animal'] },
    is_required: true,
    points_possible: 10
  },
  {
    lesson_id: 'b8c9d0e1-f2a3-4567-bcde-890123456789',
    title: 'Habitat Sort',
    description: 'Help animals find their homes - farm, jungle, or ocean',
    activity_type: 'game',
    duration_minutes: 10,
    order_index: 2,
    content: { steps: ['Look at the animal', 'Where does it live?', 'Drag it to its home'] },
    is_required: true,
    points_possible: 10
  }
];

async function seedLessons() {
  console.log('🌱 Starting to seed rich preschool lessons...\n');

  // Insert each lesson
  for (const lesson of richLessons) {
    console.log(`📚 Creating lesson: ${lesson.title}`);
    
    const { error } = await supabase
      .from('lessons')
      .upsert({
        ...lesson,
        preschool_id: PRESCHOOL_ID,
        teacher_id: TEACHER_ID,
        status: 'active',
        is_ai_generated: true,
        is_public: true,
        is_featured: true
      }, { 
        onConflict: 'id' 
      });

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Created successfully!`);
    }
  }

  console.log('\n🎮 Creating lesson activities...\n');

  // Insert activities
  for (const activity of lessonActivities) {
    console.log(`  🎯 Creating activity: ${activity.title}`);
    
    const { error } = await supabase
      .from('lesson_activities')
      .insert(activity);

    if (error) {
      console.error(`    ❌ Error: ${error.message}`);
    } else {
      console.log(`    ✅ Created successfully!`);
    }
  }

  // Verify
  console.log('\n📊 Verifying seed data...');
  
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title, subject, status')
    .order('created_at', { ascending: false });

  if (lessonsError) {
    console.error('Error fetching lessons:', lessonsError.message);
  } else {
    console.log(`\n✅ Total lessons in database: ${lessons?.length}`);
    lessons?.forEach(l => console.log(`  - ${l.title} (${l.subject}) [${l.status}]`));
  }

  const { data: activities, error: activitiesError } = await supabase
    .from('lesson_activities')
    .select('id, title, lesson_id')
    .order('created_at', { ascending: false });

  if (activitiesError) {
    console.error('Error fetching activities:', activitiesError.message);
  } else {
    console.log(`\n✅ Total activities in database: ${activities?.length}`);
  }

  console.log('\n🎉 Seeding complete!');
}

// Run the seeder
seedLessons().catch(console.error);
