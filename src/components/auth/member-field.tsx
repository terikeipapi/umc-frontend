import { useId, type ComponentProps } from "react";

type MemberFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function MemberField({ label, error, hint, id, className = "", ...props }: MemberFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description = error || hint;
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        className={`field-input ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={description ? `${inputId}-description` : undefined}
      />
      {description && (
        <p id={`${inputId}-description`} className={error ? "field-error" : "field-hint"} aria-live="polite">{description}</p>
      )}
    </div>
  );
}
