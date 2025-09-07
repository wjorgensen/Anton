import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [planningStatus, setPlanningStatus] = useState('');
  const [planData, setPlanData] = useState<any>(null);
  const [asciiVisualization, setAsciiVisualization] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Setup SSE connection for real-time updates
    const setupEventSource = () => {
      const eventSource = new EventSource('http://localhost:3001/api/webhooks/stream');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebhookEvent(data);
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
      };
    };

    // Uncomment when SSE endpoint is available
    // setupEventSource();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleWebhookEvent = (event: any) => {
    setWebhookEvents(prev => [...prev, event]);
    
    if (event.event === 'plan.step') {
      const stepMessages: { [key: string]: string } = {
        'validating': '🔍 Validating project description...',
        'project-created': '📁 Creating project structure...',
        'planning': '🧠 Generating execution plan...',
        'reviewing': '🔄 Reviewing and optimizing plan...'
      };
      setPlanningStatus(stepMessages[event.data.step] || event.data.message);
    } else if (event.event === 'plan.completed') {
      setPlanningStatus('✅ Planning completed!');
      // Fetch the complete plan
      fetchPlan(event.data.sessionId);
    } else if (event.event === 'plan.failed') {
      setPlanningStatus(`❌ Planning failed: ${event.data.error}`);
      setLoading(false);
    }
  };

  const fetchPlan = async (sessionId: string) => {
    try {
      // This endpoint would need to be implemented to fetch the plan
      const response = await fetch(`http://localhost:3001/api/planning/plan/${sessionId}`);
      const data = await response.json();
      setPlanData(data.plan);
      generateAsciiVisualization(data.plan);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching plan:', error);
      setLoading(false);
    }
  };

  const generateAsciiVisualization = (plan: any) => {
    if (!plan || !plan.nodes) return;

    let ascii = '\n═══════════════════════════════════════════════\n';
    ascii += '           ANTON EXECUTION PLAN\n';
    ascii += '═══════════════════════════════════════════════\n\n';

    // Group nodes by type
    const nodesByType: { [key: string]: any[] } = {};
    plan.nodes.forEach((node: any) => {
      if (!nodesByType[node.type]) {
        nodesByType[node.type] = [];
      }
      nodesByType[node.type].push(node);
    });

    // Display nodes grouped by type
    const typeOrder = ['setup', 'execution', 'testing', 'fix-execution', 'integration'];
    const typeSymbols: { [key: string]: string } = {
      'setup': '🔧',
      'execution': '⚡',
      'testing': '🧪',
      'fix-execution': '🔨',
      'integration': '🔗'
    };

    typeOrder.forEach(type => {
      if (nodesByType[type] && nodesByType[type].length > 0) {
        ascii += `\n${typeSymbols[type]} ${type.toUpperCase()} NODES\n`;
        ascii += '─'.repeat(40) + '\n';
        
        nodesByType[type].forEach((node: any) => {
          ascii += `  ├─ [${node.id}] ${node.label}\n`;
          if (node.dependencies && node.dependencies.length > 0) {
            ascii += `  │  └─ deps: ${node.dependencies.join(', ')}\n`;
          }
        });
      }
    });

    // Display execution flow
    ascii += '\n\n📊 EXECUTION FLOW\n';
    ascii += '─'.repeat(40) + '\n';
    ascii += renderExecutionFlow(plan.executionFlow, '  ');

    ascii += '\n═══════════════════════════════════════════════\n';
    setAsciiVisualization(ascii);
  };

  const renderExecutionFlow = (flow: any, indent: string = ''): string => {
    if (!flow) return '';
    
    let result = '';
    
    if (flow.type === 'node') {
      result += `${indent}└─ ${flow.id}\n`;
    } else if (flow.type === 'sequential') {
      result += `${indent}📦 Sequential:\n`;
      flow.children?.forEach((child: any, index: number) => {
        result += renderExecutionFlow(child, indent + '  ');
      });
    } else if (flow.type === 'parallel') {
      result += `${indent}⚡ Parallel:\n`;
      flow.children?.forEach((child: any, index: number) => {
        result += renderExecutionFlow(child, indent + '  ');
      });
    }
    
    return result;
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setPlanningStatus('Starting planning process...');
    setWebhookEvents([]);
    setPlanData(null);
    setAsciiVisualization('');

    try {
      const response = await fetch('http://localhost:3001/api/planning/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          runFixer: true
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setPlanningStatus(`❌ Error: ${data.error || data.message}`);
        setLoading(false);
        return;
      }

      // Mock webhook events for testing
      setTimeout(() => {
        handleWebhookEvent({ event: 'plan.step', data: { step: 'validating', message: 'Validating project description' }});
      }, 1000);

      setTimeout(() => {
        handleWebhookEvent({ event: 'plan.step', data: { step: 'project-created', message: 'Project created', projectName: data.projectName }});
      }, 2000);

      setTimeout(() => {
        handleWebhookEvent({ event: 'plan.step', data: { step: 'planning', message: 'Generating plan' }});
      }, 3000);

      setTimeout(() => {
        handleWebhookEvent({ event: 'plan.step', data: { step: 'reviewing', message: 'Reviewing plan' }});
      }, 4000);

      setTimeout(() => {
        handleWebhookEvent({ event: 'plan.completed', data: { sessionId: data.sessionId }});
        setPlanData(data.plan);
        generateAsciiVisualization(data.plan);
        setLoading(false);
      }, 5000);

    } catch (error) {
      console.error('Error:', error);
      setPlanningStatus('❌ Failed to connect to backend');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>ANTON PLANNING TEST</h1>
      </div>

      <div className={styles.inputSection}>
        <textarea
          className={styles.promptInput}
          placeholder="Enter your project prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />
        <button 
          className={styles.enterButton}
          onClick={handleSubmit}
          disabled={loading || !prompt.trim()}
        >
          {loading ? 'PROCESSING...' : 'ENTER'}
        </button>
      </div>

      {planningStatus && (
        <div className={styles.statusSection}>
          <h2>Status</h2>
          <div className={styles.status}>{planningStatus}</div>
        </div>
      )}

      {webhookEvents.length > 0 && (
        <div className={styles.webhookSection}>
          <h2>Webhook Events</h2>
          <div className={styles.webhookEvents}>
            {webhookEvents.map((event, index) => (
              <div key={index} className={styles.webhookEvent}>
                <span className={styles.eventType}>[{event.event}]</span>
                <span className={styles.eventData}>{JSON.stringify(event.data)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {asciiVisualization && (
        <div className={styles.visualizationSection}>
          <h2>Plan Visualization</h2>
          <pre className={styles.asciiVisualization}>
            {asciiVisualization}
          </pre>
        </div>
      )}
    </div>
  );
}