import type { GraphResponse, Finding, ScanEvent, BenchmarkData } from '../types';

export const apiClient = {
  async getHealth(): Promise<{ status: string }> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
    return res.json();
  },

  async getGraph(): Promise<GraphResponse> {
    const res = await fetch('/api/graph');
    if (!res.ok) throw new Error(`Failed to load graph: HTTP ${res.status}`);
    return res.json();
  },

  async importSpec(file?: File, rawSpec?: string): Promise<{ status: string; operations_count: number }> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (rawSpec) {
      formData.append('raw_spec', rawSpec);
    }
    const res = await fetch('/api/spec/import', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Import failed' }));
      throw new Error(err.detail || 'Import failed');
    }
    return res.json();
  },

  async triggerScan(options: { dry_run?: boolean; budget?: number; enable_mutations?: boolean }): Promise<{ scan_id: string }> {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(`Failed to start scan: HTTP ${res.status}`);
    return res.json();
  },

  subscribeScanEvents(
    scanId: string,
    onEvent: (event: ScanEvent) => void,
    onComplete: () => void,
    onError: (err: any) => void
  ): () => void {
    const eventSource = new EventSource(`/api/scan/${scanId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const event: ScanEvent = JSON.parse(e.data);
        onEvent(event);
        if (event.event_type === 'scan_completed') {
          eventSource.close();
          onComplete();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      eventSource.close();
      onError(err);
    };

    return () => {
      eventSource.close();
    };
  },

  async getFindings(): Promise<Finding[]> {
    const res = await fetch('/api/findings');
    if (!res.ok) throw new Error(`Failed to load findings: HTTP ${res.status}`);
    return res.json();
  },

  async resetTarget(): Promise<{ status: string }> {
    const res = await fetch('/api/target/reset', { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to reset target: HTTP ${res.status}`);
    return res.json();
  },

  async getLatestBenchmark(): Promise<BenchmarkData> {
    const res = await fetch('/api/benchmark/latest');
    if (!res.ok) throw new Error(`Failed to load benchmark: HTTP ${res.status}`);
    return res.json();
  },

  async runBenchmark(): Promise<BenchmarkData> {
    const res = await fetch('/api/benchmark/run', { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to run benchmark: HTTP ${res.status}`);
    return res.json();
  }
};
