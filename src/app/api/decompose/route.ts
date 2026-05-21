import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { goal, category, lifeArea } = await request.json()

  if (!goal || typeof goal !== 'string') {
    return Response.json({ error: 'Goal text is required' }, { status: 400 })
  }

  // TODO: Replace with real Claude API call when ANTHROPIC_API_KEY is set
  // For now, return mock decomposition
  const mockTasks = generateMockDecomposition(goal, category)

  return Response.json({
    goal: {
      title: goal,
      category,
      lifeArea,
      emoji: getCategoryEmoji(category),
    },
    microTasks: mockTasks,
  })
}

function generateMockDecomposition(goal: string, category: string) {
  // Simple mock that creates reasonable micro-tasks
  const goalLower = goal.toLowerCase()

  if (goalLower.includes('rdl') || goalLower.includes('workout') || goalLower.includes('exercise')) {
    return [
      { title: 'Grab your equipment', durationMin: 1, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Find a clear spot and warm up', durationMin: 2, phase: 'Prep', energyLevel: 'medium', cognitiveLoad: 'mindless' },
      { title: 'First set — 5 reps, focus on form', durationMin: 2, phase: 'Work', energyLevel: 'high', cognitiveLoad: 'mindless' },
      { title: 'Rest 30 seconds', durationMin: 1, phase: 'Work', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Second set — 5 reps, slow and controlled', durationMin: 2, phase: 'Work', energyLevel: 'high', cognitiveLoad: 'mindless' },
      { title: 'Rest 30 seconds', durationMin: 1, phase: 'Work', energyLevel: 'low', cognitiveLoad: 'mindless' },
      { title: 'Third set — 5 reps, squeeze at the top', durationMin: 2, phase: 'Work', energyLevel: 'high', cognitiveLoad: 'mindless' },
      { title: 'Cool down stretch', durationMin: 2, phase: 'Cool Down', energyLevel: 'low', cognitiveLoad: 'mindless' },
    ]
  }

  // Generic decomposition
  return [
    { title: `Get ready for: ${goal}`, durationMin: 2, phase: 'Prep', energyLevel: 'low', cognitiveLoad: 'light' },
    { title: 'Start the first small piece', durationMin: 5, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Keep going — next piece', durationMin: 5, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Almost there — finish strong', durationMin: 5, phase: 'Work', energyLevel: 'medium', cognitiveLoad: 'light' },
    { title: 'Wrap up and put things away', durationMin: 2, phase: 'Finish', energyLevel: 'low', cognitiveLoad: 'mindless' },
  ]
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    fitness: '💪', learning: '📚', art: '🎨', home: '🏠',
    work: '💼', family: '👨‍👩‍👧‍👦', 'self-care': '🧘', errands: '🏃',
  }
  return map[category] || '✨'
}
