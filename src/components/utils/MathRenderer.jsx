import React from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

/**
 * MathRenderer component
 * Parses text for $...$ (inline) and $$...$$ (block) math and renders with KaTeX
 * Falls back to plain text for non-math content
 */
export default function MathRenderer({ text }) {
  if (!text) return null;

  // Split by $$ first (block math has priority)
  const blockSplit = text.split(/(\$\$.*?\$\$)/s);

  return (
    <>
      {blockSplit.map((segment, blockIdx) => {
        // Check if this segment is block math
        if (segment.startsWith("$$") && segment.endsWith("$$")) {
          const mathContent = segment.slice(2, -2);
          return (
            <div key={blockIdx} className="katex-display-wrapper">
              <BlockMath math={mathContent} />
            </div>
          );
        }

        // Process inline math within non-block segments
        const inlineSplit = segment.split(/(\$[^\$]+\$)/);
        return (
          <span key={blockIdx} className="inline">
            {inlineSplit.map((part, inlineIdx) => {
              if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
                const mathContent = part.slice(1, -1);
                return (
                  <span key={`${blockIdx}-${inlineIdx}`} className="inline katex-inline-wrapper">
                    <InlineMath math={mathContent} />
                  </span>
                );
              }
              return (
                <span key={`${blockIdx}-${inlineIdx}`}>
                  {part}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}