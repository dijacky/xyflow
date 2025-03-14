'use client'
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlowProvider,
  useNodes,
  useEdges,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Panel,
  ReactFlow,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange
} from '@xyflow/react';

type HistoryState = {
  nodes: Node[];
  edges: Edge[];
};

const nodeStyles = {
  padding: 10,
  fontSize: 14,
  borderRadius: 5,
  width: 150,
  color: 'white',
  textAlign: 'center' as const,
  border: '2px solid transparent',
  transition: 'all 0.2s'
};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'default',
    position: { x: 100, y: 50 },
    data: { label: '开始节点' },
    style: { ...nodeStyles, background: '#4CAF50' }
  },
  {
    id: 'process',
    type: 'default',
    position: { x: 400, y: 200 },
    data: { label: '处理节点' },
    style: { ...nodeStyles, background: '#2196F3', width: 180 }
  },
  {
    id: 'end',
    type: 'default',
    position: { x: 700, y: 50 },
    data: { label: '结束节点' },
    style: { ...nodeStyles, background: '#FF5722' }
  }
];

const initialEdges: Edge[] = [
  {
    id: 'e1',
    source: 'start',
    target: 'process',
    animated: true,
    style: { stroke: '#64B5F6', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#64B5F6' }
  },
  {
    id: 'e2',
    source: 'process',
    target: 'end',
    animated: true,
    style: { stroke: '#64B5F6', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#64B5F6' }
  }
];

const useHistoryManager = () => {
  const history = useRef<HistoryState[]>([]);
  const currentIndex = useRef(-1);
  const isTransacting = useRef(false);

  const addState = useCallback((state: HistoryState) => {
    if (!state.nodes || !state.edges) {
      console.error('Invalid state:', state);
      return;
    }

    history.current = [
      ...history.current.slice(0, currentIndex.current + 1),
      {
        nodes: state.nodes.map(n => ({ ...n })), // 深拷贝节点
        edges: [...state.edges] // 浅拷贝边
      }
    ].slice(-50);
    currentIndex.current = history.current.length - 1;
  }, []);

  const initialize = useCallback((initialState: HistoryState) => {
    history.current = [{
      nodes: initialState.nodes.map(n => ({ ...n })),
      edges: [...initialState.edges]
    }];
    currentIndex.current = 0;
  }, []);

  const undo = useCallback(() => {
    if (currentIndex.current > 0) {
      currentIndex.current--;
      return history.current[currentIndex.current];
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (currentIndex.current < history.current.length - 1) {
      currentIndex.current++;
      return history.current[currentIndex.current];
    }
    return null;
  }, []);

  const startTransaction = useCallback(() => {
    isTransacting.current = true;
  }, []);

  const endTransaction = useCallback((state: HistoryState) => {
    isTransacting.current = false;
    addState(state);
  }, [addState]);

  return {
    getCurrentIndex: () => currentIndex.current,
    getHistoryLength: () => history.current.length,
    initialize,
    addState,
    undo,
    redo,
    startTransaction,
    endTransaction,
    getCurrentState: () => history.current[currentIndex.current],
    getTimeline: () => history.current.map((state, i) => ({
      id: i,
      active: i === currentIndex.current,
      state: {
        nodes: state.nodes.map(n => ({ ...n })), // 返回新对象
        edges: [...state.edges]
      }
    }))
  };
};

const FlowComponent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();
  
  const history = useHistoryManager();
  const isDragging = useRef(false);

  // 同步初始化
  useEffect(() => {
    history.initialize({ nodes, edges });
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, []);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    console.log(changes)
    const dragging = changes.some(c => c.type === 'position' && c.dragging);
    
    if (dragging && !isDragging.current) {
      history.startTransaction();
      isDragging.current = true;
    }

    onNodesChange(changes);
  }, [onNodesChange, history]);

  const handleDragEnd = useCallback(() => {
    if (isDragging.current) {
      history.endTransaction({ nodes, edges });
      isDragging.current = false;
    }
  }, [nodes, edges, history]);

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    history.addState({ nodes, edges });
  }, [nodes, edges, onEdgesChange, history]);

  const handleHistory = useCallback((action: 'undo' | 'redo') => {
    const state = action === 'undo' ? history.undo() : history.redo();
    if (state) {
      setNodes(state.nodes.map(n => ({ ...n })));
      setEdges([...state.edges]);
    }
  }, [setNodes, setEdges, history]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    console.log(e)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      handleHistory('undo');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleHistory('redo');
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const moveStep = e.shiftKey ? 20 : 5;
      const updatedNodes = nodes.map(node => {
        if (!node.selected) return node;
        return {
          ...node,
          position: {
            x: node.position.x + (e.key === 'ArrowLeft' ? -moveStep : e.key === 'ArrowRight' ? moveStep : 0),
            y: node.position.y + (e.key === 'ArrowUp' ? -moveStep : e.key === 'ArrowDown' ? moveStep : 0)
          }
        };
      });

      setNodes(updatedNodes);
      history.addState({ nodes: updatedNodes, edges });
    }
  }, [nodes, edges, setNodes, history, handleHistory]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
     console.log(e);
  }, [nodes, edges, setNodes, history, handleHistory]);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStop={handleDragEnd}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        nodeDragThreshold={0}
        fitView
      >
        <Background gap={25} />
        <Controls />
        
        <Panel position="top-center">
          <div style={{ display: 'flex', gap: 8, padding: 10 }}>
            <button 
              onClick={() => handleHistory('undo')}
              disabled={history.getCurrentIndex() === 0}
              style={{ 
                padding: '6px 12px',
                background: history.getCurrentIndex() > 0 ? '#4CAF50' : '#cccccc',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: history.getCurrentIndex() > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Undo (Ctrl+Z)
            </button>
            <button 
              onClick={() => handleHistory('redo')}
              disabled={history.getCurrentIndex() === history.getHistoryLength() - 1}
              style={{ 
                padding: '6px 12px',
                background: history.getCurrentIndex() < history.getHistoryLength() - 1 ? '#2196F3' : '#cccccc',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: history.getCurrentIndex() < history.getHistoryLength() - 1 ? 'pointer' : 'not-allowed'
              }}
            >
              Redo (Ctrl+Y)
            </button>
          </div>
        </Panel>

        <Panel position="bottom-center">
          <div style={{ display: 'flex', gap: 8, padding: 10 }}>
            {history.getTimeline().map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  const { nodes: timelineNodes, edges: timelineEdges } = item.state;
                  if (timelineNodes && timelineEdges) {
                    setNodes(timelineNodes.map(n => ({ ...n })));
                    setEdges([...timelineEdges]);
                  }
                }}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: item.active ? '#4CAF50' : '#ddd',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default () => (
  <ReactFlowProvider>
    <FlowComponent />
  </ReactFlowProvider>
);
