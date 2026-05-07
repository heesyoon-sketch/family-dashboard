'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';

export type Avatar3DMood = 'happy' | 'idle' | 'sleepy';
export type Avatar3DSize = 'sm' | 'md' | 'lg';
export type Avatar3DTimeWindow = 'morning' | 'evening';

type Avatar3DProps = {
  mood?: Avatar3DMood;
  size?: Avatar3DSize;
  completedToday?: boolean;
  timeWindow?: Avatar3DTimeWindow;
};

const SCALE_BY_SIZE: Record<Avatar3DSize, number> = {
  sm: 0.88,
  md: 1,
  lg: 1.12,
};

const PALETTE_BY_MOOD: Record<Avatar3DMood, { body: string; head: string; accent: string; cheek: string; belly: string }> = {
  happy: {
    body: '#67e8f9',
    head: '#fde68a',
    accent: '#34d399',
    cheek: '#fb7185',
    belly: '#ecfeff',
  },
  idle: {
    body: '#86efac',
    head: '#fef3c7',
    accent: '#60a5fa',
    cheek: '#fda4af',
    belly: '#f0fdf4',
  },
  sleepy: {
    body: '#c4b5fd',
    head: '#f5d0fe',
    accent: '#93c5fd',
    cheek: '#f0abfc',
    belly: '#eef2ff',
  },
};

const LIGHT_BY_TIME_WINDOW: Record<Avatar3DTimeWindow, {
  ambient: number;
  key: number;
  fill: number;
  keyColor: string;
  fillColor: string;
  bgTop: string;
  bgBottom: string;
  floor: string;
}> = {
  morning: {
    ambient: 1.95,
    key: 1.45,
    fill: 0.7,
    keyColor: '#fff7c2',
    fillColor: '#fed7aa',
    bgTop: '#fef3c7',
    bgBottom: '#bfdbfe',
    floor: '#fde68a',
  },
  evening: {
    ambient: 1.08,
    key: 0.92,
    fill: 0.48,
    keyColor: '#ddd6fe',
    fillColor: '#93c5fd',
    bgTop: '#312e81',
    bgBottom: '#0f172a',
    floor: '#818cf8',
  },
};

