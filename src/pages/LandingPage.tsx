import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wrench, Brain, ClipboardList, Car, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI Diagnostics',
    desc: 'Describe a symptom and Ratchet walks you through a master-technician diagnostic tree — no scanner needed.',
  },
  {
    icon: ClipboardList,
    title: 'Guided Projects',
    desc: 'Step-by-step repair guides with parts lists, torque specs, and factory manual photos — all generated in seconds.',
  },
  {
    icon: Car,
    title: 'Maintenance Tracking',
    desc: 'Know exactly what's due, what's overdue, and what your vehicle needs next. Never miss an oil change again.',
  },
];

const steps = [
  { num: '1', title: 'Add your vehicle', desc: 'Enter your year, make, model — or just paste your VIN.' },
  { num: '2', title: 'Track everything', desc: 'Log maintenance, repairs, and mileage in one place.' },
  { num: '3', title: 'Ask Ratchet', desc: 'Get instant diagnostics, repair plans, and expert guidance.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Nav ─── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-primary">Ratchet</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="px-6 pt-16 pb-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Wrench className="h-4 w-4" /> AI-powered vehicle intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Your mechanic buddy,<br />
          <span className="text-primary">always in your pocket.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Ratchet is an AI mechanic that helps you diagnose problems, plan repairs, and track maintenance — so you wrench with confidence.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="gap-2 text-base px-8" asChild>
            <Link to="/signup">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" size="lg" className="text-base px-8" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Everything you need to own your repairs</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Up and running in 60 seconds</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map(s => (
            <div key={s.num} className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto">
                {s.num}
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Social proof ─── */}
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Built for DIYers and indie mechanics</h2>
          <div className="grid sm:grid-cols-3 gap-6 mt-8">
            {[
              'Master-technician diagnostic logic',
              'Factory manual integration',
              'Parts lists with buy links',
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-left">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold">Ready to wrench smarter?</h2>
        <p className="mt-3 text-muted-foreground">Free to use. No credit card required.</p>
        <Button size="lg" className="mt-6 gap-2 text-base px-8" asChild>
          <Link to="/signup">Create Your Account <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} Ratchet</span>
          </div>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
