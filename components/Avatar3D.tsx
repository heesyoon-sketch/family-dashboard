'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';

export type Avatar3DMood = 'happy' | 'idle' | 'sleepy';
export type Avatar3DSize = 'sm' | 'md' | 'lg';

type Avatar3DProps = {
  mood?: Avatar3DMood;
  size?: Avatar3DSize;
  completedToday?: boolean;
};

const SCALE_BY_SIZE: Record<Avatar3DSize, number> = {
  sm: 0.88,
  md: 1,
  lg: 1.12,
};

const PALETTE_BY_MOOD: Record<Avatar3DMood, { body: string; head: string; accent: string; cheek: string }> = {
  happy: {
    body: '#7dd3fc',
    head: '#fde68a',
    accent: '#34d399',
    cheek: '#fb7185',
  },
  idle: {
    body: '#a7f3d0',
    head: '#fef3c7',
    accent: '#60a5fa',
    cheek: '#fda4af',
  },
  sleepy: {
    body: '#c4b5fd',
    head: '#f5d0fe',
    accent: '#93c5fd',
    cheek: '#f0abfc',
  },
};

function AvatarFigure({ mood, size, completedToday }: Required<Avatar3DProps>) {
  const groupRef = useRef<Group>(null);
  const eyeGroupRef = useRef<Group>(null);
  const palette = PALETTE_BY_MOOD[mood];
  const scale = SCALE_BY_SIZE[size];

  const pose = useMemo(() => {
    if (mood === 'happy') return { mouthY: -0.36, mouthScale: [0.16, 0.08, 0.02] as const, armLift: 0.5 };
    if (mood === 'sleepy') return { mouthY: -0.38, mouthScale: [0.11, 0.025, 0.02] as const, armLift: -0.08 };
    return { mouthY: -0.37, mouthScale: [0.12, 0.05, 0.02] as const, armLift: 0.12 };
  }, [mood]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const figure = groupRef.current;
    if (!figure) return;

    const idleFloat = Math.sin(t * 1.8) * 0.045;
    const celebration = completedToday ? Math.max(0, Math.sin(t * 5.8)) * 0.12 : 0;

    figure.position.y = idleFloat + celebration;
    figure.rotation.y = Math.sin(t * 0.75) * 0.16;
    figure.rotation.z = Math.sin(t * 1.1) * 0.035;

    const blinkPhase = t % (mood === 'sleepy' ? 2.2 : 3.4);
    const eyes = eyeGroupRef.current;
    if (eyes) eyes.scale.y = blinkPhase < 0.12 ? 0.12 : mood === 'sleepy' ? 0.45 : 1;
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, -0.1, 0]}>
      <mesh position={[0, -0.38, 0]} rotation={[0, 0, 0]}>
        <capsuleGeometry args={[0.36, 0.58, 4, 12]} />
        <meshStandardMaterial color={palette.body} roughness={0.72} />
      </mesh>

      <mesh position={[-0.48, -0.42 + pose.armLift * 0.04, 0.02]} rotation={[0, 0, -0.5 - pose.armLift]}>
        <capsuleGeometry args={[0.08, 0.38, 3, 8]} />
        <meshStandardMaterial color={palette.accent} roughness={0.78} />
      </mesh>
      <mesh position={[0.48, -0.42 + pose.armLift * 0.04, 0.02]} rotation={[0, 0, 0.5 + pose.armLift]}>
        <capsuleGeometry args={[0.08, 0.38, 3, 8]} />
        <meshStandardMaterial color={palette.accent} roughness={0.78} />
      </mesh>

      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.44, 18, 14]} />
        <meshStandardMaterial color={palette.head} roughness={0.66} />
      </mesh>

      <group ref={eyeGroupRef}>
        <mesh position={[-0.15, 0.36, 0.39]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color="#263238" roughness={0.8} />
        </mesh>
        <mesh position={[0.15, 0.36, 0.39]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color="#263238" roughness={0.8} />
        </mesh>
      </group>

      <mesh position={[0, pose.mouthY + 0.66, 0.405]} scale={pose.mouthScale}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.82} />
      </mesh>

      <mesh position={[-0.24, 0.24, 0.38]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color={palette.cheek} roughness={0.9} transparent opacity={0.64} />
      </mesh>
      <mesh position={[0.24, 0.24, 0.38]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color={palette.cheek} roughness={0.9} transparent opacity={0.64} />
      </mesh>

      <mesh position={[0, -0.86, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export default function Avatar3D({
  mood = 'idle',
  size = 'md',
  completedToday = false,
}: Avatar3DProps) {
  return (
    <Canvas
      aria-label={`${mood} 3D avatar`}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera makeDefault position={[0, 0.05, 3.25]} fov={34} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[2, 3, 4]} intensity={1.35} />
      <AvatarFigure mood={mood} size={size} completedToday={completedToday} />
    </Canvas>
  );
}
