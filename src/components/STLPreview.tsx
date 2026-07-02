"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import * as THREE from "three";

interface PreviewMeshProps {
  heightMap: Float32Array | null;
  width: number;
  height: number;
  params: {
    targetWidth: number;
    maxHeight: number;
    baseThickness: number;
    zScale: number;
    invert: boolean;
  };
}

/** 高度图 → Three.js BufferGeometry 实时预览 */
function PreviewMesh({ heightMap, width, height, params }: PreviewMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (!heightMap) return null;

    const pixelSize = params.targetWidth / width;
    const geo = new THREE.PlaneGeometry(
      params.targetWidth,
      pixelSize * height,
      width - 1,
      height - 1
    );

    const positions = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const z = heightMap[i];
      const h = params.baseThickness + z * params.maxHeight * params.zScale;
      positions.setZ(i, h);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [heightMap, width, height, params]);

  // 自动旋转
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.15;
    }
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color="#a78bfa"
        metalness={0.1}
        roughness={0.6}
        flatShading={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface STLPreviewProps {
  heightMap: Float32Array | null;
  width: number;
  height: number;
  params: PreviewMeshProps["params"];
}

export default function STLPreview({ heightMap, width, height, params }: STLPreviewProps) {
  return (
    <Canvas
      camera={{ position: [80, 80, 80], fov: 45 }}
      style={{ background: "#0a0a0f" }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[50, 80, 30]} intensity={1.5} castShadow />
      <directionalLight position={[-50, 40, -30]} intensity={0.5} />

      {heightMap && (
        <PreviewMesh
          heightMap={heightMap}
          width={width}
          height={height}
          params={params}
        />
      )}

      <Grid
        args={[200, 200]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#2a2a3a"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#4a4a5a"
        fadeDistance={200}
        fadeStrength={1}
        infiniteGrid
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={20}
        maxDistance={300}
      />
    </Canvas>
  );
}
