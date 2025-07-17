'use client'
import { useEffect, useRef } from 'react'
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'

export default function RiveCharacter() {
  const { RiveComponent } = useRive({
    src: '/rive/phone_girl.riv',
    autoplay: true,
    stateMachines: ['GirlState'], // 👈 đúng tên
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  })

  return <RiveComponent className="w-full h-full" />
}
