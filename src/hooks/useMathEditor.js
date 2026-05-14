import { useRef, useState } from "react";

/**
 * Hook to manage math editor modal state and insertion
 * Returns: { isOpen, openEditor, closeEditor, insertEquation, textFieldRef }
 */
export function useMathEditor() {
  const [isOpen, setIsOpen] = useState(false);
  const textFieldRef = useRef(null);

  const openEditor = () => setIsOpen(true);
  const closeEditor = () => setIsOpen(false);

  const insertEquation = (equation) => {
    const field = textFieldRef.current;
    if (!field) return;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;

    const newText = text.substring(0, start) + equation + text.substring(end);
    field.value = newText;

    // Trigger change event
    const event = new Event("input", { bubbles: true });
    field.dispatchEvent(event);

    // Move cursor after inserted equation
    setTimeout(() => {
      field.selectionStart = field.selectionEnd = start + equation.length;
      field.focus();
    }, 0);
  };

  return {
    isOpen,
    openEditor,
    closeEditor,
    insertEquation,
    textFieldRef
  };
}