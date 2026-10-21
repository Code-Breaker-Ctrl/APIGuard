import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { BackendNode, BackendEdge } from '../types';

export function useGraph() {
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [edges, setEdges] = useState<BackendEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getGraph();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importSpec = useCallback(async (file?: File, rawSpec?: string) => {
    setIsLoading(true);
    try {
      await apiClient.importSpec(file, rawSpec);
      await loadGraph();
    } finally {
      setIsLoading(false);
    }
  }, [loadGraph]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return { nodes, edges, isLoading, error, loadGraph, importSpec };
}
