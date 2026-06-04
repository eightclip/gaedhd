import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #D4845E 0%, #C85D3E 100%)',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="#FBF7F0">
          <path d="M13 2L4.09 12.97a1 1 0 0 0 .77 1.63h5.14v6.43a1 1 0 0 0 1.8.59l8.91-10.97a1 1 0 0 0-.77-1.63h-5.14V2.59A1 1 0 0 0 13 2z" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
