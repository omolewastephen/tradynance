import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8 text-foreground">
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-3xl font-semibold tracking-tight">
          Tradynance
        </span>
        <span className="font-mono text-sm text-foreground-muted">
          phase 0 — foundation
        </span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Design system smoke test</CardTitle>
          <CardDescription>
            Verifying tokens, fonts, and base components render correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@tradynance.com" />
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-data tabular-nums text-price-up">
              +2.41%
            </span>
            <span className="font-mono text-data tabular-nums text-price-down">
              -0.86%
            </span>
          </div>
          <div className="flex gap-2">
            <Button className="w-full">Primary</Button>
            <Button variant="outline" className="w-full">
              Outline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
