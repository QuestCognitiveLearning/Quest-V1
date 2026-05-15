import React from "react";
import { X } from "lucide-react";

export const LEGAL_DOCS = {
  privacy: {
    title: "Privacy Policy",
    sub: "Last updated: January 2026",
    body: [
      [
        "",
        "Quest Learning is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard the information you provide while using our platform. By using Quest Learning, you agree to the practices described below.",
      ],
      [
        "Information We Collect",
        "We collect account information such as name, email, and role; learning data including progress, scores, and session history; and technical data such as IP address, browser type, and usage patterns. Payment information is processed by Stripe — we never store card details on our servers.",
      ],
      [
        "How We Use It",
        "We use this information to deliver and personalize learning, track student progress, process payments, send service updates, and analyze usage patterns to improve the platform. Student learning data is never sold or used for marketing.",
      ],
      [
        "Your Rights",
        "You can access, update, or delete your personal information anytime through your account settings. For additional requests, email admin@questlearning.co.",
      ],
    ],
  },
  terms: {
    title: "Terms of Use",
    sub: "Last updated: January 2026",
    body: [
      [
        "",
        "These Terms of Use govern your access to and use of the Quest Learning platform. By using the service, you agree to be bound by these terms. If you do not agree, please discontinue use immediately.",
      ],
      [
        "Accounts and Conduct",
        "You are responsible for keeping your credentials secure and for any activity on your account. You agree not to scrape data, distribute copyrighted course materials, or use the platform for unauthorized or illegal purposes. We may suspend accounts that violate these terms.",
      ],
      [
        "Intellectual Property",
        "All platform content, software, and design are owned by Quest Learning or its licensors. Teachers retain ownership of curricula they create. You may not copy or redistribute platform content without permission.",
      ],
      [
        "Payments and Termination",
        "Premium features require a subscription. You can cancel at any time from your account settings. Refunds are not provided for partial billing periods. We reserve the right to modify these terms; continued use after changes constitutes acceptance.",
      ],
    ],
  },
  ferpa: {
    title: "FERPA Compliance",
    sub: "Family Educational Rights and Privacy Act",
    body: [
      [
        "",
        "Quest Learning is committed to compliance with the Family Educational Rights and Privacy Act (FERPA, 20 U.S.C. § 1232g; 34 CFR Part 99), which protects the privacy of student education records.",
      ],
      [
        "1. Our Role Under FERPA",
        "When schools and districts use Quest Learning, we act as a 'school official' with a 'legitimate educational interest' under FERPA. We process student information solely on behalf of the school to provide curriculum, instruction, and analytics — never for our own commercial purposes.",
      ],
      [
        "2. What We Collect",
        "Account data (name, email, role), learning data (progress, quiz responses, session history, mastery scores), and technical data (IP address, browser type, usage patterns) needed to run the platform.",
      ],
      [
        "3. How We Use Student Data",
        "Strictly to deliver instruction, personalize learning paths, and report progress back to teachers and parents. We never sell student data, never use it for targeted advertising, and never share it with third parties except service providers bound by equivalent privacy obligations (e.g., hosting, email delivery).",
      ],
      [
        "4. Parent and Student Rights",
        "Parents of students under 18 and eligible students (18+ or in higher education) have the right to inspect their education records, request corrections, and consent to disclosures. To exercise these rights, contact your school directly — Quest Learning will work with the school to fulfill the request.",
      ],
      [
        "5. Data Retention and Deletion",
        "Student records are retained for the duration of the school's subscription. Upon written request from the school, we will delete student records within 30 days. For deletion requests, email admin@questlearning.co.",
      ],
      [
        "6. Directory Information",
        "Quest Learning does not designate or disclose any student information as 'directory information' under FERPA. All student-identifiable data is treated as a protected education record.",
      ],
    ],
  },
  security: {
    title: "Security",
    sub: "Quest Learning Security Practices",
    body: [
      [
        "",
        "We are committed to maintaining the highest security standards to protect your data and the integrity of our platform.",
      ],
      [
        "1. Data Encryption",
        "All data transmitted between your device and our servers is encrypted using SSL/TLS protocols. Sensitive information is encrypted at rest in our database.",
      ],
      [
        "2. Authentication & Access Control",
        "We use secure authentication methods including hashed passwords and session tokens. Teachers can only access their own classes and students. Students can only access classes they are enrolled in.",
      ],
      [
        "3. Payment Security",
        "Payment processing is handled by Stripe, a PCI DSS Level 1 compliant provider. We never store credit card information on our servers.",
      ],
      [
        "4. Infrastructure Security",
        "Our platform is hosted on secure, monitored cloud infrastructure with automated backups, DDoS protection, and intrusion detection systems.",
      ],
      [
        "5. Regular Security Audits",
        "We conduct regular security assessments and penetration testing to identify and address vulnerabilities. Our code undergoes continuous monitoring and updates.",
      ],
      [
        "6. User Account Security",
        "Best practices: Use strong, unique passwords. Enable two-factor authentication if available. Never share your credentials. Log out when using shared devices. Report suspicious activity immediately.",
      ],
      [
        "7. Incident Response",
        "If we discover a security breach affecting user data, we will notify affected users promptly and take immediate corrective action.",
      ],
      [
        "8. Compliance",
        "We comply with applicable data protection regulations.",
      ],
      [
        "9. Report Security Issues",
        "If you discover a security vulnerability, please report it to admin@questlearning.co. Do not publicly disclose vulnerabilities.",
      ],
    ],
  },
};

export default function LegalModal({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-7 bg-[#0F172A]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[720px] max-h-[88vh] flex flex-col overflow-hidden relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#E5ECF7] hover:bg-[#E2E8F0] text-[#0F172A] flex items-center justify-center z-10 transition-colors"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
        <div className="px-9 pt-8 pb-5 border-b border-[#E2E8F0]">
          <h2 className="font-extrabold text-[28px] text-[#0F172A] tracking-tight">
            {doc.title}
          </h2>
          <div className="text-[12.5px] text-[#64748B] tracking-wider uppercase font-semibold mt-1">
            {doc.sub}
          </div>
        </div>
        <div className="px-9 py-7 overflow-y-auto text-[#1E293B] text-[14.5px] leading-relaxed">
          {doc.body.map(([h, p], i) => (
            <div key={i} className={h ? "mt-6 first:mt-0" : "mt-2"}>
              {h && (
                <h3 className="font-bold text-base text-[#0F172A] tracking-tight mb-2">
                  {h}
                </h3>
              )}
              <p>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
