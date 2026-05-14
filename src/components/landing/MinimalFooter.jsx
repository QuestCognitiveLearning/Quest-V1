import React, { useState } from "react";
import { TermsModal, PrivacyModal, SecurityModal } from "./PolicyModals";
import { Mail } from "lucide-react";

export default function MinimalFooter({ onContactClick }) {
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  return (
    <>
      <footer className="bg-gray-900 text-gray-300 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <h3 className="text-white font-bold text-lg mb-2">Quest Learning</h3>
              <p className="text-sm text-gray-400">Redefining education through the Cognitive Sciences and AI</p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#how-it-works" className="hover:text-white transition">Features</a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition">Pricing</a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={onContactClick} className="hover:text-white transition text-left">Contact</button>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition">FAQ</a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">Status</a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={() => setPrivacyOpen(true)} className="hover:text-white transition text-left">Privacy Policy</button>
                </li>
                <li>
                  <button onClick={() => setTermsOpen(true)} className="hover:text-white transition text-left">Terms of Use</button>
                </li>
                <li>
                  <button onClick={() => setSecurityOpen(true)} className="hover:text-white transition text-left">Security</button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400 mb-4 md:mb-0">
              &copy; 2026 Quest Learning. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="mailto:tnbioquest@gmail.com" className="flex items-center gap-2 text-sm hover:text-white transition">
                <Mail className="w-4 h-4" />
                tnbioquest@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
      <PrivacyModal open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <SecurityModal open={securityOpen} onOpenChange={setSecurityOpen} />
    </>);

}