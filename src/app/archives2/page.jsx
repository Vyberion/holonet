import HolocronClient from './HolocronClient'

export default function Archives2Page() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        margin: 0,
        padding: 0,
        background: '#000',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      <HolocronClient />
    </main>
  )
}
