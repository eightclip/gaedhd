import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { GOAL_NEXT_SYSTEM_PROMPT, buildGoalNextMessage } from '@/lib/goal-next-prompt'

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

  const userMessage = buildGoalNextMessage(goal, done, userContext)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': effectiveKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: GOAL_NEXT_SYSTEM_PROMPT,
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