function AvatarFigure({ mood, size, completedToday }: Omit<Required<Avatar3DProps>, 'timeWindow'>) {
  const groupRef = useRef<Group>(null);
  const eyeGroupRef = useRef<Group>(null);
  const armGroupRef = useRef<Group>(null);
  const palette = PALETTE_BY_MOOD[mood];
  const scale = SCALE_BY_SIZE[size];

  const pose = useMemo(() => {
    if (mood === 'happy') return { speed: 1.4, float: 0.055, bounce: 0.085, eyeRest: 1, armLift: 0.58 };
    if (mood === 'sleepy') return { speed: 0.55, float: 0.026, bounce: 0.01, eyeRest: 0.44, armLift: -0.08 };
    return { speed: 0.9, float: 0.04, bounce: 0.018, eyeRest: 1, armLift: 0.1 };
  }, [mood]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const figure = groupRef.current;
    if (!figure) return;

    const idleFloat = Math.sin(t * 1.8 * pose.speed) * pose.float;
    const moodBounce = mood === 'happy' ? Math.max(0, Math.sin(t * 4.8)) * pose.bounce : 0;
    const celebration = completedToday ? Math.max(0, Math.sin(t * 5.9)) * 0.11 : 0;

    figure.position.y = idleFloat + moodBounce + celebration;
    figure.rotation.y = Math.sin(t * 0.7 * pose.speed) * (mood === 'sleepy' ? 0.08 : 0.16);
    figure.rotation.z = Math.sin(t * 1.05 * pose.speed) * (mood === 'happy' ? 0.055 : 0.03);

    const arms = armGroupRef.current;
    if (arms) arms.rotation.z = Math.sin(t * 3.2 * pose.speed) * (mood === 'happy' ? 0.06 : 0.025);

    const blinkPhase = t % (mood === 'sleepy' ? 2.2 : 3.4);
    const eyes = eyeGroupRef.current;
    if (eyes) eyes.scale.y = blinkPhase < 0.12 ? 0.12 : pose.eyeRest;
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, -0.1, 0]}>
      <mesh position={[0, -0.38, 0]}>
        <capsuleGeometry args={[0.36, 0.58, 4, 12]} />
        <meshStandardMaterial color={palette.body} roughness={0.72} />
      </mesh>

      <mesh position={[0, -0.34, 0.32]} scale={[0.64, 0.82, 0.16]}>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshStandardMaterial color={palette.belly} roughness={0.8} />
      </mesh>

      <group ref={armGroupRef}>
        <mesh position={[-0.48, -0.42 + pose.armLift * 0.04, 0.02]} rotation={[0, 0, -0.5 - pose.armLift]}>
          <capsuleGeometry args={[0.08, 0.38, 3, 8]} />
          <meshStandardMaterial color={palette.accent} roughness={0.78} />
        </mesh>
        <mesh position={[0.48, -0.42 + pose.armLift * 0.04, 0.02]} rotation={[0, 0, 0.5 + pose.armLift]}>
          <capsuleGeometry args={[0.08, 0.38, 3, 8]} />
          <meshStandardMaterial color={palette.accent} roughness={0.78} />
        </mesh>
      </group>

      <mesh position={[-0.2, -0.78, 0.04]} rotation={[0.08, 0, 0.12]}>
        <capsuleGeometry args={[0.09, 0.22, 3, 8]} />
        <meshStandardMaterial color={palette.accent} roughness={0.82} />
      </mesh>
      <mesh position={[0.2, -0.78, 0.04]} rotation={[0.08, 0, -0.12]}>
        <capsuleGeometry args={[0.09, 0.22, 3, 8]} />
        <meshStandardMaterial color={palette.accent} roughness={0.82} />
      </mesh>

      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.44, 18, 14]} />
        <meshStandardMaterial color={palette.head} roughness={0.66} />
      </mesh>

      <mesh position={[-0.25, 0.62, -0.02]} rotation={[0, 0, 0.7]}>
        <coneGeometry args={[0.13, 0.22, 8]} />
        <meshStandardMaterial color={palette.head} roughness={0.68} />
      </mesh>
      <mesh position={[0.25, 0.62, -0.02]} rotation={[0, 0, -0.7]}>
        <coneGeometry args={[0.13, 0.22, 8]} />
        <meshStandardMaterial color={palette.head} roughness={0.68} />
      </mesh>

      <mesh position={[0, 0.72, 0.04]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.055, 0.2, 7]} />
        <meshStandardMaterial color={palette.accent} roughness={0.7} />
      </mesh>

      <group ref={eyeGroupRef}>
        <mesh position={[-0.15, 0.36, 0.39]}>
          <sphereGeometry args={[0.038, 8, 6]} />
          <meshStandardMaterial color="#263238" roughness={0.8} />
        </mesh>
        <mesh position={[0.15, 0.36, 0.39]}>
          <sphereGeometry args={[0.038, 8, 6]} />
          <meshStandardMaterial color="#263238" roughness={0.8} />
        </mesh>
      </group>

      {mood === 'happy' ? (
        <mesh position={[0, 0.2, 0.41]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.11, 0.012, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.82} />
        </mesh>
      ) : (
        <mesh position={[0, 0.19, 0.405]} scale={mood === 'sleepy' ? [0.1, 0.018, 0.018] : [0.11, 0.045, 0.02]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.82} />
        </mesh>
      )}

      <mesh position={[-0.24, 0.24, 0.38]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color={palette.cheek} roughness={0.9} transparent opacity={0.64} />
      </mesh>
      <mesh position={[0.24, 0.24, 0.38]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color={palette.cheek} roughness={0.9} transparent opacity={0.64} />
      </mesh>

      {mood === 'happy' && (
        <mesh position={[0.32, 0.58, 0.24]} rotation={[0.15, 0.2, 0.22]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial color="#fef08a" roughness={0.55} emissive="#facc15" emissiveIntensity={0.18} />
        </mesh>
      )}

      <mesh position={[0, -0.86, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.46, 24]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function AvatarBackdrop({ timeWindow }: { timeWindow: Avatar3DTimeWindow }) {
  const light = LIGHT_BY_TIME_WINDOW[timeWindow];

  return (
    <group position={[0, 0, -0.72]}>
      <mesh position={[0, 0.04, 0]} scale={[2.2, 1.9, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={light.bgBottom} transparent opacity={0.14} />
      </mesh>
      <mesh position={[-0.56, 0.68, 0.01]}>
        <circleGeometry args={[timeWindow === 'morning' ? 0.2 : 0.13, 22]} />
        <meshBasicMaterial color={timeWindow === 'morning' ? '#facc15' : '#c4b5fd'} transparent opacity={timeWindow === 'morning' ? 0.48 : 0.36} />
      </mesh>
      <mesh position={[0, -0.92, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.26, 0.48, 1]}>
        <circleGeometry args={[0.62, 24]} />
        <meshBasicMaterial color={light.floor} transparent opacity={timeWindow === 'morning' ? 0.16 : 0.11} />
      </mesh>
    </group>
  );
}

export default function Avatar3D({
  mood = 'idle',
  size = 'md',
  completedToday = false,
  timeWindow = 'morning',
}: Avatar3DProps) {
  const light = LIGHT_BY_TIME_WINDOW[timeWindow];

  return (
    <Canvas
      aria-label={`${mood} 3D avatar`}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera makeDefault position={[0, 0.05, 3.25]} fov={34} />
      <color attach="background" args={[light.bgTop]} />
      <ambientLight intensity={light.ambient} color={light.fillColor} />
      <directionalLight position={[2.1, 3.2, 4]} intensity={light.key} color={light.keyColor} />
      <directionalLight position={[-2, 1.4, 2.3]} intensity={light.fill} color={light.fillColor} />
      <AvatarBackdrop timeWindow={timeWindow} />
      <AvatarFigure mood={mood} size={size} completedToday={completedToday} />
    </Canvas>
  );
}
