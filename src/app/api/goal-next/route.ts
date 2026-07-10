import { NextRequest } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The next few steps of a goal she's already working on.
//
// /api/decompose only ever sees a goal TITLE, so calling it twice just regenerates
// the opening steps ("Look up a number for…"). This endpoint sees the goal AND
// everything she has already finished, so it can carry on from where she is — or
// say the goal is genuinely complete and should be closed.
//
// It runs when a goal drops to zero pending steps. Before this existed, a goal that
// ran out of steps read 100% and stopped appearing in her day forever, which quietly
// retired ongoing goals like "get stronger" after five taps.

const SYSTEM_PROMPT = `You are GaeDHD, an ADHD second brain. A person is part-way through a goal.
You are given the goal and every step she has ALREADY COMPLETED. Decide what happens next.

Respond ONLY with valid JSON — no markdown fences, no prose:
{
  "goalComplete": false,
  "why": "",
  "tasks": [
    {"title": "The concrete next action", "durationMin": 10, "phase": "Step", "energyLevel": "low", "cognitiveLoad": "light"},
    ...
  ]
}

FIRST decide: is this goal actually finished?
- Set "goalComplete": true ONLY when the goal is a finite project whose real-world outcome
  has clearly been achieved by the completed steps (e.g. "paint the kitchen" and she has
  painted, cleaned up, and put the furniture back). Then set "why" to one plain sentence
  telling her it's done (e.g. "The kitchen is painted."), and return an empty "tasks" array.
- Set "goalComplete": false for any ONGOING goal that has no natural end — getting stronger,
  learning a language, growing a business, keeping a home, a creative practice. These NEVER
  complete just because some steps were done. Give her the next steps.
- When in doubt, choose false and give her more steps. Wrongly closing a goal she still
  cares about is much worse than offering one more step.

If not complete, produce 3-5 NEW steps that genuinely move the goal forward FROM WHERE SHE IS:
- Do NOT repeat, restate, or lightly reword anything in the completed list. Look at what she
  has done and continue. If she has already bought the paint, do not tell her to buy paint.
- Progress the difficulty or the stage. Step 12 of "get stronger" should not look like step 1.
- Each step is ONE concrete action with zero ambiguity about what to do.
  Bad: "Work on the project" | Good: "Open the doc and write just the intro paragraph"
- Keep her own steps tiny: 5-15 minutes. Steps that depend on other people (a call, a text,
  a booking) are the real action and can be short.
- Be PRESCRIPTIVE. If she gave her setup (equipment, rooms, people), use real names and gear.
- VARY the specifics. Repeat goals must stay fresh; never send her the same step twice.
- durationMin: realistic minutes. phase: a 1-3 word label ("Prep", "Do it", "Wrap up").
- energyLevel: "low" | "medium" | "high". cognitiveLoad: "mindless" | "light" | "deep".`

interface NextTask {
  title: string
  durationMin?: number
  phase?: string
  energyLevel?: string
  cognitiveLoad?: string
}

// Offline / no-key path. We cannot reason about her goal without a model, so we do
// the one honest thing: keep the goal alive with a couple of generic nudges toward
// it, and NEVER claim it's complete. Anything already done is filtered out by the
// caller, so a stale suggestion won't be handed back to her twice.
function fallbackTasks(goalTitle: string): NextTask[] {
  return [
    { title: `Spend 10 minutes on: ${goalTitle}`, durationMin: 10, phase: 'Do it', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: `Decide the very next small step for: ${goalTitle}`, durationMin: 5, phase: 'Plan', energyLevel: 'low', cognitiveLoad: 'light' },
  ]
}

export async function POST(request: NextRequest) {
  // Explicit gate. Middleware is defense-in-depth only and fails open on an auth
  // error, and this route spends the server ANTHROPIC_API_KEY.
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { goal, completedTitles, apiKey, userContext } = await request.json()

  if (!goal?.title || typeof goal.title !== 'string') {
    return Response.json({ error: 'goal is required' }, { status: 400 })
  }

  // Cap the history we send: the last 40 steps is plenty of context and keeps a
  // long-running goal from growing an unbounded prompt (and an unbounded bill).
  const done: string[] = Array.isArray(completedTitles)
    ? completedTitles.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0).slice(-40)
    : []

  const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!effectiveKey) {
    return Response.json({ goalComplete: false, why: '', tasks: fallbackTasks(goal.title), source: 'fallback' })
  }

  const userMessage = [
    `Goal: "${goal.title}"`,
    goal.description && goal.description !== goal.title ? `In her words: ${goal.description}` : '',
    goal.category ? `Category: ${goal.category}` : '',
    '',
    done.length
      ? `She has already completed these ${done.length} step(s), oldest first:\n${done.map(t => `- ${t}`).join('\n')}`
      : 'She has not completed any steps yet.',
    userContext ? `\nHer setup (use this to make steps specific to her):\n${userContext}` : '',
  ].filter(Boolean).join('\n')

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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return Response.json(
        { error: `Claude API error: ${err.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '{}'

    let parsed: { goalComplete?: unknown; why?: unknown; tasks?: unknown }
    try {
      // Tolerate a stray fence or leading prose without letting junk through.
      const match = /\{[\s\S]*\}/.exec(text)
      parsed = JSON.parse(match ? match[0] : text)
    } catch {
      return Response.json({ error: 'Could not parse Claude response' }, { status: 500 })
    }

    const tasks: NextTask[] = Array.isArray(parsed.tasks)
      ? (parsed.tasks as NextTask[]).filter(t => typeof t?.title === 'string' && t.title.trim().length > 0)
      : []

    // Only honour a completion claim when it's unambiguous AND the model didn't also
    // hand us more work to do. "Complete, and here are 4 more steps" is a contradiction;
    // resolve it the safe way, by keeping her goal open.
    const goalComplete = parsed.goalComplete === true && tasks.length === 0

    return Response.json({
      goalComplete,
      why: goalComplete && typeof parsed.why === 'string' ? parsed.why : '',
      tasks: goalComplete ? [] : tasks,
      source: 'claude',
    })
  } catch (err) {
    return Response.json(
      { error: `Failed to reach Claude API: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 }
    )
  }
}
