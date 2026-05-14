import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

export function TermsModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white pb-4 border-b">
          <DialogTitle>Terms of Use</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Last updated: January 2026</h3>
            <p className="mb-4">
              These Terms of Use constitute a legally binding agreement between you and Quest Learning ("we", "us", "our"), concerning your access to and use of the Quest Learning website, application, and all related services (the "Platform").
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">1. Agreement to Terms</h3>
            <p>
              By accessing and using the Platform, you agree to be bound by these Terms of Use. If you do not agree, you must discontinue use immediately.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. Description of Service</h3>
            <p>
              Quest Learning is an educational platform that provides spaced repetition-based learning tools for students and teachers. Teachers create curricula, manage classes, and track student progress. Students access learning materials, complete assessments, and participate in live sessions.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. User Accounts</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and keep it current. We reserve the right to suspend or terminate accounts that violate these terms or contain inaccurate information.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Prohibited Activities</h3>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the Platform for unauthorized or illegal purposes</li>
              <li>Attempt to bypass security measures or access unauthorized areas</li>
              <li>Share or distribute copyrighted course materials</li>
              <li>Engage in harassment, threats, or abusive behavior</li>
              <li>Use automated tools to scrape data or access the Platform</li>
              <li>Impersonate other users or misrepresent your identity</li>
              <li>Interfere with or disrupt the Platform's functionality</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Intellectual Property</h3>
            <p>
              All course content, materials, software, and designs on the Platform are owned by Quest Learning or licensed to us. You may not copy, distribute, or reproduce any content without permission. Teachers retain ownership of curricula they create.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. Payment Terms</h3>
            <p>
              Premium features require payment. All charges are billed according to your selected plan. Cancellation can be made anytime through your account settings. Refunds are not provided for partial months.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">7. Limitation of Liability</h3>
            <p>
              Quest Learning is provided "as-is". We are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform. We do not guarantee uninterrupted service or error-free operation.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">8. Modifications</h3>
            <p>
              We reserve the right to modify these Terms of Use at any time. Changes will be posted on this page. Continued use constitutes acceptance of updated terms.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">9. Contact</h3>
            <p>
              For questions about these Terms, contact us at support@questlearning.io
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrivacyModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white pb-4 border-b">
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Last updated: January 2026</h3>
            <p className="mb-4">
              Quest Learning ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal information.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">1. Information We Collect</h3>
            <p className="mb-2">We collect information in the following ways:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Information:</strong> Name, email, password, and account type (student/teacher)</li>
              <li><strong>Learning Data:</strong> Course progress, quiz scores, session history, and performance metrics</li>
              <li><strong>Curriculum Data:</strong> Teacher-created content and class information</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device info, and usage patterns</li>
              <li><strong>Payment Information:</strong> Processed securely through Stripe; we do not store card details</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. How We Use Your Information</h3>
            <p className="mb-2">We use collected information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and improve our educational services</li>
              <li>Track learning progress and provide personalized recommendations</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service updates and important notifications</li>
              <li>Analyze usage patterns to enhance the Platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. Data Security</h3>
            <p>
              We implement industry-standard security measures including encryption, secure servers, and regular backups. However, no method is 100% secure. You are responsible for maintaining the confidentiality of your credentials.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Third-Party Services</h3>
            <p>
              We use Stripe for payments, Google services for authentication, and cloud hosting providers for data storage. These services have their own privacy policies. We do not sell your personal information to third parties.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Student Data Protection</h3>
            <p>
              We take special care to protect student information. Teachers have access only to their own students' data. Student learning data is never used for marketing or sold to third parties.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. Data Retention</h3>
            <p>
              We retain your data as long as your account is active. Upon account deletion, personal data is removed within 30 days, though aggregate usage data may be retained for analytics.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">7. Your Rights</h3>
            <p>
              You can access, update, or delete your personal information anytime through your account settings. For additional requests, contact us at privacy@questlearning.io
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">8. Children's Privacy</h3>
            <p>
              Teachers are responsible for ensuring parental consent for students under 13. We comply with COPPA and do not knowingly collect data from children without proper authorization.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">9. Contact Us</h3>
            <p>
              For privacy concerns, contact us at privacy@questlearning.io
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white pb-4 border-b">
          <DialogTitle>Security</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Quest Learning Security Practices</h3>
            <p className="mb-4">
              We are committed to maintaining the highest security standards to protect your data and the integrity of our platform.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">1. Data Encryption</h3>
            <p>
              All data transmitted between your device and our servers is encrypted using SSL/TLS protocols. Sensitive information is encrypted at rest in our database.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. Authentication & Access Control</h3>
            <p>
              We use secure authentication methods including hashed passwords and session tokens. Teachers can only access their own classes and students. Students can only access classes they are enrolled in.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. Payment Security</h3>
            <p>
              Payment processing is handled by Stripe, a PCI DSS Level 1 compliant provider. We never store credit card information on our servers.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Infrastructure Security</h3>
            <p>
              Our platform is hosted on secure, monitored cloud infrastructure with automated backups, DDoS protection, and intrusion detection systems.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Regular Security Audits</h3>
            <p>
              We conduct regular security assessments and penetration testing to identify and address vulnerabilities. Our code undergoes continuous monitoring and updates.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. User Account Security</h3>
            <p className="mb-2">Best practices:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use strong, unique passwords</li>
              <li>Enable two-factor authentication if available</li>
              <li>Never share your credentials</li>
              <li>Log out when using shared devices</li>
              <li>Report suspicious activity immediately</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">7. Incident Response</h3>
            <p>
              If we discover a security breach affecting user data, we will notify affected users promptly and take immediate corrective action.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">8. Compliance</h3>
            <p>
              We comply with applicable data protection regulations including COPPA for student privacy and industry-standard security frameworks.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">9. Report Security Issues</h3>
            <p>
              If you discover a security vulnerability, please report it to security@questlearning.io. Do not publicly disclose vulnerabilities.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}