interface LoadingSpinnerProps {
  /**
   * Size of the spinner
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Optional text to display next to spinner
   */
  text?: string;

  /**
   * Whether to center the spinner in a container
   * @default false
   */
  centered?: boolean;

  /**
   * Minimum height when centered
   * @default "min-h-96"
   */
  minHeight?: string;

  /**
   * Optional custom className
   */
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
};

/**
 * LoadingSpinner - Reusable loading indicator
 *
 * @example
 * <LoadingSpinner size="md" text="Loading dashboard..." centered />
 */
export function LoadingSpinner({
  size = "md",
  text,
  centered = false,
  minHeight = "min-h-96",
  className = "",
}: LoadingSpinnerProps) {
  const spinnerClasses = `inline-block animate-spin rounded-full border-solid border-blue-600 border-r-transparent ${sizeMap[size]}`;

  const content = (
    <div className={`flex items-center ${centered ? "justify-center" : ""}`}>
      <div className={spinnerClasses}></div>
      {text && <p className="ml-3 text-gray-600">{text}</p>}
    </div>
  );

  if (centered) {
    return (
      <div className={`flex items-center justify-center ${minHeight} ${className}`}>
        <div className="text-center">{content}</div>
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}
