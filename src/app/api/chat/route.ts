import { NextRequest } from 'next/server'
import { auth } from '@/auth'

const SYSTEM_PROMPT = `You are the GaeDHD assistant — a warm, encouraging AI that helps people with ADHD break big goals into tiny, doable micro-tasks.

RULES:
1. Be warm, playful, and encouraging. Never clinical or robotic.
2. When someone tells you a goal, break it into micro-tasks (1-5 min each).
3. Each micro-task should be SO small that it defeats executive dysfunction.
4. Group tasks into phases (Prep, Work, Cool Down, etc.)
5. Always respond with BOTH a friendly message AND a structured JSON block.

RESPONSE FORMAT:
Write your friendly response first, then include a JSON block wrapped in <goal> tags:

<goal>
{
  "title": "Short goal name",
  "category": "fitness|learning|art|home|work|family|self-care|errands",
  "emoji": "relevant emoji",
  "tasks": [
    {"title": "Task description", "durationMin": 2, "phase": "Prep", "energyLevel": "low|medium|high"},
    ...
  ]
}
</goal>

EXAMPLES of good micro-tasks:
- "Grab your resistance band from the closet" (1 min, low energy)
- "5 RDLs — squeeze at the top 🍑" (2 min, high energy)
- "Clear JUST the left side of the counter" (3 min, medium energy)
- "Open Duolingo and tap 'Start'" (1 min, low energy)

If the user is just chatting or asking questions (not stating a goal), respond naturally without the <goal> block. If they seem overwhelmed, suggest the "I can't even" approach — give them the absolute tiniest possible action.`

