'use client';

export function LoadingState() {
  return (
    <div className="card text-center text-slate-500">Loading...</div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="alert-error">{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-center text-slate-500">{message}</div>
  );
}
