import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Demo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-6 py-12">
        <Button 
          variant="outline" 
          onClick={() => navigate(createPageUrl("Landing"))}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-8 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Quest Learning Demo</h1>
            <p className="text-blue-100 text-lg">See how Quest Learning transforms education</p>
          </div>

          <div className="bg-white rounded-b-2xl shadow-2xl p-8">
            <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src="https://www.youtube.com/embed/OWunABzWTvM"
                title="Quest Learning Demo"
                className="absolute top-0 left-0 w-full h-full rounded-xl"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}