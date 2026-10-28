interface RequestStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  loading?: boolean;
}

export function RequestState({ title, description, onRetry, loading = false }: RequestStateProps) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[#eee] bg-[#fafafa] px-6 py-16 text-center"
      role={onRetry ? "alert" : "status"}
      aria-live="polite"
      aria-busy={loading}
    >
      {loading && <span className="mb-5 size-8 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#111] motion-reduce:animate-none" aria-hidden="true" />}
      <p className="text-lg font-semibold text-[#333]">{title}</p>
      {description && <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#777]">{description}</p>}
      {onRetry && (
        <button className="mt-6 rounded-lg bg-[#111] px-5 py-3 text-sm font-medium text-white hover:bg-[#333]" type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
