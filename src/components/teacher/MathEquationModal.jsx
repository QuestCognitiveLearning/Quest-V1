import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import MathRenderer from "@/components/utils/MathRenderer";

const MATH_SYMBOLS = {
  "Fractions": [
    { label: "a/b", latex: "\\frac{a}{b}" },
    { label: "a÷b", latex: "\\frac{a}{b}" }
  ],
  "Exponents & Roots": [
    { label: "x²", latex: "x^2" },
    { label: "x³", latex: "x^3" },
    { label: "xⁿ", latex: "x^n" },
    { label: "√x", latex: "\\sqrt{x}" },
    { label: "ⁿ√x", latex: "\\sqrt[n]{x}" }
  ],
  "Calculus": [
    { label: "∫", latex: "\\int" },
    { label: "∫ₐᵇ", latex: "\\int_a^b" },
    { label: "Σ", latex: "\\sum" },
    { label: "Σₐᵇ", latex: "\\sum_{i=a}^{b}" },
    { label: "∂", latex: "\\partial" },
    { label: "∇", latex: "\\nabla" }
  ],
  "Greek Letters": [
    { label: "α", latex: "\\alpha" },
    { label: "β", latex: "\\beta" },
    { label: "γ", latex: "\\gamma" },
    { label: "δ", latex: "\\delta" },
    { label: "θ", latex: "\\theta" },
    { label: "λ", latex: "\\lambda" },
    { label: "μ", latex: "\\mu" },
    { label: "π", latex: "\\pi" },
    { label: "σ", latex: "\\sigma" },
    { label: "ω", latex: "\\omega" }
  ],
  "Trig Functions": [
    { label: "sin", latex: "\\sin" },
    { label: "cos", latex: "\\cos" },
    { label: "tan", latex: "\\tan" },
    { label: "sin⁻¹", latex: "\\arcsin" },
    { label: "cos⁻¹", latex: "\\arccos" },
    { label: "tan⁻¹", latex: "\\arctan" }
  ],
  "Logarithms": [
    { label: "log", latex: "\\log" },
    { label: "ln", latex: "\\ln" },
    { label: "log₁₀", latex: "\\log_{10}" },
    { label: "log₂", latex: "\\log_2" }
  ],
  "Limits & Functions": [
    { label: "lim", latex: "\\lim" },
    { label: "lim (x→a)", latex: "\\lim_{x \\to a}" },
    { label: "f(x)", latex: "f(x)" }
  ],
  "Matrices": [
    { label: "[a b]", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" }
  ],
  "Inequalities": [
    { label: "≤", latex: "\\leq" },
    { label: "≥", latex: "\\geq" },
    { label: "≠", latex: "\\neq" },
    { label: "≈", latex: "\\approx" }
  ]
};

export default function MathEquationModal({ isOpen, onClose, onInsert }) {
  const [latexInput, setLatexInput] = useState("");

  const handleSymbolClick = (latex) => {
    setLatexInput(prev => prev + latex);
  };

  const handleInsert = () => {
    if (latexInput.trim()) {
      onInsert(`$${latexInput}$`);
      setLatexInput("");
      onClose();
    }
  };

  const handleClear = () => {
    setLatexInput("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Math Equation Editor</span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* LaTeX Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              LaTeX Input
            </label>
            <Textarea
              value={latexInput}
              onChange={(e) => setLatexInput(e.target.value)}
              placeholder="Enter LaTeX code (e.g., \\frac{a}{b}, \\sqrt{x}, \\sum_{i=1}^{n})"
              className="font-mono text-sm h-20"
            />
            <p className="text-xs text-gray-500">
              Click symbol buttons below or type LaTeX directly
            </p>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Live Preview
            </label>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-12 flex items-center">
              {latexInput.trim() ? (
                <MathRenderer text={`$${latexInput}$`} />
              ) : (
                <span className="text-gray-400 text-sm">Your equation will appear here</span>
              )}
            </div>
          </div>

          {/* Symbol Buttons */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Common Symbols</h3>
            {Object.entries(MATH_SYMBOLS).map(([category, symbols]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {symbols.map((symbol, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSymbolClick(symbol.latex)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-sm font-medium text-blue-700 transition-colors"
                      title={symbol.latex}
                    >
                      {symbol.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              onClick={handleClear}
              variant="outline"
            >
              Clear
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInsert}
              disabled={!latexInput.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Insert Equation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}