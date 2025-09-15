import React, { useState, useEffect } from 'react';

// Decorative Status Bar Buffer Component
const StatusBarBuffer = () => {
    const [glowIntensity, setGlowIntensity] = useState(0.5);

    useEffect(() => {
        const interval = setInterval(() => {
            setGlowIntensity(Math.random() * 0.5 + 0.5);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            height: '120px', // 2-3 status bar heights
            background: `
                linear-gradient(135deg,
                    rgba(0, 20, 40, 0.95) 0%,
                    rgba(0, 40, 80, 0.9) 25%,
                    rgba(0, 60, 120, 0.85) 50%,
                    rgba(0, 40, 80, 0.9) 75%,
                    rgba(0, 20, 40, 0.95) 100%
                )
            `,
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '3px solid rgba(0, 255, 255, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Central Brand Element */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                zIndex: 2
            }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    background: `
                        radial-gradient(circle,
                            rgba(46, 139, 87, 0.8) 0%,
                            rgba(34, 139, 34, 0.6) 50%,
                            rgba(0, 40, 80, 0.9) 100%
                        )
                    `,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(46, 139, 87, 0.5)',
                    boxShadow: `0 0 25px rgba(46, 139, 87, ${glowIntensity})`,
                    animation: 'pulse 2s ease-in-out infinite'
                }}>
                    <span style={{
                        fontSize: '24px',
                        filter: 'drop-shadow(0 0 8px rgba(46, 139, 87, 0.8))'
                    }}>🧪</span>
                </div>
                
                <div style={{
                    color: '#2E8B57',
                    fontFamily: "'Orbitron', monospace",
                    fontSize: '20px',
                    fontWeight: 'bold',
                    textShadow: `0 0 15px rgba(46, 139, 87, ${glowIntensity})`,
                    letterSpacing: '2px',
                    textTransform: 'uppercase'
                }}>
                    MolView - Molecular Viewer
                </div>
                
                <div style={{
                    width: '50px',
                    height: '50px',
                    background: `
                        radial-gradient(circle,
                            rgba(46, 139, 87, 0.8) 0%,
                            rgba(34, 139, 34, 0.6) 50%,
                            rgba(0, 40, 80, 0.9) 100%
                        )
                    `,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(46, 139, 87, 0.5)',
                    boxShadow: `0 0 25px rgba(46, 139, 87, ${glowIntensity})`,
                    animation: 'pulse 2s ease-in-out infinite 0.5s'
                }}>
                    <span style={{
                        fontSize: '24px',
                        filter: 'drop-shadow(0 0 8px rgba(46, 139, 87, 0.8))'
                    }}>⚛️</span>
                </div>
            </div>

            {/* Corner Tech Elements */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                width: '15px',
                height: '15px',
                border: '2px solid rgba(46, 139, 87, 0.6)',
                borderRight: 'none',
                borderBottom: 'none',
                borderRadius: '3px 0 0 0'
            }} />
            
            <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                width: '15px',
                height: '15px',
                border: '2px solid rgba(46, 139, 87, 0.6)',
                borderLeft: 'none',
                borderTop: 'none',
                borderRadius: '0 0 3px 0'
            }} />
        </div>
    );
};

interface MolViewProps {
  isVisible: boolean;
  onClose: () => void;
}

export const MolView: React.FC<MolViewProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'white',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Status Bar Buffer - Always Present */}
      <StatusBarBuffer />
      
      {/* Header with close button */}
      <div style={{
        height: '50px',
        backgroundColor: '#2E8B57',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold'
      }}>
        <span>🧪 MolView - Molecular Viewer</span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* MolView iframe */}
      <iframe
        src="/molview/index.html"
        style={{
          width: '100%',
          height: 'calc(100vh - 170px)', // Account for StatusBarBuffer (120px) + header (50px)
          border: 'none',
          backgroundColor: 'white'
        }}
        title="MolView Molecular Viewer"
        allow="fullscreen"
      />
    </div>
  );
};