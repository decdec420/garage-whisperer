import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 max-w-3xl mx-auto">
      <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: April 15, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
          <p>When you create an account, we collect your name, email address, and password (hashed). When you use Ratchet, we store vehicle information, maintenance logs, repair history, diagnosis sessions, project data, chat messages, and uploaded documents that you provide.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
          <p>We use your data to provide and improve the Ratchet service — including AI-powered diagnostics, maintenance tracking, and personalized recommendations. We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Data Storage & Security</h2>
          <p>Your data is stored securely using Supabase with row-level security policies that ensure only you can access your own data. All connections are encrypted via TLS. Passwords are hashed using bcrypt and are never stored in plain text.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Supabase</strong> — authentication and data storage</li>
            <li><strong>Anthropic (Claude)</strong> — AI-powered diagnostics and chat</li>
            <li><strong>PostHog</strong> — anonymized product analytics (opt-out available)</li>
            <li><strong>Sentry</strong> — error tracking to improve reliability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Your Rights</h2>
          <p>You can export all your data at any time from Settings. You can delete your account and all associated data permanently from Settings. Upon deletion, all your data is removed from our systems.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Cookies</h2>
          <p>We use essential cookies for authentication session management. We do not use advertising cookies or trackers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Children's Privacy</h2>
          <p>Ratchet is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
          <p>If you have questions about this privacy policy, please contact us at <a href="mailto:support@getratchet.com" className="text-primary hover:underline">support@getratchet.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
