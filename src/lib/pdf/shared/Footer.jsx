import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import { COLORS, SIZES } from "./styles.js";
import { defaultLogoUrl } from "./Branding.jsx";

export default function Footer({ branding }) {
  const businessName = branding?.businessName || "questlearning.co";
  const logoUrl = branding?.logoUrl || defaultLogoUrl();

  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 24,
        left: 54,
        right: 54,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Image
          src={logoUrl}
          style={{ width: 14, height: 14, objectFit: "contain", borderRadius: 3 }}
        />
        <Text style={{ fontSize: SIZES.footer, color: COLORS.ink3 }}>
          {businessName}
        </Text>
      </View>
      <Text
        style={{ fontSize: SIZES.footer, color: COLORS.ink3 }}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}
