import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 max-w-3xl mx-auto">
      <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: April 15, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using Ratchet ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
          <p>Ratchet is a vehicle maintenance and diagnostic tool that provides AI-powered guidance for vehicle care. The Service is provided "as is" and is intended for informational purposes only.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Disclaimer — Not Professional Advice</h2>
          <p className="font-medium text-foreground">Ratchet is not a substitute for professional mechanical advice. AI-generated diagnoses and repair guidance are suggestions only. Always consult a qualified mechanic for safety-critical repairs. You assume all risk when performing vehicle maintenance or repairs based on information from the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activities that occur under your account. You must provide accurate information when creating an account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. User Content</h2>
          <p>You retain ownership of all data you provide to Ratchet (vehicle information, photos, documents, etc.). By using the Service, you grant us a limited license to process your data solely to provide the Service. We do not claim ownership of your content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Acceptable Use</h2>
          <p>You agree not to misuse the Service, including but not limited to: attempting to access other users' data, reverse-engineering the Service, using automated tools to scrape data, or using the Service for any illegal purpose.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, Ratchet and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, or goodwill.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Termination</h2>
          <p>We may suspend or terminate your access to the Service at any time for violation of these terms. You may delete your account at any time from Settings, which will permanently remove all your data.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Contact</h2>
          <p>If you have questions about these terms, please contact us at <a href="mailto:support@getratchet.com" className="text-primary hover:underline">support@getratchet.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
