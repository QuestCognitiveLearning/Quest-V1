import React, { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import MathEditorButton from "@/components/teacher/MathEditorButton";
import MathEquationModal from "@/components/teacher/MathEquationModal";
import { useMathEditor } from "@/hooks/useMathEditor";

export default function StudentMathInput({ 
  value, 
  onChange, 
  placeholder, 
  multiline = false,
  className = "",
  disabled = false 
}) {
  const [showMathEditor, setShowMathEditor] = useState(false);
  const mathEditor = useMathEditor();
  const inputRef = useRef(null);

  const handleInsertEquation = (equation) => {
    if (inputRef.current) {
      const text = inputRef.current.value;
      const start = inputRef.current.selectionStart;
      const end = inputRef.current.selectionEnd;
      const newText = text.substring(0, start) + equation + text.substring(end);
      onChange({ target: { value: newText } });
    }
    setShowMathEditor(false);
  };

  const handleOpenMathEditor = () => {
    setShowMathEditor(true);
    mathEditor.openEditor();
  };

  const Component = multiline ? Textarea : Input;

  return (
    <>
      <div className="flex gap-2">
        <Component
          ref={inputRef}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`flex-1 ${className}`}
        />
        <MathEditorButton
          onClick={handleOpenMathEditor}
        />
      </div>

      <MathEquationModal
        isOpen={showMathEditor}
        onClose={() => setShowMathEditor(false)}
        onInsert={handleInsertEquation}
      />
    </>
  );
}