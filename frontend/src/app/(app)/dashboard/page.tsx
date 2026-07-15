'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { dashboardApi } from '@/lib/services';
import type { DashboardMetrics, DashboardSummary } from '@/lib/types';

function MetricsGrid({
  metrics,
  prefix,
  tasksLabel,
  personal,
}: {
  metrics: DashboardMetrics;
  prefix: string;
  tasksLabel: string;
  personal: boolean;
}) {
  const cards = personal
    ? [
        { label: 'My Open Cases', value: metrics.openCases, color: 'text-blue-600' },
        { label: 'My Active Contracts', value: metrics.activeContracts, color: 'text-green-600' },
        { label: 'My Pending Notices', value: metrics.pendingNotices, color: 'text-yellow-600' },
        { label: 'My Overdue Deadlines', value: metrics.overdueDeadlines, color: 'text-red-600' },
        { label: 'My Deadlines Today', value: metrics.todayDeadlines, color: 'text-orange-600' },
        { label: tasksLabel, value: metrics.myOpenTasks, color: 'text-purple-600' },
      ]
    : [
        { label: 'Open Cases', value: metrics.openCases, color: 'text-blue-600' },
        { label: 'Active Contracts', value: metrics.activeContracts, color: 'text-green-600' },
        { label: 'Pending Notices', value: metrics.pendingNotices, color: 'text-yellow-600' },
        { label: 'Overdue Deadlines', value: metrics.overdueDeadlines, color: 'text-red-600' },
        { label: 'Today Deadlines', value: metrics.todayDeadlines, color: 'text-orange-600' },
        { label: tasksLabel, value: metrics.myOpenTasks, color: 'text-purple-600' },
      ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={`${prefix}-${card.label}`} className="card">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .summary()
      .then((res) => setSummary(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Organization-wide and personal legal operations summary"
      />

      {summary.canViewAll && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">All</h2>
          <MetricsGrid
            metrics={summary.all}
            prefix="all"
            tasksLabel="Open Tasks"
            personal={false}
          />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My Work</h2>
        <MetricsGrid
          metrics={summary.my}
          prefix="my"
          tasksLabel="My Open Tasks"
          personal={true}
        />
      </section>
    </div>
  );
}
