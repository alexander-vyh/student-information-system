import { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  /**
   * Visual style variant
   * @default "info"
   */
  variant?: AlertVariant;

  /**
   * Alert title/heading
   */
  title?: string;

  /**
   * Alert content
   */
  children: ReactNode;

  /**
   * Optional custom className
   */
  className?: string;

  /**
   * Whether to show the icon
   * @default true
   */
  showIcon?: boolean;
}

const variantConfig: Record<
  AlertVariant,
  {
    containerClass: string;
    borderClass: string;
    iconClass: string;
    titleClass: string;
    contentClass: string;
    icon: typeof AlertCircle;
  }
> = {
  info: {
    containerClass: "bg-blue-50",
    borderClass: "border-blue-500",
    iconClass: "text-blue-500",
    titleClass: "text-blue-800",
    contentClass: "text-blue-700",
    icon: Info,
  },
  success: {
    containerClass: "bg-green-50",
    borderClass: "border-green-500",
    iconClass: "text-green-500",
    titleClass: "text-green-800",
    contentClass: "text-green-700",
    icon: CheckCircle,
  },
  warning: {
    containerClass: "bg-yellow-50",
    borderClass: "border-yellow-500",
    iconClass: "text-yellow-500",
    titleClass: "text-yellow-800",
    contentClass: "text-yellow-700",
    icon: AlertTriangle,
  },
  error: {
    containerClass: "bg-red-50",
    borderClass: "border-red-500",
    iconClass: "text-red-500",
    titleClass: "text-red-800",
    contentClass: "text-red-700",
    icon: AlertCircle,
  },
};

/**
 * Alert - Reusable alert/banner component for notifications
 *
 * @example
 * <Alert variant="error" title="Active Holds">
 *   You have 2 holds blocking registration.
 * </Alert>
 */
export function Alert({
  variant = "info",
  title,
  children,
  className = "",
  showIcon = true,
}: AlertProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={`${config.containerClass} border-l-4 ${config.borderClass} p-4 rounded ${className}`}
    >
      <div className="flex">
        {showIcon && (
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${config.iconClass}`} />
          </div>
        )}
        <div className={showIcon ? "ml-3" : ""}>
          {title && (
            <h3 className={`text-sm font-medium ${config.titleClass}`}>
              {title}
            </h3>
          )}
          <div className={`text-sm ${config.contentClass} ${title ? "mt-2" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
