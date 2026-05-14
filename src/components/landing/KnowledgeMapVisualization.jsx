import React from 'react';
import { motion } from 'framer-motion';

export default function KnowledgeMapVisualization() {
  // Calculate positions in a radial pattern
  const centerX = 500;
  const centerY = 500;
  const primaryRadius = 280;
  const secondaryRadius = 450;

  // Primary nodes at clock positions
  const primaryNodes = [
  { id: 'foundations', label: 'Foundations', angle: -90, progress: 0.7 },
  { id: 'cells', label: 'Cells', angle: -30, progress: 0.5 },
  { id: 'genetics', label: 'Genetics', angle: 30, progress: 0.3 },
  { id: 'evolution', label: 'Evolution', angle: 90, progress: 0.8 },
  { id: 'ecology', label: 'Ecology', angle: 150, progress: 0.6 },
  { id: 'human', label: 'Human', angle: 210, progress: 0.4 }];


  // Secondary nodes (visible)
  const secondaryNodes = [
  { label: 'Biochemistry', parentAngle: -90, offset: -15, visible: true },
  { label: 'Water', parentAngle: -90, offset: 15, visible: true },
  { label: 'Body', parentAngle: 210, offset: -15, visible: true },
  { label: 'Disease', parentAngle: 210, offset: 15, visible: true },
  { label: 'Energy', parentAngle: 150, offset: -15, visible: true },
  { label: 'Populations', parentAngle: 150, offset: 15, visible: true },
  { label: 'Membrane', parentAngle: -30, offset: -15, visible: true },
  { label: 'Structure', parentAngle: -30, offset: 15, visible: true },
  { label: 'Mendelian', parentAngle: 30, offset: -15, visible: true },
  { label: 'DNA', parentAngle: 30, offset: 15, visible: true },
  { label: 'Natural', parentAngle: 90, offset: -15, visible: true },
  { label: 'Evidence', parentAngle: 90, offset: 15, visible: true }];


  // Faded secondary nodes
  const fadedNodes = [
  { label: 'Scientific', parentAngle: -90, offset: 25 },
  { label: 'Organization', parentAngle: -90, offset: -25 },
  { label: 'Cell', parentAngle: -30, offset: -25 },
  { label: 'Modern', parentAngle: 30, offset: -25 },
  { label: 'Speciation', parentAngle: 60, offset: 0 },
  { label: 'Impact', parentAngle: 120, offset: 0 }];


  const getPosition = (angle, radius) => {
    const rad = angle * Math.PI / 180;
    return {
      x: centerX + Math.cos(rad) * radius,
      y: centerY + Math.sin(rad) * radius
    };
  };

  return (
    <svg viewBox="0 0 1000 1000" className="w-full h-auto" style={{ transform: 'scale(0.98)' }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lines from center to primary nodes */}
      {primaryNodes.map((node, i) => {
        const pos = getPosition(node.angle, primaryRadius);
        return (
          <motion.line
            key={`line-primary-${i}`}
            x1={centerX}
            y1={centerY}
            x2={pos.x}
            y2={pos.y}
            stroke="#60A5FA"
            strokeWidth="3.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: i * 0.1 }} />);


      })}

      {/* Lines from primary to secondary nodes */}
      {secondaryNodes.map((node, i) => {
        const primaryPos = getPosition(node.parentAngle, primaryRadius);
        const secondaryPos = getPosition(node.parentAngle + node.offset, secondaryRadius);
        return (
          <motion.line
            key={`line-secondary-${i}`}
            x1={primaryPos.x}
            y1={primaryPos.y}
            x2={secondaryPos.x}
            y2={secondaryPos.y}
            stroke="#60A5FA"
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.8 + i * 0.05 }} />);


      })}

      {/* Lines to faded nodes */}
      {fadedNodes.map((node, i) => {
        const primaryPos = getPosition(node.parentAngle, primaryRadius);
        const secondaryPos = getPosition(node.parentAngle + node.offset, secondaryRadius);
        return null;











      })}

      {/* Central Biology node */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}>

        <circle
          cx={centerX}
          cy={centerY}
          r="90"
          fill="#2563EB"
          filter="url(#glow)" />

        <text
          x={centerX}
          y={centerY + 8}
          textAnchor="middle"
          fill="white"
          fontSize="32"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif">

          Biology
        </text>
      </motion.g>

      {/* Primary nodes */}
      {primaryNodes.map((node, i) => {
        const pos = getPosition(node.angle, primaryRadius);
        return (
          <motion.g
            key={`primary-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}>

            <circle
              cx={pos.x}
              cy={pos.y}
              r="60"
              fill="white"
              stroke="#1E40AF"
              strokeWidth="4" />

            <text
              x={pos.x}
              y={pos.y - 5}
              textAnchor="middle"
              fill="#2563EB"
              fontSize="18"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif">

              {node.label}
            </text>
            {/* Progress bar */}
            <rect
              x={pos.x - 35}
              y={pos.y + 15}
              width="70"
              height="6"
              rx="3"
              fill="#E5E7EB" />

            <rect
              x={pos.x - 35}
              y={pos.y + 15}
              width={70 * node.progress}
              height="6"
              rx="3"
              fill="#93C5FD" />

          </motion.g>);

      })}

      {/* Secondary nodes (visible) */}
      {secondaryNodes.map((node, i) => {
        const pos = getPosition(node.parentAngle + node.offset, secondaryRadius);
        return (
          <motion.g
            key={`secondary-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 1 + i * 0.05 }}>

            <circle
              cx={pos.x}
              cy={pos.y}
              r="40"
              fill="white"
              stroke="#1E40AF"
              strokeWidth="3" />

            <text
              x={pos.x}
              y={pos.y + 5}
              textAnchor="middle"
              fill="#60A5FA"
              fontSize="9"
              fontWeight="500"
              fontFamily="system-ui, -apple-system, sans-serif">

              {node.label}
            </text>
          </motion.g>);

      })}


    </svg>);

}