export async function POST(request: NextRequest) {
  // Explicit gate: middleware auth() fails open (proceeds to the route) if it throws,
  // so it's defense-in-depth only. This route spends the server ANTHROPIC_API_KEY, so
  // check the session here before parsing the body or reaching out to Claude.
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { messages, apiKey, userContext } = await request.json()

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'Messages array required' }, { status: 400 })
  }

  const system = userContext
    ? `${SYSTEM_PROMPT}\n\nHER SETUP (use this to make steps specific to her — name her actual equipment and spaces, and vary the specifics so repeat goals stay fresh):\n${userContext}`
    : SYSTEM_PROMPT

  // Use client-provided key, or fall back to server env var
  const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (effectiveKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return Response.json(
          { error: `Claude API error: ${err.error?.message || response.statusText}` },
          { status: response.status }
        )
      }

      const data = await response.json()
      const text = data.content?.[0]?.text || ''

      // Parse any <goal> block from the response
      const goalMatch = text.match(/<goal>\s*([\s\S]*?)\s*<\/goal>/)
      let proposedGoal = null
      let cleanText = text

      if (goalMatch) {
        try {
          proposedGoal = JSON.parse(goalMatch[1])
          cleanText = text.replace(/<goal>[\s\S]*?<\/goal>/, '').trim()
        } catch {
          // If JSON parse fails, just return the full text
        }
      }

      return Response.json({ content: cleanText, proposedGoal })
    } catch (err) {
      return Response.json(
        { error: `Failed to reach Claude API: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 500 }
      )
    }
  }

  // No API key — use smart mock responses
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ''
  const result = generateMockResponse(lastMessage)

  // Simulate typing delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 700))

  return Response.json(result)
}

function generateMockResponse(input: string): { content: string; proposedGoal: Record<string, unknown> | null } {
  // Detect goal-like input
  if (input.match(/rdl|squat|workout|exercise|push.?up|plank|stretch|yoga|run|walk|gym/i)) {
    return {
      content: "Ooh yes! Let's get that workout in 💪 I've broken it down so each step is tiny enough to start without thinking. The whole thing fits in about 12 minutes.",
      proposedGoal: {
        title: extractTitle(input, 'Workout'),
        category: 'fitness',
        emoji: '🍑',
        tasks: [
          { title: 'Grab your equipment', durationMin: 1, phase: 'Prep', energyLevel: 'low' },
          { title: 'Find a clear spot, feet hip-width', durationMin: 1, phase: 'Prep', energyLevel: 'low' },
          { title: '5 reps — focus on form, squeeze at the top', durationMin: 2, phase: 'Work', energyLevel: 'high' },
          { title: 'Rest 30s, shake it out', durationMin: 1, phase: 'Work', energyLevel: 'low' },
          { title: '5 more — slow on the way down', durationMin: 2, phase: 'Work', energyLevel: 'high' },
          { title: 'Rest 30s', durationMin: 1, phase: 'Work', energyLevel: 'low' },
          { title: '5 more — hold the last one 3 sec', durationMin: 2, phase: 'Work', energyLevel: 'high' },
          { title: 'Rest 30s', durationMin: 1, phase: 'Work', energyLevel: 'low' },
          { title: '5 more — you got this', durationMin: 2, phase: 'Work', energyLevel: 'high' },
          { title: 'Last 5 — make them count! 🍑', durationMin: 2, phase: 'Work', energyLevel: 'high' },
          { title: 'Stretch hamstrings 30s each side', durationMin: 2, phase: 'Cool Down', energyLevel: 'low' },
        ],
      },
    }
  }

  if (input.match(/clean|kitchen|bathroom|dishes|laundry|vacuum|mop|organize|tidy|declutter/i)) {
    return {
      content: "Let's tackle that! The trick is: we're NOT cleaning the whole thing. We're doing ONE tiny surface at a time. Before you know it, it's done ✨",
      proposedGoal: {
        title: extractTitle(input, 'Clean Up'),
        category: 'home',
        emoji: '✨',
        tasks: [
          { title: 'Clear just the left side of the counter', durationMin: 3, phase: 'Surfaces', energyLevel: 'medium' },
          { title: 'Wipe down the stove top', durationMin: 4, phase: 'Surfaces', energyLevel: 'medium' },
          { title: 'Load dishwasher — bottom rack only', durationMin: 3, phase: 'Dishes', energyLevel: 'low' },
          { title: 'Wipe counter where you just cleared', durationMin: 2, phase: 'Surfaces', energyLevel: 'low' },
          { title: 'Take out the trash', durationMin: 2, phase: 'Finish', energyLevel: 'low' },
          { title: 'Quick sweep the floor', durationMin: 3, phase: 'Finish', energyLevel: 'medium' },
        ],
      },
    }
  }

  if (input.match(/learn|study|read|spanish|french|course|book|practice|duolingo/i)) {
    return {
      content: "Love it! Learning in micro-doses is PERFECT for ADHD brains. We retain more in short bursts anyway 📚",
      proposedGoal: {
        title: extractTitle(input, 'Learn Something'),
        category: 'learning',
        emoji: '📚',
        tasks: [
          { title: 'Open your learning app/book', durationMin: 1, phase: 'Setup', energyLevel: 'low' },
          { title: 'Review 3 things from last time', durationMin: 3, phase: 'Review', energyLevel: 'low' },
          { title: 'Learn 3 new items', durationMin: 5, phase: 'New Material', energyLevel: 'medium' },
          { title: 'Quick quiz yourself on all 6', durationMin: 3, phase: 'Practice', energyLevel: 'medium' },
          { title: 'Write down your favorite new thing', durationMin: 2, phase: 'Wrap Up', energyLevel: 'low' },
        ],
      },
    }
  }

  if (input.match(/paint|draw|art|sketch|watercolor|craft|create|design|knit|crochet/i)) {
    return {
      content: "Creative time! 🎨 The hardest part is starting, so let's make step one embarrassingly easy.",
      proposedGoal: {
        title: extractTitle(input, 'Creative Project'),
        category: 'art',
        emoji: '🎨',
        tasks: [
          { title: 'Get your supplies out on the table', durationMin: 2, phase: 'Setup', energyLevel: 'low' },
          { title: 'Set up your palette/workspace', durationMin: 3, phase: 'Setup', energyLevel: 'low' },
          { title: 'Work on one small section', durationMin: 5, phase: 'Create', energyLevel: 'medium' },
          { title: 'Step back and look at what you did', durationMin: 1, phase: 'Create', energyLevel: 'low' },
          { title: 'Do one more small section', durationMin: 5, phase: 'Create', energyLevel: 'medium' },
          { title: 'Clean brushes/tools', durationMin: 3, phase: 'Wrap Up', energyLevel: 'low' },
        ],
      },
    }
  }

  if (input.match(/can't|overwhelm|too much|don't know|stuck|help|exhausted|tired|can not/i)) {
    return {
      content: "Hey, that's okay. Seriously. 💛\n\nHere's the deal: you don't have to do anything big right now. Just do this ONE thing:\n\n**Stand up and stretch for 10 seconds.**\n\nThat's it. If that leads to something else, great. If not, you still moved. And that counts.",
      proposedGoal: null,
    }
  }

  // Default
  return {
    content: "I'd love to help with that! Can you tell me a bit more about what you're trying to get done? I'll break it into tiny steps that fit into the gaps in your day.\n\nYou can say something like:\n• \"I need to clean the kitchen\"\n• \"Help me do 25 RDLs\"\n• \"I want to learn some Spanish\"",
    proposedGoal: null,
  }
}

function extractTitle(input: string, fallback: string): string {
  // Try to make a nice title from the input
  const cleaned = input.replace(/^(i want to|i need to|help me|let's|lets|can you|please)\s*/i, '')
  if (cleaned.length > 3 && cleaned.length < 50) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return fallback
}
