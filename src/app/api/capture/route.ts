import { NextRequest } from 'next/server'

// Reads a photo of a list or note she wrote and pulls out the individual items.
// She is a list-writer; this is the "snap a photo of my handwriting" capture door.
// Returns each line as a clean task or project; projects get broken into next-actions
// later via /api/decompose. No offline fallback: vision needs a key.

const SYSTEM_PROMPT = `You are reading a photo of a list or note a person wrote, often
handwritten, often messy, often ADHD shorthand. Pull out every distinct to-do or item.

Respond ONLY with valid JSON — no markdown fences:
{ "items": [ { "text": "the item as a clear, short task", "kind": "task" }, ... ] }

Rules:
- One entry per real item. Clean up the handwriting into clear, confident text.
- kind = "project" if it needs multiple steps or other people (e.g. "paint the kitchen",
  "plan the trip", "find a dentist"). kind = "task" if it is one doable thing
  (e.g. "buy milk", "email Sara", "water the plants").
- Skip doodles, decorations, headers, and crossed-out items.
- Keep her intent and her wording where it is already clear. Do not invent items.
- If you cannot read it at all, return { "items": [] }.`

function parseImage(input: string): { mediaType: string; data: string } | null {
  // Accept a data URL ("data:image/jpeg;base64,....") or raw base64 + separate type.
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(input)
  if (match) return { mediaType: match[1], data: match[2] }
  return null
}

export async function POST(request: NextRequest) {
  const { image, mediaType, apiKey, userContext } = await request.json()

  if (!image || typeof image !== 'string') {
    return Response.json({ error: 'An image is required' }, { status: 400 })
  }

  const parsed = parseImage(image)
  const imgMediaType = parsed?.mediaType || mediaType || 'image/jpeg'
  const imgData = parsed?.data || image

  const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!effectiveKey) {
    return Response.json(
      { error: 'Reading photos needs an Anthropic API key. Add one in Settings.' },
      { status: 422 }
    )
  }

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
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imgMediaType, data: imgData } },
              {
                type: 'text',
                text: [
                  'Pull the items out of this list.',
                  userContext ? `\nContext about her (use to disambiguate): ${userContext}` : '',
                ].filter(Boolean).join(''),
              },
            ],
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
      const out = JSON.parse(text)
      const items = Array.isArray(out.items) ? out.items : []
      return Response.json({ items })
    } catch {
      return Response.json({ error: 'Could not parse the list from that photo' }, { status: 500 })
    }
  } catch (err) {
    return Response.json(
      { error: `Failed to reach Claude API: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 }
    )
  }
}
