import React from "react";
import { Button } from "@/components/ui/button";
import { Sigma } from "lucide-react";

/**
 * Reusable math editor button for text input fields
 * Place it next to the input field, pass the ref from useMathEditor
 */
export default function MathEditorButton({ onClick, className = "" }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className={`border-gray-300 hover:bg-blue-50 ${className}`}
      title="Insert math equation"
    >
      <Sigma className="w-4 h-4" />
    </Button>
  );
}