# UI Component Library

Reusable, type-safe components for the Student Information System.

## Purpose

This library solves the maintainability issues caused by duplicated Tailwind markup across the application. Instead of copying 50+ lines of div-span-class soup for each stat card or alert, we now have semantic, reusable components.

## Components

### StatCard

Display key metrics with optional icons and subtitles.

```tsx
import { StatCard } from "@/components/ui";
import { GraduationCap } from "lucide-react";

<StatCard
  label="Cumulative GPA"
  value="3.45"
  icon={GraduationCap}
  color="green"
  subtitle="Last term: 3.67"
/>
```

**Props:**
- `label` (string) - Metric label
- `value` (string | number) - Main value to display
- `icon?` (LucideIcon) - Optional icon component
- `color?` ("blue" | "green" | "purple" | "orange" | "red" | "gray") - Icon color
- `subtitle?` (string) - Optional secondary text
- `className?` (string) - Additional classes
- `children?` (ReactNode) - Additional content below value

### Alert

Display contextual alerts and notifications.

```tsx
import { Alert } from "@/components/ui";

<Alert variant="error" title="Active Holds">
  You have 2 holds blocking registration.
</Alert>
```

**Props:**
- `variant?` ("info" | "success" | "warning" | "error") - Visual style
- `title?` (string) - Alert heading
- `children` (ReactNode) - Alert content
- `showIcon?` (boolean) - Whether to show icon (default: true)
- `className?` (string) - Additional classes

### LoadingSpinner

Show loading state with optional text.

```tsx
import { LoadingSpinner } from "@/components/ui";

<LoadingSpinner
  size="md"
  text="Loading dashboard..."
  centered
/>
```

**Props:**
- `size?` ("sm" | "md" | "lg") - Spinner size
- `text?` (string) - Optional loading text
- `centered?` (boolean) - Center in container
- `minHeight?` (string) - Min height when centered (default: "min-h-96")
- `className?` (string) - Additional classes

### Card Components

Container components for consistent layouts.

```tsx
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui";

<Card>
  <CardHeader>
    <h2>Academic Summary</h2>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <p>Last updated: Today</p>
  </CardFooter>
</Card>
```

**Card Props:**
- `children` (ReactNode) - Card content
- `className?` (string) - Additional classes

Same props for `CardHeader`, `CardContent`, and `CardFooter`.

## Design Principles

1. **Semantic Over Generic**: Use `<StatCard>` instead of `<div className="...">`
2. **Type-Safe**: Full TypeScript support with prop validation
3. **Flexible**: Accept className overrides for edge cases
4. **Consistent**: Enforces design system patterns
5. **Future-Proof**: Centralized styling means one place to update

## Migration Guide

### Before (Old Pattern)
```tsx
<div className="bg-white rounded-lg shadow p-6">
  <div className="flex items-center">
    <div className="flex-shrink-0">
      <GraduationCap className="h-8 w-8 text-green-600" />
    </div>
    <div className="ml-4 flex-1">
      <p className="text-sm font-medium text-gray-500">Cumulative GPA</p>
      <p className="text-2xl font-bold text-gray-900">3.45</p>
    </div>
  </div>
</div>
```

### After (New Pattern)
```tsx
<StatCard
  label="Cumulative GPA"
  value="3.45"
  icon={GraduationCap}
  color="green"
/>
```

**Benefits:**
- 14 lines → 6 lines (57% reduction)
- Self-documenting code
- Type-safe props
- Consistent across app
- Single source of truth for styling

## Adding New Components

When adding new UI components:

1. Create file in `apps/web/src/components/ui/`
2. Export from `index.ts`
3. Document props and examples in this README
4. Use TypeScript interfaces for props
5. Support `className` prop for flexibility

## Testing Strategy

Components use existing Tailwind classes, so no new CSS to test. Type-check ensures proper usage:

```bash
pnpm --filter @sis/web typecheck
```

## Library Updates

Current dependencies are stable:
- Tailwind CSS: v3.4.15 (stable)
- Lucide React: v0.555.0 (stable)
- React: v18.3.1 (stable)

**Note on tRPC:** Currently using `v11.0.0-rc.660` (release candidate). When tRPC v11 stable releases, upgrade with comprehensive testing of tRPC procedures.
