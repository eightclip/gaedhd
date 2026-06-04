import { ImageResponse } from 'next/og'

export const alt = 'GaeDHD — Big goals. Tiny steps. Perfect timing.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#1A1714',
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(200,93,62,0.35) 0%, rgba(26,23,20,0) 55%)',
        }}
      >
        {/* Brand mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 40 }}>
          <div
            style={{
              width: 120,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #D4845E 0%, #C85D3E 100%)',
              borderRadius: 30,
            }}
          >
            <svg width="76" height="76" viewBox="0 0 24 24" fill="#FBF7F0">
              <path d="M13 2L4.09 12.97a1 1 0 0 0 .77 1.63h5.14v6.43a1 1 0 0 0 1.8.59l8.91-10.97a1 1 0 0 0-.77-1.63h-5.14V2.59A1 1 0 0 0 13 2z" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: '#FBF7F0',
              letterSpacing: '-0.03em',
            }}
          >
            GaeDHD
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#FBF7F0',
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Big goals. Tiny steps. Perfect timing.
        </div>

        <div
          style={{
            fontSize: 30,
            color: '#C8C0B8',
            marginTop: 28,
          }}
        >
          Your ADHD brain&apos;s best friend.
        </div>
      </div>
    ),
    { ...size }
  )
}
