import React from "react";
import { X } from "lucide-react";

export const LEGAL_DOCS = {
  privacy: {
    title: "Privacy Policy",
    sub: "Last updated: June 2026",
    body: [
      [
        "",
        "Quest Learning is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard information across our platform. Quest is used by learners of all ages, including children under 13, so we hold ourselves to FERPA and COPPA standards for every account. By using Quest Learning, you agree to the practices described below.",
      ],
      [
        "Information We Collect",
        "We practice data minimization: we collect only what is needed to run the service. Account information such as name (or a display name), email, and role; learning data including progress, scores, quiz responses, and session history; and limited technical data such as IP address, browser type, and usage patterns. Students can join a live session with only a first-name display name and no account. Payment information is processed by Stripe; we never store card details on our servers.",
      ],
      [
        "How We Use It",
        "Strictly to deliver and personalize learning, track student progress, report results to teachers and schools, process payments for educators, and keep the platform secure and reliable. We do not run third-party advertising trackers, and we do not build advertising profiles. Student learning data is never sold and never used for marketing.",
      ],
      [
        "Children's Privacy (Under 13)",
        "Because Quest serves students of all ages, we comply with the Children's Online Privacy Protection Act (COPPA). In school settings, the school or district provides consent for the collection of a child's information for educational purposes, acting as the parent's agent — consistent with FTC guidance. See our COPPA Compliance notice for full detail on what we collect from children, parental rights, and how to request deletion.",
      ],
      [
        "Service Providers",
        "We share data only with vetted service providers who help us operate the platform — Supabase (hosting, database, authentication), Stripe (payments), OpenAI (AI lesson and tutoring features), Resend (transactional email), Google (optional sign-in), and YouTube (teacher-selected video). Each is bound by confidentiality and is prohibited from using student data for its own purposes. We do not sell data to anyone.",
      ],
      [
        "Data Retention & Deletion",
        "We retain personal information only as long as needed for the educational purpose or for the duration of the school's subscription. On a verified request from a user, parent, or school, we delete the associated personal information within 30 days. To make a request, email admin@questlearning.co.",
      ],
      [
        "Your Rights",
        "You can access, update, or delete your personal information anytime through your account settings. Students, parents, and schools may also request access or deletion by emailing admin@questlearning.co. We will respond to verified requests promptly.",
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
  coppa: {
    title: "COPPA Compliance",
    sub: "Children's Online Privacy Protection Act",
    body: [
      [
        "",
        "Quest Learning is designed for learners of all ages, including children under 13. We comply with the Children's Online Privacy Protection Act (COPPA, 15 U.S.C. §§ 6501–6506; 16 CFR Part 312), which governs the online collection of personal information from children under 13.",
      ],
      [
        "1. School-Authorized Consent",
        "In K-12 settings, schools and districts use Quest as a 'school official' tool and provide consent for the collection of a child's personal information for educational purposes — acting as the parent's agent, consistent with FTC COPPA guidance. We collect and use children's data solely to provide the educational service to the school, never for our own commercial purposes.",
      ],
      [
        "2. What We Collect From Children",
        "Only what is reasonably necessary to participate: a name or first-name display name, an email (often school-issued), and learning data such as progress, quiz responses, and session history. A child can join a live session with just a display name and no account. We do not condition participation on a child disclosing more than is needed.",
      ],
      [
        "3. No Advertising, No Selling, No Profiling",
        "We never use children's data for targeted or behavioral advertising, never build advertising or marketing profiles, and never sell or rent children's personal information. Quest runs no third-party advertising trackers.",
      ],
      [
        "4. Limited Sharing & No Public Exposure",
        "A child's activity is visible only to their teacher and school, never published publicly. We share data only with service providers (e.g., hosting, AI features, email) that are contractually bound to confidentiality and prohibited from using children's data for their own purposes.",
      ],
      [
        "5. Parental Rights",
        "Parents may review their child's personal information, request that we delete it, and refuse to permit further collection or use. Because consent is provided through the school, parents should contact their school or district, or email admin@questlearning.co directly — Quest will work with the school to verify and fulfill the request.",
      ],
      [
        "6. Data Retention & Deletion",
        "We retain a child's information only as long as needed for the educational purpose or the school's subscription, and we delete it within 30 days of a verified deletion request. To request deletion, email admin@questlearning.co.",
      ],
      [
        "7. Contact",
        "Questions about our children's privacy practices can be sent to admin@questlearning.co.",
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
        "When schools and districts use Quest Learning, we act as a 'school official' with a 'legitimate educational interest' under FERPA. We process student information solely on behalf of the school to provide curriculum, instruction, and analytics, never for our own commercial purposes.",
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
        "Parents of students under 18 and eligible students (18+ or in higher education) have the right to inspect their education records, request corrections, and consent to disclosures. To exercise these rights, contact your school directly, Quest Learning will work with the school to fulfill the request.",
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
