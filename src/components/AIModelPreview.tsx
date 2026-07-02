"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Bounds } from "@react-three/drei";
import * as THREE from "three";

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Bounds fit clip observe margin={1.2}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

function LoadingFallback() {
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    let id: number;
    if (ref.current) {
      id = window.setInterval(() => {
        if (ref.current) ref.current.rotation.y += 0.03;
      }, 16);
    }
    return () => clearInterval(id);
  }, []);

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#6366f1" wireframe opacity={0.5} transparent />
    </mesh>
  );
}

interface AIModelPreviewProps {
  modelUrl: string | null;
}

export default function AIModelPreview({ modelUrl }: AIModelPreviewProps) {
  if (!modelUrl) return null;

  return (
    <Canvas
      camera={{ position: [3, 3, 3], fov: 50 }}
      style={{ background: "#0a0a0f" }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <directionalLight position={[0, -3, 3]} intensity={0.2} />

      <Suspense fallback={<LoadingFallback />}>
        <GLBModel url={modelUrl} />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={1}
        maxDistance={20}
      />
    </Canvas>
  );
}
