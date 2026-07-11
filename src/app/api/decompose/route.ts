import { NextRequest } from 'next/server'
import { auth } from '@/auth'

const SYSTEM_PROMPT = `You are GaeDHD, an ADHD-friendly second brain. Turn whatever she captures into an
ordered list of next actions, where the first one is the single thing she can do right now.

Respond ONLY with valid JSON — no extra text, no markdown fences:
{
  "title": "Short title (4-6 words max)",
  "emoji": "one relevant emoji",
  "sequential": false,
  "tasks": [
    {"title": "The concrete next action", "durationMin": 10, "phase": "Step", "energyLevel": "low", "cognitiveLoad": "light"},
    ...
  ]
}

About "sequential":
- Set true ONLY when each step truly depends on the one before it, so they MUST be
  done in order (e.g. "call the painter" -> "get the quote" -> "schedule" -> "paint").
- Set false (default, most goals) when the steps are independent moments that can be
  sprinkled across her day in any order and interleaved with other goals
  (e.g. "make appointments for Bucky" -> call the vet / call the groomer / book the
  trim; or "practice Spanish" -> 10 words / one lesson / watch a clip). Most goals
  are false. When in doubt choose false so her day fills with small wins.

How to break it down:
- Produce 3-8 steps, IN ORDER. tasks[0] is the very first thing to do right now.
  She only ever sees the current step until she finishes it, then the next appears.
- Each step is ONE concrete action with zero ambiguity about what to do.
  Bad: "Work on the project" | Good: "Open the doc and write just the intro paragraph"
- If a step is something she does herself, make it tiny: 5-15 minutes.
- If a step depends on someone else or on leaving the house, make it the real-world
  action and keep it short. Good: "Call the painter and ask for a quote",
  "Text the dentist to book a cleaning", "Buy painter's tape at the hardware store".
- Steps may depend on earlier ones (call -> get quote -> schedule -> prep -> do).
  That's expected. Just order them correctly.
- Be PRESCRIPTIVE. If she gave her setup (equipment, rooms, people), use real names and gear.
  Bad: "do some squats" | Good: "Grab the kettlebell in your room and do 25 RDLs"
- VARY the specifics so repeat goals stay fresh.
- durationMin: realistic minutes for that step.
- phase: a 1-3 word label for the step ("Call", "Prep", "Do it", "Wrap up").
- energyLevel: "low" | "medium" | "high". cognitiveLoad: "mindless" | "light" | "deep".`

// "Training wheels" — how much of the thinking the AI does for her. Fading the
// scaffold is what builds self-sufficiency; permanent full help builds dependence
// (see RESEARCH.md #8). The mode appends to the base prompt.
type HelpLevel = 'full' | 'partial' | 'prompt'
const COACHING: Record<HelpLevel, string> = {
  full: '',
  partial: `\n\nCOACHING MODE — PARTIAL: She is practicing breaking things down herself.
Return ONLY tasks[0] — the single first concrete action — and nothing else in tasks.
She will write the rest. Keep "tasks" to exactly one item.`,
  prompt: `\n\nCOACHING MODE — PROMPT: Do NOT return any tasks. Instead return a "questions"
array of 2-3 short, warm questions that help HER break this down herself
(e.g. "What's the very first thing you'd physically touch?", "What does done look like?").
Respond ONLY with JSON shaped: {"title": "...", "emoji": "...", "questions": ["...", "..."]}.`,
}

