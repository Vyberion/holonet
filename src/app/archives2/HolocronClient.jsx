'use client'

import dynamic from "next/dynamic"

const HolocronViewer = dynamic(
  () => import("../../components/HolocronViewer.jsx"),
  {
    ssr: false,
    loading: () => (
      <p style={{ color: '#8b0000', fontFamily: 'monospace' }}>
        INITIALISING HOLOCRON...
      </p>
    )
  }
)

export default function HolocronClient() {
  return <HolocronViewer />
}