import React, { useState } from "react";
import LegalModal, { LEGAL_DOCS } from "./LegalModals";

/**
 * Compact dark footer.
 *
 * Layout: 4-column grid on desktop (1.6fr brand + 3 link columns), stacks on
 * mobile. Top padding (pt-44 = 176px) is intentionally generous so there's a
 * meaningful dark band between the CTA card and the footer content.
 *
 * Contact email is `admin@questlearning.co` (our verified mailbox). All Legal
 * items open in-page modals — they never navigate away.
 */
export default function Footer() {
  const [modal, setModal] = useState(null);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const openModal = (key) => (e) => {
    e.preventDefault();
    setModal(key);
  };

  return (
    <>
      <footer
        className="bg-[#0F172A] text-white/70 border-t border-[#1E293B]"
        style={{
          // Inline so it can't be purged by Tailwind or overridden by any
          // upstream cache. Big dark navy band before the columns start.
          paddingTop: "60px",
          paddingBottom: "80px",
        }}
      >
        <div className="lp-v3-container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img
                  src="/quest-logo-on-white.png"
                  alt=""
                  width="28"
                  height="28"
                  className="rounded-md"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-white font-bold text-[16px] tracking-tight">
                  Quest Learning
                </span>
              </div>
              <p className="text-[14px] text-white/70 leading-relaxed max-w-[44ch]">
                Redefining education through cognitive science and AI. Made for
                the people in front of the classroom.
              </p>
            </div>

            <FooterCol h="Product">
              <FooterLink onClick={scrollTo("loop")}>How it works</FooterLink>
              <FooterLink onClick={scrollTo("teacher-flow")}>For teachers</FooterLink>
              <FooterLink onClick={scrollTo("cta-final")}>For districts</FooterLink>
              <FooterLink onClick={scrollTo("pricing")}>Pricing</FooterLink>
            </FooterCol>

            <FooterCol h="Company">
              <FooterLink onClick={scrollTo("faq")}>FAQ</FooterLink>
              <FooterLink onClick={scrollTo("cta-final")}>Contact</FooterLink>
              <FooterLink onClick={(e) => e.preventDefault()}>Status</FooterLink>
              <FooterLink
                onClick={(e) => {
                  e.preventDefault();
                  // No careers page yet — open a pre-addressed email so
                  // interested folks have a path while we set one up.
                  window.location.href =
                    "mailto:admin@questlearning.co?subject=Careers%20Inquiry";
                }}
              >
                Careers
              </FooterLink>
            </FooterCol>

            <FooterCol h="Legal">
              <FooterLink onClick={openModal("privacy")}>Privacy</FooterLink>
              <FooterLink onClick={openModal("terms")}>Terms</FooterLink>
              <FooterLink onClick={openModal("security")}>Security</FooterLink>
              <FooterLink onClick={openModal("ferpa")}>FERPA</FooterLink>
              <FooterLink onClick={openModal("coppa")}>COPPA</FooterLink>
            </FooterCol>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-white/60 text-[13px]">
              © 2026 Quest Learning. All rights reserved.
            </span>
            <a
              href="mailto:admin@questlearning.co"
              className="text-white/60 hover:text-white text-[13px] transition-colors"
            >
              admin@questlearning.co
            </a>
          </div>
        </div>
      </footer>

      {modal && (
        <LegalModal doc={LEGAL_DOCS[modal]} onClose={() => setModal(null)} />
      )}
    </>
  );
}

function FooterCol({ h, children }) {
  return (
    <div>
      <h5 className="text-white font-semibold text-[13.5px] tracking-wider uppercase mb-3.5">
        {h}
      </h5>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ onClick, children }) {
  return (
    <li>
      <a
        href="#"
        onClick={onClick}
        className="text-white/65 hover:text-white text-[14px] transition-colors cursor-pointer"
      >
        {children}
      </a>
    </li>
  );
}
