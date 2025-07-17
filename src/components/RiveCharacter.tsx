'use client'

import { useRive } from '@rive-app/react-canvas'

export default function RiveCharacter() {
  const { RiveComponent } = useRive({
    src: '/rive/no_moon.riv', // đường dẫn đúng
    autoplay: true,
  })

  return <RiveComponent className="w-full h-full" />
}
