import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import { COLORS, SIZES } from "./styles.js";

export default function Branding({ branding, accent }) {
  const accentColor = accent || branding?.accentColor || COLORS.brand;
  const businessName = branding?.businessName || "Quest Learning";
  const tutorName = branding?.tutorName;
  const contactInfo = branding?.contactInfo;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 28,
      }}
    >
      {branding?.logoUrl ? (
        <Image
          src={branding.logoUrl}
          style={{ width: 36, height: 36, objectFit: "contain" }}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: accentColor,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 16,
              fontFamily: "Helvetica-Bold",
            }}
          >
            Q
          </Text>
        </View>
      )}
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
