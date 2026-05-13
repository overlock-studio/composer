'use client';
import React, { createContext, useContext } from 'react';
import {
  MonitoringAreaContextType,
  MonitoringAreaProviderProps,
} from '../../../lib/types';
import { Edge, Node, useEdgesState, useNodesState } from '@xyflow/react';

const MonitoringAreaContext = createContext<MonitoringAreaContextType>({
  nodes: [],
  setNodes: () => undefined,
  onNodesChange: () => undefined,
  edges: [],
  setEdges: () => undefined,
  onEdgesChange: () => undefined,
});

export const MonitoringAreaProvider: React.FC<MonitoringAreaProviderProps> = ({
  children,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  return (
    <MonitoringAreaContext.Provider
      value={{
        nodes,
        setNodes,
        onNodesChange,
        edges,
        setEdges,
        onEdgesChange,
      }}
    >
      {children}
    </MonitoringAreaContext.Provider>
  );
};

export const useMonitoringAreaContext = (): MonitoringAreaContextType => {
  return useContext(MonitoringAreaContext);
};

export default MonitoringAreaContext;
