import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

type QuickActionCardProps = {
  to: LinkProps['to']
  icon: LucideIcon
  title: string
  description: string
  style?: CSSProperties
  className?: string
}

export function QuickActionCard({
  to,
  icon: Icon,
  title,
  description,
  style,
  className,
}: QuickActionCardProps) {
  return (
    <Link to={to} className="group/link outline-none">
      <Card
        className={cn(
          'h-full animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 transition-shadow hover:shadow-md group-focus-visible/link:ring-2 group-focus-visible/link:ring-ring',
          className,
        )}
        style={style}
      >
        <CardHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover/link:scale-110">
            <Icon className="size-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm font-medium text-primary opacity-0 transition-opacity group-hover/link:opacity-100">
          Go there &rarr;
        </CardContent>
      </Card>
    </Link>
  )
}
