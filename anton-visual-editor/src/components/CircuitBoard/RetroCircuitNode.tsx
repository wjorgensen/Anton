import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface RetroCircuitNodeProps {
  data: {
    label: string;
    description?: string;
    agent?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
  };
}

export default function RetroCircuitNode({ data }: RetroCircuitNodeProps) {
  const getStatusChar = () => {
    switch (data.status) {
      case 'running': return '>';
      case 'completed': return '✓';
      case 'failed': return '✗';
      default: return '·';
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return '#0080FF';
      case 'completed': return '#FFFFFF';
      case 'failed': return '#0080FF';
      default: return '#666666';
    }
  };

  return (
    <div style={{
      background: '#000000',
      border: '2px solid #FFFFFF',
      padding: '0',
      minWidth: '240px',
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      position: 'relative',
      boxShadow: '4px 4px 0px #0080FF'
    }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#0080FF',
          border: '2px solid #FFFFFF',
          width: '12px',
          height: '12px',
          top: '-7px'
        }}
      />
      
      {/* Title Bar */}
      <div style={{
        background: data.status === 'running' ? '#0080FF' : '#000000',
        borderBottom: '2px solid #FFFFFF',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{
          fontWeight: 'bold',
          textTransform: 'uppercase',
          color: data.status === 'running' ? '#000000' : '#FFFFFF'
        }}>
          {data.label}
        </span>
        <span style={{ 
          color: data.status === 'running' ? '#000000' : getStatusColor(),
          fontWeight: 'bold'
        }}>
          [{getStatusChar()}]
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '8px' }}>
        {data.agent && (
          <div style={{ color: '#0080FF', marginBottom: '4px' }}>
            AGENT: {data.agent.toUpperCase()}
          </div>
        )}
        
        {data.description && (
          <div style={{ color: '#FFFFFF', fontSize: '11px' }}>
            {data.description}
          </div>
        )}

        {data.status === 'running' && data.progress !== undefined && (
          <div style={{ marginTop: '8px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              border: '1px solid #FFFFFF',
              background: '#000000'
            }}>
              <div style={{
                width: `${data.progress}%`,
                height: '100%',
                background: '#0080FF'
              }} />
            </div>
            <div style={{ 
              color: '#0080FF', 
              fontSize: '10px',
              marginTop: '2px',
              textAlign: 'right'
            }}>
              {data.progress}%
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#0080FF',
          border: '2px solid #FFFFFF',
          width: '12px',
          height: '12px',
          bottom: '-7px'
        }}
      />
    </div>
  );
}