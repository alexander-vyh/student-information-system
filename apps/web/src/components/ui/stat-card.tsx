import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type StatCardColor = "blue" | "green" | "purple" | "orange" | "red" | "gray";

interface StatCardProps {
  /**
   * The label/title for the statistic
   */
  label: string;

  /**
   * The main value to display
   */
  value: string | number;

  /**
   * Optional icon component from lucide-react
   */
  icon?: LucideIcon;

  /**
   * Color variant for the icon
   * @default "blue"
   */
  color?: StatCardColor;

  /**
   * Optional subtitle or secondary text below the value
   */
  subtitle?: string;

  /**
   * Optional custom className for the container
   */
  className?: string;

  /**
   * Optional additional content to render below the value
   */
  children?: ReactNode;
}

const colorMap: Record<StatCardColor, string> = {
  blue: "text-blue-600",
  green: "text-green-600",
  purple: "text-purple-600",
  orange: "text-orange-600",
  red: "text-red-600",
  gray: "text-gray-600",
};

/**
 * StatCard - Reusable component for displaying key metrics
 *
 * @example
 * <StatCard
 *   label="Cumulative GPA"
 *   value="3.45"
 *   icon={GraduationCap}
 *   color="green"
 * />
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  subtitle,
  className = "",
  children,
}: StatCardProps) {
  const iconColorClass = colorMap[color];

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center">
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className={`h-8 w-8 ${iconColorClass}`} />
          </div>
        )}
        <div className={Icon ? "ml-4 flex-1" : "flex-1"}>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
