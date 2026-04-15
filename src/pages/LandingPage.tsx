import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wrench, Brain, ClipboardList, Car, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI Diagnostics',
    desc: 'Tell Ratchet what\'s wrong. He\'ll walk you through the same diagnostic tree a dealership tech uses — except he won\'t charge you $150/hr to Google it.',
  },
  {
    icon: ClipboardList,
    title: 'Guided Projects',
    desc: 'Step-by-step repair guides with parts lists, torque specs, and factory photos. It\'s like a recipe book, but for your brake pads.',
  },
  {
    icon: Car,
    title: 'Maintenance Tracking',
    desc: "Ratchet knows what's due, what's overdue, and what you've been pretending isn't a problem. No judgment. Mostly.",
  },
];

const steps = [
  { num: '1', title: 'Add your ride', desc: 'Year, make, model — or just slap in your VIN. We\'ll figure out the rest.' },
  { num: '2', title: 'Track everything', desc: 'Maintenance, repairs, mileage. All in one place instead of that shoebox in your garage.' },
  { num: '3', title: 'Ask Ratchet anything', desc: '"Why is my car making that noise?" — yeah, he handles those.' },
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
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </nav>

      {/* ─── Hero ─── */}
      <section className="px-6 pt-16 pb-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Wrench className="h-4 w-4" /> Your AI mechanic buddy
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Stop Googling.<br />
          <span className="text-primary">Start wrenching.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Ratchet is the AI mechanic that actually knows what it's talking about. Diagnostics, repair plans, maintenance tracking — all free, all in your pocket, no condescending YouTube comments required.
        </p>
        <div className="mt-8">
          <Button size="lg" className="gap-2 text-base px-8" asChild>
            <Link to="/signup">Let's Go <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Free forever. No credit card. No catch. Seriously.</p>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything you need to stop paying $120/hr</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">Well, for the stuff you can do yourself anyway. We're not suggesting you rebuild a transmission in your driveway. <span className="italic">Unless you're about that life.</span></p>
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
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Up and running in minutes</h2>
        <p className="text-center text-muted-foreground mb-12">Faster than finding the 10mm socket you just had.</p>
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

      {/* ─── What's packed in ─── */}
      <section className="px-6 py-16 bg-card/50">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold">What's under the hood</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">Yeah, we went there with the pun. Here's what you're actually getting — for free.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {[
              { label: 'Master-tech diagnostic logic', detail: 'The same decision trees the pros use, minus the waiting room magazines.' },
              { label: 'Factory manual integration', detail: 'Torque specs and procedures pulled from OEM sources. No guessing.' },
              { label: 'Parts lists with buy links', detail: 'Every repair plan comes with parts, prices, and links. One less tab to open.' },
              { label: 'Vehicle health scoring', detail: '0–100 score so you can finally quantify "it\'s fine, probably."' },
              { label: 'Repair cost tracking', detail: 'Shop quoted $800? You did it for $120? Ratchet keeps the receipts.' },
              { label: 'AI memory per vehicle', detail: 'Ratchet remembers your mods, quirks, and that weird rattle. He\'s thorough like that.' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-4 text-left space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold">Your car's check engine light is on.</h2>
        <p className="mt-3 text-muted-foreground">You could panic. Or you could ask Ratchet. Your call.</p>
        <Button size="lg" className="mt-6 gap-2 text-base px-8" asChild>
          <Link to="/signup">Try Ratchet <ArrowRight className="h-4 w-4" /></Link>
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
