/**
 * LegalDoc — standalone, public, deep-linkable legal pages (Privacy, Terms,
 * Data Sharing, Security, FERPA, COPPA). Renders from the shared LEGAL_DOCS
 * source of truth so the footer modals and these pages never drift apart.
 *
 * Real URLs (e.g. /privacy, /terms, /datasharing) are needed for partner
 * directories like the ClassLink Global Library that require linkable policies.
 */
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { LEGAL_DOCS } from "@/components/landing/v3/LegalModals";

const RELATED = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data Sharing", "/datasharing"],
  ["Security", "/security"],
  ["FERPA", "/ferpa"],
  ["COPPA", "/coppa"],
];

export default function LegalDoc({ docKey }) {
  const doc = LEGAL_DOCS[docKey];

  useEffect(() => {
    if (doc?.title) document.title = `${doc.title} · Quest Learning`;
  }, [doc]);

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6 text-center">
        <div>
          <p className="text-slate-600">That document could not be found.</p>
          <Link to="/" className="text-[#2563EB] font-semibold">Return home</Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white text-[#1E293B]"
      style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <header className="border-b border-[#E2E8F0]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-extrabold tracking-tight text-[#0F172A]">
            Quest Learning
          </Link>
          <Link to="/" className="text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-extrabold text-[34px] sm:text-[40px] text-[#0F172A] tracking-tight leading-tight">
          {doc.title}
        </h1>
        <div className="text-[12.5px] text-[#64748B] tracking-wider uppercase font-semibold mt-2">
          {doc.sub}
        </div>

        <div className="mt-8 text-[15px] leading-relaxed">
          {doc.body.map(([h, p], i) => (
            <div key={i} className={h ? "mt-7 first:mt-0" : "mt-3"}>
              {h && (
                <h2 className="font-bold text-lg text-[#0F172A] tracking-tight mb-2">{h}</h2>
              )}
              <p>{p}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[#E2E8F0]">
          <div className="text-[12.5px] text-[#64748B] uppercase tracking-wider font-semibold mb-3">
            More policies
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {RELATED.map(([label, href]) => (
              <Link
                key={href}
                to={href}
                className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                {label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-[#64748B] mt-6">
            Questions? Email{" "}
            <a href="mailto:admin@questlearning.co" className="text-[#2563EB] font-medium">
              admin@questlearning.co
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
