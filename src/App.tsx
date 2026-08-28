import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'

const primaryScale = [
  { step: '50', color: 'oklch(0.97 0.02 355)' },
  { step: '100', color: 'oklch(0.94 0.045 355)' },
  { step: '200', color: 'oklch(0.88 0.08 355)' },
  { step: '300', color: 'oklch(0.80 0.13 355)' },
  { step: '400', color: 'oklch(0.71 0.19 355)' },
  { step: '500', color: 'oklch(0.655 0.26 355)' },
  { step: '600 (primary)', color: 'oklch(0.56 0.24 355)' },
  { step: '700', color: 'oklch(0.48 0.21 355)' },
  { step: '800', color: 'oklch(0.40 0.18 355)' },
  { step: '900', color: 'oklch(0.32 0.14 355)' },
  { step: '950', color: 'oklch(0.22 0.10 355)' },
]

const neutralTokens = [
  { name: 'background', color: 'var(--background)' },
  { name: 'card', color: 'var(--card)' },
  { name: 'muted', color: 'var(--muted)' },
  { name: 'secondary', color: 'var(--secondary)' },
  { name: 'border', color: 'var(--border)' },
  { name: 'foreground', color: 'var(--foreground)' },
]

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="size-14 rounded-lg ring-1 ring-foreground/10"
        style={{ background: color }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">MyList design preview</h1>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Primary scale</h2>
        <div className="flex flex-wrap gap-2">
          {primaryScale.map(({ step, color }) => (
            <Swatch key={step} label={step} color={color} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Neutral tokens</h2>
        <div className="flex flex-wrap gap-2">
          {neutralTokens.map(({ name, color }) => (
            <Swatch key={name} label={name} color={color} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Typography</h2>
        <div className="flex flex-col gap-1">
          <p className="text-4xl font-medium">Heading 1</p>
          <p className="text-2xl font-medium">Heading 2</p>
          <p className="text-lg font-medium">Heading 3</p>
          <p>Body text using Geist Variable.</p>
          <p className="text-muted-foreground">Muted body text.</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Form preview</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Sign up</CardTitle>
            <CardDescription>Preview of the base form fields.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <Button className="w-full">Create account</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default App
