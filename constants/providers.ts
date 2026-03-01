/**
 * Venezuelan Internet Service Providers (ISPs) and their ASNs
 * Verified and updated
 */
export const VENEZUELA_ISPS: Record<string, { asn: number; name: string }> = {
  CANTV: { asn: 8048, name: "CANTV" },
  INTER: { asn: 21826, name: "Inter" },
  NETUNO: { asn: 11562, name: "Net Uno" },
  DIGITEL: { asn: 27717, name: "Digitel" }, // Main ASN
  MOVISTAR: { asn: 6306, name: "Movistar" }, // Correct ASN for Telefonica VE
  AIRTEK: { asn: 61461, name: "Airtek" },
  THUNDERNET: { asn: 272809, name: "Thundernet" },
  FIBEX: { asn: 264628, name: "Fibex" },
  NETCOM: { asn: 269749, name: "Netcom Plus" },
  GANDALF: { asn: 269750, name: "Gandalf" },
  VNET: { asn: 264639, name: "VNET" },
  GOLDDATA: { asn: 266527, name: "Gold Data" },
};

export type ISPProvider = keyof typeof VENEZUELA_ISPS;