export async function POST(request: NextRequest) {
  // Explicit gate: middleware auth() fails open (proceeds to the route) if it throws,
  // so it's defense-in-depth only. This route spends the server ANTHROPIC_API_KEY, so
  // check the session here before parsing the body or reaching out to Claude.
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { goal, category, lifeArea, apiKey, userContext, helpLevel } = await request.json()

  if (!goal || typeof goal !== 'string') {
    return Response.json({ error: 'Goal text is required' }, { status: 400 })
  }

  const help: HelpLevel = helpLevel === 'partial' || helpLevel === 'prompt' ? helpLevel : 'full'
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
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          system: SYSTEM_PROMPT + COACHING[help],
          messages: [
            {
              role: 'user',
              content: [
                `Goal: "${goal}"`,
                `Category: ${category}`,
                `Life area: ${lifeArea}`,
                userContext ? `\nHer setup (use this to make steps specific to her):\n${userContext}` : '',
              ].filter(Boolean).join('\n'),
            },
          ],
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
      const text = data.content?.[0]?.text || '{}'

      try {
        const parsed = JSON.parse(text)
        return Response.json({
          goal: { title: parsed.title, emoji: parsed.emoji },
          sequential: parsed.sequential === true,
          microTasks: help === 'partial' ? (parsed.tasks ?? []).slice(0, 1) : (parsed.tasks ?? []),
          questions: parsed.questions ?? [],
          coaching: help,
        })
      } catch {
        return Response.json({ error: 'Could not parse Claude response' }, { status: 500 })
      }
    } catch (err) {
      return Response.json(
        { error: `Failed to reach Claude API: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 500 }
      )
    }
  }

  // No API key — use smart mock decomposition
  const mockTasks = generateMockDecomposition(goal, category)
  // Appointment/scheduling-style goals depend on order; most others don't.
  const mockSequential = /paint|plumb|contractor|dentist|doctor|appointment|repair|fix|install|schedul|book|quote|mechanic|haircut|vet|electrician|handyman|inspect/i.test(goal)

  // Honor the coaching level even without an AI key.
  if (help === 'prompt') {
    return Response.json({
      goal: { title: goal, emoji: getCategoryEmoji(category) },
      sequential: false,
      microTasks: [],
      questions: [
        "What's the very first thing you'd physically touch or open?",
        'What does "done" actually look like here?',
        "What's the smallest piece you could finish in 10 minutes?",
      ],
      coaching: 'prompt',
    })
  }

  return Response.json({
    goal: { title: goal, emoji: getCategoryEmoji(category) },
    sequential: mockSequential,
    microTasks: help === 'partial' ? mockTasks.slice(0, 1) : mockTasks,
    questions: [],
    coaching: help,
  })
}

function generateMockDecomposition(goal: string, _category: string) {
  const goalLower = goal.toLowerCase()

  // Projects that depend on other people or appointments: the next action is the call,
  // not a 10-minute work chunk. This is the "call the painter until it's booked" case.
  if (goalLower.match(/paint|plumb|contractor|dentist|doctor|appointment|repair|fix|install|schedul|book|quote|mechanic|haircut|vet|electrician|handyman|inspect/i)) {
    return [
      { title: `Look up a number for: ${goal}`, durationMin: 5, phase: 'Find', energyLevel: 'low', cognitiveLoad: 'light' },
      { title: 'Make the call or send the text, and ask to get it scheduled', durationMin: 5, phase: 'Call', energyLevel: 'medium', cognitiveLoad: 'light' },
      { title: 'Put the date and time on the calendar', durationMin: 3, phase: 'Schedule', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Do any quick prep needed before they arrive', durationMin: 10, phase: 'Prep', energyLevel: 'medium', cognitiveLoad: 'light' },
    ]
  }

  if (goalLower.match(/rdl|squat|workout|exercise|push.?up|plank|stretch|yoga|run|walk|gym/i)) {
    return [
      { title: 'Grab your equipment and clear a space', durationMin: 5, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Warm up — 10 slow bodyweight squats', durationMin: 5, phase: 'Prep', energyLevel: 'medium', cognitiveLoad: 'mindless' },
      { title: 'First set — 8 reps, focus on form', durationMin: 5, phase: 'Work', energyLevel: 'high', cognitiveLoad: 'mindless' },
      { title: 'Rest and breathe, then second set — 8 reps', durationMin: 7, phase: 'Work', energyLevel: 'high', cognitiveLoad: 'mindless' },
      { title: 'Final set — give it your best, then cool down stretch', durationMin: 8, phase: 'Finish', energyLevel: 'medium', cognitiveLoad: 'mindless' },
    ]
  }

  if (goalLower.match(/clean|kitchen|bathroom|dishes|laundry|vacuum|mop|organize|tidy|declutter/i)) {
    return [
      { title: 'Gather supplies — cleaner, cloth, trash bag', durationMin: 5, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Clear one surface completely — left counter or table', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'mindless' },
      { title: 'Wipe down that surface and the stove top', durationMin: 8, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'mindless' },
      { title: 'Deal with dishes — load or handwash bottom rack only', durationMin: 10, phase: 'Work', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Take out trash and do a 60-second sweep of the floor', durationMin: 5, phase: 'Finish', energyLevel: 'low', cognitiveLoad: 'mindless' },
    ]
  }

  if (goalLower.match(/learn|study|read|spanish|french|course|book|practice|duolingo/i)) {
    return [
      { title: 'Open your learning material and read the first section heading', durationMin: 5, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'light' },
      { title: 'Review 5 things you learned last time', durationMin: 7, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'light' },
      { title: 'Work through 3-5 new items at your own pace', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
      { title: 'Quiz yourself — write down what you remember without looking', durationMin: 8, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
      { title: 'Write your one favorite new thing in a note and close up', durationMin: 5, phase: 'Finish', energyLevel: 'low', cognitiveLoad: 'light' },
    ]
  }

  if (goalLower.match(/paint|draw|art|sketch|watercolor|craft|create|design|knit|crochet/i)) {
    return [
      { title: 'Get your supplies out on the table — don\'t skip this', durationMin: 5, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Set up your workspace and any prep work', durationMin: 7, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'light' },
      { title: 'Work on one small section — no perfection, just progress', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
      { title: 'Step back, look at it, then do one more small section', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
      { title: 'Clean up tools and put supplies away', durationMin: 5, phase: 'Finish', energyLevel: 'low', cognitiveLoad: 'mindless' },
    ]
  }

  // Generic fallback
  return [
    { title: `Set up everything you need for: ${goal}`, durationMin: 5, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'light' },
    { title: 'Start the first piece — just the very beginning', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Keep going — next small piece', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Final push — finish strong', durationMin: 10, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Wrap up and put everything away', durationMin: 5, phase: 'Finish', energyLevel: 'low', cognitiveLoad: 'mindless' },
  ]
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    fitness: '💪', learning: '📚', art: '🎨', home: '🏠',
    work: '💼', family: '👨‍👩‍👧‍👦', 'self-care': '🧘', relationships: '💬', errands: '🏃',
  }
  return map[category] || '✨'
}
