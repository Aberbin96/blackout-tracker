const axios = require("axios");

const providers = {
  DIGITEL_NEW: 27717,
  DIGITEL_ALT: 264731,
  MOVISTAR_NEW: 6306,
  VNET_SEARCH: 264639, // Still checking
  GOLDDATA_SEARCH: 266527,
};

async function check() {
  for (const [name, asn] of Object.entries(providers)) {
    try {
      const resp = await axios.get(
        `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`,
        { timeout: 10000 },
      );
      const prefixes = resp.data.data.prefixes.filter(
        (p) => !p.prefix.includes(":"),
      );
      console.log(`${name} (AS${asn}): ${prefixes.length} prefixes`);
      prefixes.forEach((p) => console.log(`  ${p.prefix}`));
    } catch (e) {
      console.log(`${name}: Error ${e.message}`);
    }
  }
}

check();
