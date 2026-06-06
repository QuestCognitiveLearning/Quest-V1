import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import { COLORS, SIZES } from "./styles.js";

// Default Quest Learning logo bundled with the public assets. The PDF
// renders client-side so a same-origin path resolves through window.location.
// Fall back to a URL string so server-side rendering (Edge Function) works
// too once that path lands.
const QUEST_LOGO_URL =
  typeof window !== "undefined" && window?.location?.origin
    ? `${window.location.origin}/quest-logo-on-white.png`
    : "https://www.questlearning.co/quest-logo-on-white.png";

export function defaultLogoUrl() {
  return QUEST_LOGO_URL;
}

export default function Branding({ branding, accent }) {
  const accentColor = accent || branding?.accentColor || COLORS.brand;
  const businessName = branding?.businessName || "Quest Learning";
  const tutorName = branding?.tutorName;
  const contactInfo = branding?.contactInfo;
  const logoUrl = branding?.logoUrl || QUEST_LOGO_URL;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 28,
      }}
    >
      <Image
        src={logoUrl}
        style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }}
      />
      <View>
        <Text
          style={{
            fontSize: SIZES.h3,
            fontFamily: "Helvetica-Bold",
            color: COLORS.ink,
          }}
        >
          {businessName}
        </Text>
        {(tutorName || contactInfo) && (
          <Text style={{ fontSize: SIZES.small, color: COLORS.ink3 }}>
            {[tutorName, contactInfo].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
    </View>
  );
}
