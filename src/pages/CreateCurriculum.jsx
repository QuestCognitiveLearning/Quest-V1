import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { toast } from "sonner";
import SubscriptionCheck from "@/components/teacher/SubscriptionCheck";
import StandardsPicker from "@/components/teacher/StandardsPicker";
import CurriculumMethodChooser from "@/components/teacher/CurriculumMethodChooser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, BookOpen, CheckCircle, Plus, Trash2, ChevronLeft } from "lucide-react";

export default function CreateCurriculum() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null = choose, "manual", "standards"
  const [step, setStep] = useState("define"); // define, saving, complete
  const [formData, setFormData] = useState({
    subject_name: "",
    curriculum_difficulty: "High",
    color: "blue"
  });

  const colorOptions = [
    { value: "blue", label: "Blue", bg: "bg-blue-500" },
    { value: "purple", label: "Purple", bg: "bg-purple-500" },
    { value: "pink", label: "Pink", bg: "bg-pink-500" },
    { value: "green", label: "Green", bg: "bg-green-500" },
    { value: "orange", label: "Orange", bg: "bg-orange-500" },
    { value: "red", label: "Red", bg: "bg-red-500" },
    { value: "indigo", label: "Indigo", bg: "bg-indigo-500" },
    { value: "cyan", label: "Cyan", bg: "bg-cyan-500" }
  ];
  const [units, setUnits] = useState([
    {
      unit_name: "",
      subunits: ["", "", "", ""]
    }
  ]);
  const [loading, setLoading] = useState(false);

  // Helper function to format text: fix grammar, capitalize first letter of each word
  const formatText = (text) => {
    if (!text || !text.trim()) return text;
    // Trim whitespace
    let formatted = text.trim();
    // Capitalize first letter of each word (title case)
    formatted = formatted
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formatted;
  };

  const handleAddUnit = () => {
    setUnits([...units, { unit_name: "", subunits: ["", "", "", ""] }]);
  };

  const handleRemoveUnit = (unitIndex) => {
    if (units.length > 1) {
      setUnits(units.filter((_, i) => i !== unitIndex));
    }
  };

  const handleUnitNameChange = (unitIndex, value) => {
    const updated = [...units];
    updated[unitIndex].unit_name = value;
    setUnits(updated);
  };

  const handleUnitNameBlur = (unitIndex) => {
    const updated = [...units];
    updated[unitIndex].unit_name = formatText(updated[unitIndex].unit_name);
    setUnits(updated);
  };

  const handleSubunitChange = (unitIndex, subunitIndex, value) => {
    const updated = [...units];
    updated[unitIndex].subunits[subunitIndex] = value;
    setUnits(updated);
  };

  const handleSubunitBlur = (unitIndex, subunitIndex) => {
    const updated = [...units];
    updated[unitIndex].subunits[subunitIndex] = formatText(updated[unitIndex].subunits[subunitIndex]);
    setUnits(updated);
  };

  const handleAddSubunit = (unitIndex) => {
    const updated = [...units];
    updated[unitIndex].subunits.push("");
    setUnits(updated);
  };

  const handleRemoveSubunit = (unitIndex, subunitIndex) => {
    const updated = [...units];
    if (updated[unitIndex].subunits.length > 1) {
      updated[unitIndex].subunits = updated[unitIndex].subunits.filter((_, i) => i !== subunitIndex);
      setUnits(updated);
    }
  };

  const handleSaveCurriculum = async () => {
    // Validate
    if (!formData.subject_name.trim()) {
      toast.error("Please enter a subject name");
      return;
    }

    const validUnits = units.filter(u => u.unit_name.trim() && u.subunits.some(s => s.trim()));
    if (validUnits.length === 0) {
      toast.error("Please add at least one unit with standards");
      return;
    }

    setLoading(true);
    setStep("saving");

    try {
      const user = await quest.auth.me();
      
      const curriculum = await quest.entities.Curriculum.create({
        teacher_id: user.id,
        subject_name: formData.subject_name,
        curriculum_difficulty: formData.curriculum_difficulty,
        color: formData.color
      });

      for (let unitIndex = 0; unitIndex < validUnits.length; unitIndex++) {
        const unitData = validUnits[unitIndex];
        const unit = await quest.entities.Unit.create({
          curriculum_id: curriculum.id,
          unit_name: unitData.unit_name,
          unit_order: unitIndex + 1,
          icon: "BookOpen"
        });

        const validSubunits = unitData.subunits.filter(s => s.trim());
        for (let subunitIndex = 0; subunitIndex < validSubunits.length; subunitIndex++) {
          await quest.entities.Subunit.create({
            unit_id: unit.id,
            subunit_name: validSubunits[subunitIndex],
            learning_standard: validSubunits[subunitIndex],
            subunit_order: subunitIndex + 1
          });
        }
      }

      setStep("complete");
      setTimeout(() => {
        navigate(createPageUrl("ManageCurriculum") + `?id=${curriculum.id}`);
      }, 2000);
    } catch (error) {
      toast.error("Failed to save curriculum: " + error.message);
      setStep("define");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubscriptionCheck requirePremium={true}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="max-w-[1320px] mx-auto p-8" style={{ fontFamily: '"Inter", sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Curriculum Building</h1>
              <p className="text-sm text-gray-500">Define your units and learning standards</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("TeacherCurricula"))}
            className="gap-2 border-gray-300 hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Mode selection — design from Curriculum Chooser handoff bundle */}
        {step === "define" && !mode && (
          <CurriculumMethodChooser
            onSelectManual={() => setMode("manual")}
            onSelectQuestAi={() => setMode("standards")}
          />
        )}

        {/* Standards picker mode */}
        {step === "define" && mode === "standards" && (
          <div className="space-y-6">
            <button onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Choose a different method
            </button>
            <StandardsPicker
              onStandardsSelected={({ subjectName, units: importedUnits }) => {
                setFormData(f => ({ ...f, subject_name: subjectName }));
                setUnits(importedUnits);
                setMode("manual");
              }}
            />
          </div>
        )}

        {step === "define" && mode === "manual" && (
          <div className="space-y-6">
            <button onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Choose a different method
            </button>
            {/* Subject Info */}
            <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Subject Name</label>
                    <Input
                      value={formData.subject_name}
                      onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                      placeholder="e.g., AP Biology, World History"
                      className="border-gray-200 h-12 text-base focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Difficulty Level</label>
                    <select
                      value={formData.curriculum_difficulty}
                      onChange={(e) => setFormData({ ...formData, curriculum_difficulty: e.target.value })}
                      className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Elementary">Elementary</option>
                      <option value="Middle">Middle School</option>
                      <option value="High">High School</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Curriculum Color</label>
                    <div className="flex gap-2">
                      {colorOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormData({ ...formData, color: option.value })}
                          className={`w-10 h-10 rounded-lg ${option.bg} ${
                            formData.color === option.value ? "ring-2 ring-offset-2 ring-gray-400" : ""
                          } transition-all hover:scale-110`}
                          title={option.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Units */}
            {units.map((unit, unitIndex) => (
              <Card key={unitIndex} className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold">
                        {unitIndex + 1}
                      </div>
                      <span className="text-white font-semibold">Unit {unitIndex + 1}</span>
                    </div>
                    {units.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUnit(unitIndex)}
                        className="text-white/70 hover:text-white hover:bg-white/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardContent className="p-8">
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Unit Name</label>
                    <Input
                      value={unit.unit_name}
                      onChange={(e) => handleUnitNameChange(unitIndex, e.target.value)}
                      onBlur={() => handleUnitNameBlur(unitIndex)}
                      placeholder="e.g., Introduction to Biology"
                      className="border-gray-200 h-12 text-base focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-4">Subunits / Learning Standards</label>
                    <div className="space-y-3">
                      {unit.subunits.map((subunit, subunitIndex) => (
                        <div key={subunitIndex} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-500 shrink-0">
                            {subunitIndex + 1}
                          </div>
                          <Input
                            value={subunit}
                            onChange={(e) => handleSubunitChange(unitIndex, subunitIndex, e.target.value)}
                            onBlur={() => handleSubunitBlur(unitIndex, subunitIndex)}
                            placeholder=""
                            className="border-gray-200 h-11 focus:border-blue-500 focus:ring-blue-500"
                          />
                          {unit.subunits.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubunit(unitIndex, subunitIndex)}
                              className="text-gray-400 hover:text-red-500 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddSubunit(unitIndex)}
                      className="mt-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Standard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Unit Button */}
            <button
              onClick={handleAddUnit}
              className="w-full py-5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Another Unit
            </button>

            {/* Save Button */}
            <Button
              onClick={handleSaveCurriculum}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Save Curriculum
            </Button>
          </div>
        )}


        {step === "saving" && (
          <Card className="border border-gray-200">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-black mb-2">Saving Your Curriculum</h2>
              <p className="text-gray-600">Creating units and standards...</p>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card className="border border-gray-200">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-black mb-2">Curriculum Created!</h2>
              <p className="text-gray-600">Redirecting to content management...</p>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </SubscriptionCheck>
  );
}