const axios = require("axios");

const providers = {
  CANTV: 8048,
  INTER: 21826,
  NETUNO: 11562,
  DIGITEL: 264726,
  MOVISTAR: 22313,
  AIRTEK: 61461,
  THUNDERNET: 272809,
  FIBEX: 264628,
  NETCOM: 269749,
  GANDALF: 269750,
  VNET: 264639,
  GOLDDATA: 266527,
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
      console.log(`${name}: ${prefixes.length} prefixes`);
    } catch (e) {
      console.log(`${name}: Error ${e.message}`);
    }
  }
}

check();
