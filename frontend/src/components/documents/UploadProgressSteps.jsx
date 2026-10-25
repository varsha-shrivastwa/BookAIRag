'use client';

import React from 'react';
import { Check } from 'lucide-react';

const STAGES = [
  { key: 'uploading',  label: 'Uploading document' },
  { key: 'extracting', label: 'Extracting content' },
  { key: 'analyzing',  label: 'Analyzing structure' },
  { key: 'indexing',   label: 'Indexing document' },
  { key: 'ready',      label: 'Document ready' },
];

function stageIndex(stage) {
  return STAGES.findIndex((s) => s.key === stage);
}

export function UploadProgressSteps({ currentStage, isError, indexingProgress }) {
  const current = stageIndex(currentStage);

  return (
    <div style={{ padding: '12px 0' }}>
      {STAGES.map((stage, idx) => {
        const done   = idx < current || currentStage === 'ready';
        const active = idx === current && currentStage !== 'ready' && !isError;
        const isIndexingStage = stage.key === 'indexing' && active;

        let circleStyle = {
          width: '22px', height: '22px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, flexShrink: 0,
          transition: 'all 0.3s',
        };

        if (done) {
          Object.assign(circleStyle, {
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
          });
        } else if (active) {
          Object.assign(circleStyle, {
            background: 'rgba(124,58,237,0.15)',
            border: '2px solid #7c3aed', color: '#c4b5fd',
            animation: 'pulse 1.4s ease-in-out infinite',
          });
        } else {
          Object.assign(circleStyle, {
            background: 'rgba(255,255,255,0.04)',
            border: '2px solid rgba(255,255,255,0.12)', color: '#4b5563',
          });
        }

        return (
          <div key={stage.key} style={{ marginBottom: isIndexingStage && indexingProgress ? '12px' : '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={circleStyle}>
                {done ? <Check size={12} strokeWidth={3} /> : <span>{idx + 1}</span>}
              </div>
              <span style={{
                fontSize: '12px', fontWeight: active ? 600 : 400, flex: 1,
                color: done ? '#a78bfa' : active ? '#c4b5fd' : '#4b5563',
                transition: 'color 0.3s',
              }}>
                {stage.label}
              </span>

              {/* Dots spinner for non-indexing active stages */}
              {active && !isIndexingStage && (
                <span style={{ display: 'flex', gap: '3px' }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{
                      width: '4px', height: '4px', borderRadius: '50%', background: '#a78bfa',
                      animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite`,
                    }} />
                  ))}
                </span>
              )}

              {/* Percentage badge for indexing when progress is available */}
              {isIndexingStage && indexingProgress && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                  color: '#a78bfa', flexShrink: 0,
                }}>
                  {indexingProgress.percent}%
                </span>
              )}
            </div>

            {/* Progress bar + chunk counter — only during indexing */}
            {isIndexingStage && indexingProgress && (
              <div style={{ paddingLeft: '32px', marginTop: '6px' }}>
                {/* Track */}
                <div style={{
                  height: '4px', borderRadius: '9999px',
                  background: 'rgba(124,58,237,0.15)', overflow: 'hidden',
                }}>
                  {/* Fill */}
                  <div style={{
                    height: '100%', borderRadius: '9999px',
                    width: `${indexingProgress.percent}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #6366f1)',
                    transition: 'width 0.4s ease',
                    boxShadow: '0 0 6px rgba(124,58,237,0.5)',
                  }} />
                </div>
                {/* Chunk counter */}
                <p style={{
                  fontSize: '10px', color: '#6b7280', margin: '3px 0 0',
                  fontFamily: 'monospace',
                }}>
                  {indexingProgress.indexed.toLocaleString()} / {indexingProgress.total.toLocaleString()} chunks indexed
                </p>
              </div>
            )}
          </div>
        );
      })}

      {isError && (
        <div style={{
          marginTop: '4px', padding: '8px 10px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: '11px',
        }}>
          Processing failed. Please try again.
        </div>
      )}
    </div>
  );
}
