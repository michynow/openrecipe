"use client";

/**
 * A submit button that asks first (OR-50).
 *
 * `window.confirm` rather than a styled dialog: removing a Member and deleting a
 * Tag are Master-only actions taken once in a blue moon, and a focus-trapped
 * modal for them would be more code to maintain than the thing it guards. The
 * Recipe delete dialog is the one that earned its own component — it is the one
 * every Member meets.
 */
export function ConfirmButton({
  message,
  children,
  className,
  disabled,
  title,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      title={title}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
