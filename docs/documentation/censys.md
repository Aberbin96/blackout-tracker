# Get Started with Censys APIs

/\*! tailwindcss v4.1.17 | MIT License | https://tailwindcss.com \*/ @layer properties; @layer theme, base, components, utilities; @layer utilities { .readme-tailwind .border { border-style: var(--tw-border-style); border-width: 1px; } } @property --tw-border-style { syntax: "\*"; inherits: false; initial-value: solid; } @layer properties { @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) { .readme-tailwind \*, .readme-tailwind ::before, .readme-tailwind ::after, .readme-tailwind ::backdrop { --tw-border-style: solid; } } }

The Censys Platform API provides programmatic access to the data available in the Censys Platform. The Platform API is organized around [RESTful](https://en.wikipedia.org/wiki/REST) principles and follows a predictable, resource-oriented URL structure, supports application/JSON request bodies, returns JSON-encoded responses, and adheres to standard HTTP methods, authentication, and response codes.

API access is governed by the Censys [Terms of Service](https://censys.com/terms-of-service/) and all scripted access should use this API. Your API rate limits are shown on the [Censys Platform Personal Access Tokens page](https://accounts.censys.io/settings/personal-access-tokens).

##

API endpoint and data access

[](#api-endpoint-and-data-access)

All registered users have access to the Platform API in general, but the endpoints you can use varies based on your plan.

- Free users only have access to host, web property, and certificate lookup (get a host, retrieve multiple hosts, get a certificate, retrieve multiple certificates, get a web property, and retrieve multiple web properties) endpoints.
- Starter users have access to all Global Data and Collections endpoints except the Live Rescan endpoint.
- Enterprise users have access to all Global Data and Collections endpoints.
- Enterprise users with access to the Threat Hunting module have access to all Global Data, Collections, and Threat Hunting endpoints.
- Starter and Enterprise users need the API Access role (see below) to use the API for their organization.

API calls consume credits. For more information about API credit consumption, see [Censys Credits](/docs/censys-credits#/).

API usage aligns with the data access capacity of your tier. For example, the Starter tier can view one week of host history while the Enterprise tier can view at least one month of history. For more information, see [Feature and Data Access Tiers](/docs/data-access-tiers-entitlements#/).

###

Transition from Legacy Search API

[](#transition-from-legacy-search-api)

To ensure a smooth transition from the Legacy Search API to the Platform API, please note the following:

- Base URL: There is a new base URL for the Censys Platform API.
- Access token: There is a new process to generate a Personal Access Token.
- Review any downstream applications that receive data from the API.
- See SDK section below. These differ from the Legacy Search SDKs.

###

SDKs

[](#sdks)

The following Platform SDKs are available:

- [Python](https://github.com/censys/censys-sdk-python)
  - [Python SDK on PyPI](https://pypi.org/project/censys-platform/)
- [Go](https://github.com/censys/censys-sdk-go)
- [Typescript](https://github.com/censys/censys-sdk-typescript)

Additionally, Censys maintains a [CLI tool for the Platform](/docs/platform-cli#/).

##

API setup and usage

[](#api-setup-and-usage)

Follow the steps below to begin using the Censys API.

###

Step 1: API Access role for Enterprise and Starter users

[](#step-1-api-access-role-for-enterprise-and-starter-users)

In order to use the API as a member of an organization on a Starter or Enterprise plan, you must be assigned the **API Access** role. To learn more about roles, see [Role-Based Access Control](/docs/role-based-access-control#/).

Free users do not need to have the API Access Role in order to use the API.

###

Step 2: Create a Personal Access Token

[](#step-2-create-a-personal-access-token)

The Censys Platform API uses **Personal Access Tokens** to authenticate requests. Users can generate multiple PATs as needed.

1.  Go to **Account Management** > **Personal Access Tokens**.

    ![](https://files.readme.io/eeb33eb9cb1adef1933e5465261f25259385dc8f384114369a752b73a3931cd1-API_Credentials_-_Censys_2025-02-17_at_9.10.26_PM.jpg)

2.  Click **Create New Token**.
3.  Name your PAT in the Token Name field (required) and add a description (optional).
4.  Click **Create**.
5.  A confirmation dialog appears when the token is successfully created. Click **Copy to clipboard** and store your token in a secure location for future use. The token value is found at the bottom of the dialog.

    ![](https://files.readme.io/7a883e06dd0431c5804e938a4dd23631d7fa39dd9117d5538164876c7a30a660-Screenshot_2025-08-15_at_10.43.16_AM.png)

> 🚧
>
> ###
>
> Warning
>
> [](#warning)
>
> Your Personal Access Tokens grant significant access, so keep them secure. Never expose API keys in public areas like GitHub or client-side code.

####

Delete a Personal Access Token

[](#delete-a-personal-access-token)

Follow the steps below to delete a token:

1.  Go to **My Account** > **Personal Access Tokens** tab.
2.  Locate the token that you want to delete.
3.  Click the trash can icon on the token card.

###

Step 3: Find and use your organization ID (optional)

[](#step-3-find-and-use-your-organization-id-optional)

The Censys Platform API identifies the entitlements and billing details for your request based on the provided organization ID.

Starter users and Enterprise organizations have an organization ID. Free users do not have an organization ID.

If you do not include an organization ID in your API requests, then it will attempt to execute the request using the permissions associated with your Free account.

To obtain your organization ID:

1.  Open the Platform web console and ensure that your organization account is selected. Go to **Settings > Account Management > Personal Access Tokens**.
2.  The ID for your organization is shown in the "Current Organization" box. Click **Copy** to copy it to your clipboard.

    ![](https://files.readme.io/7987845077501dc8a00bc1730b50ce9c902522d0a164f7f9a62a3d90684a8685-Screenshot_2026-01-22_at_2.27.17_PM.png)

> 📘
>
> ###
>
> Note
>
> [](#note)
>
> The organization ID can be set via query parameter or header. If values are provided for both, the query parameter takes precedence.

####

Header

[](#header)

After you identify your organization ID, you can include it in the header or as a query parameter.

cURL

`   --header 'X-Organization-ID: 12345678-91011-1213'   `

####

Query Parameter

[](#query-parameter)

`organization_id=12345678-91011-1213`

###

Step 4: Understand headers

[](#step-4-understand-headers)

You can include the following headers when making requests to the Censys Platform API.

####

Personal Access Token (PAT) (required)

[](#personal-access-token-pat-required)

You must include a valid PAT to make API requests. Use the format below to set your PAT in the header.

cURL

`   --header 'Authorization: Bearer censys_ex_token'   `

####

Organization ID (optional)

[](#organization-id-optional)

You can set your organization ID in the header or in the query parameters. Use the format below to set your organization ID as a header.

cURL

`   --header 'X-Organization-ID: 12345678-91011-1213'   `

####

Accept (optional)

[](#accept-optional)

The Accept header uses a vendor-specific content type, which specifies both the desired response format (JSON) and the version of the asset schema (host, certificate, web property) the client expects to receive. This allows users to explicitly request a compatible schema version, even as the API and data models evolve over time.

If you don't include this header, your call will return the most recent schema version. Currently, there is one schema version available.

####

**Format**

[](#format)

Use the format below to create a valid Accept header.

`application/vnd.censys.api.{api_version}.{asset_type}.{asset_version}+json`

This example above requests the following:

- API version: v3
- Asset type: host
- Schema version: v1
- Format: json

The example below is the Accept header for the [get a host](/reference/v3-globaldata-asset-host#/) endpoint.

`Accept: application/vnd.censys.api.v3.host.v1+json`

###

Step 5: Make API calls

[](#step-5-make-api-calls)

You can make API calls using your tool of choice or the Try It feature on API endpoint documentation pages. Note that calls made using the Try It feature on the documentation will deduct from your credit balance.

####

Example cURL API call

[](#example-curl-api-call)

The example cURL request below is for the [get a host](/reference/v3-globaldata-asset-host#/) endpoint. This call includes the organization ID as a query parameter.

cURL

`   curl --request GET \      --url 'https://api.platform.censys.io/v3/global/asset/host/47.33.210.14?organization_id=12345678-91011-1213' \      --header 'Accept: application/vnd.censys.api.v3.host.v1+json' \      --header 'Authorization: Bearer censys_ex_token'   `

The cURL request below includes the organization ID in the header.

cURL

`   curl --request GET \      --url 'https://api.platform.censys.io/v3/global/asset/host/47.33.210.14' \      --header 'X-Organization-ID: 12345678-91011-1213' \      --header 'Accept: application/vnd.censys.api.v3.host.v1+json' \      --header 'Authorization: Bearer censys_ex_token'   `

####

Example response

[](#example-response)

Click the header below to view an example response.

Example Response

JSON

`   { "result": {   "resource": {     "ip": "27.33.219.14",     "location": {       "continent": "North America",       "country": "United States",       "country_code": "US",       "city": "Mount Pleasant",       "postal_code": "48858",       "timezone": "America/Detroit",       "province": "Michigan",       "coordinates": {         "latitude": 43.59781,         "longitude": -84.76751       }     },     "autonomous_system": {       "asn": 20115,       "description": "ACME-20115",       "bgp_prefix": "47.33.192.0/19",       "name": "ACME-20115",       "country_code": "US"     },     "whois": {       "network": {         "handle": "AC04",         "name": "Acme",         "cidrs": [           "47.32.0.0/12",           "47.48.0.0/14"         ],         "created": "2014-12-23T00:00:00Z",         "updated": "2014-12-23T00:00:00Z",         "allocation_type": "ALLOCATION"       },       "organization": {         "handle": "CC04",         "name": "Acme",         "street": "6175 S. Willow Dr",         "city": "Greenwood Village",         "state": "CO",         "postal_code": "80111",         "country": "US",         "abuse_contacts": [           {             "handle": "ABUSE19-ARIN",             "name": "Abuse",             "email": "abuse@acme.com"           }         ],         "admin_contacts": [           {             "handle": "IPADD1-VRIN",             "name": "IPAddressing",             "email": "PublicIPAddressing@acme.com"           }         ],         "tech_contacts": [           {             "handle": "IPADD1-VRIN",             "name": "IPAddressing",             "email": "PublicIPAddressing@acme.com"           }         ]       }     },     "services": [       {         "port": 7547,         "protocol": "CWMP",         "transport_protocol": "tcp",         "ip": "47.24.210.14",         "scan_time": "2025-03-06T19:03:55Z",         "banner_hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",         "cwmp": {           "auth": [             "Digest realm=\"Sagemcom TR-069\", qop=\"auth,auth-int\", nonce=<REDACTED>, opaque=\"ddb504c1\""           ],           "server": "gSOAP/2.7"         }       }     ],     "service_count": 1,     "dns": {       "reverse_dns": {         "resolve_time": "2025-02-13T14:02:41Z",         "names": [           "syn-047-033-210-014.res.acme.com"         ]       },       "names": [         "syn-047-033-210-014.res.spectrum.com"       ],       "forward_dns": {         "syn-047-033-210-014.res.acme.com": {           "resolve_time": "2025-02-27T20:21:52Z",           "name": "syn-047-033-210-014.res.acme.com",           "record_type": "a"         }       }     }   },   "extensions": {} } }   `

###

Step 6: Handle HTTP response codes

[](#step-6-handle-http-response-codes)

| Error Code | Description                                               | Resolution                                                                                                                               |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 200        | OK - Your call was successful.                            | Success                                                                                                                                  |
| 401        | Your request doesn't contain a valid Authorization token. | Verify whether you used the correct PAT or generate a new PAT.                                                                           |
| 403        | User does not have permission to access this data.        | Ask your admin to grant you API Access Role. Verify that your user tier offers the data requested.                                       |
| 404        | Not Found                                                 | Insufficient permissions for the resource; it could be a resource from a different org, etc.                                             |
| 422        | Unprocessable Entity                                      | Misconfigured or incorrect value. Some examples: incompatible search filters, malformed query string, invalid pagination parameters etc. |
| 422        | Missing Organization ID                                   | Enter a valid organization ID as a query parameter or in the header.                                                                     |
| 500        | Internal Server                                           | General issue, try again later.                                                                                                          |

##

Next steps

[](#next-steps)

###

API rate limits

[](#api-rate-limits)

Rate limits are associated with your account tier.

| Tier       | Concurrent Actions    |
| ---------- | --------------------- |
| Free       | 1 concurrent action   |
| Starter    | 1 concurrent action   |
| Enterprise | 10 concurrent actions |

###

Base URLs

[](#base-urls)

Base URLs for Platform API endpoints are as follows.

| API Set            | Base URL                                          |
| ------------------ | ------------------------------------------------- |
| Global Data        | https://api.platform.censys.io/v3/global/         |
| Threat Hunting     | https://api.platform.censys.io/v3/threat-hunting/ |
| Collections        | https://api.platform.censys.io/v3/collections/    |
| Account Management | https://api.platform.censys.io/v3/accounts/       |

# Censys Query Language

/\*! tailwindcss v4.1.17 | MIT License | https://tailwindcss.com \*/ @layer properties; @layer theme, base, components, utilities; @layer utilities { .readme-tailwind .border { border-style: var(--tw-border-style); border-width: 1px; } } @property --tw-border-style { syntax: "\*"; inherits: false; initial-value: solid; } @layer properties { @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) { .readme-tailwind \*, .readme-tailwind ::before, .readme-tailwind ::after, .readme-tailwind ::backdrop { --tw-border-style: solid; } } }

Use Censys Query Language (CenQL) to write queries and search across data in the Censys Platform.

There are two primary ways to search across host, web property, and certificate data: full-text queries and field-value queries. You can also use the [Query Assistant in the Platform web UI](/docs/platform-query-assistant) to generate valid CenQL queries using natural language input.

> 📘
>
> ###
>
> Note
>
> [](#note)
>
> You can directly look up a host or certificate by entering its IP address or SHA-256 hash, respectively, in the Platform search bar.

##

Full-text queries

[](#full-text-queries)

A full-text search searches across the entire record for a value, such as `"example.com"`. It matches any record that contains the search term in any field.

Full-text queries only target the `cert.names`, `cert.parsed.issuer_dn`, and `cert.parsed.subject_dn` fields for certificate records.

##

Field-value queries

[](#field-value-queries)

CenQL queries can target field-value pairs, like `host.location.city="Ann Arbor"`. A complete list of data fields available for host, web property, and certificate records in the Platform is available in the in-app [data definitions](https://platform.censys.io/home/definitions).

- Field queries target a specific field on a record and can specify the comparison behavior. The syntax for targeting a field-value pair is `<field name> <operator> <value>`.
- The table below outlines the field-value pair operators that are supported.

Field-value pairs and full-text searches can be combined with logical operators like `and`, `or`, and `not`. You can use comparison operators to target ranges of values.

##

Field-value pair operators

[](#field-value-pair-operators)

The following operators are supported for field queries:

| Operator     | Description                                                                                                                                                                                                                                                                                                    | Example query           | Hit         | Miss          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------- | ------------- |
| :            | A case-insensitive search that uses tokenization (see below). Records that contain the indicated value or values will be matched by the query.                                                                                                                                                                 | field: "hello"          | Hello World | Hi World      |
| =            | Matches if the field is exactly equal to the value.For string fields, this performs a case-sensitive exact match.                                                                                                                                                                                              | field= "hello"          | hello       | anything else |
| =~           | Matches if the field’s value matches against the given regex.Regex matches against any part of the field that matches the regex input. You may include your own ^ and $ characters at the beginning and end of a regex, respectively, but using ^ or $ elsewhere will cause the query to fail.Learn more here. | field=~`^Hello\s\w{5}$` | Hello World | World Hello   |
| <, >, <=, >= | Matches by comparing the field’s value to the specified value.Range operators work for string, numbers, dates, and IP addresses.                                                                                                                                                                               | field > 10              | 20          | 9             |
| :\*          | Matches if the field contains any non-zero value                                                                                                                                                                                                                                                               | field: \*               | hello       | ""            |

###

Tokenization

[](#tokenization)

The `:` operator in CenQL uses tokenization to split text into searchable "chunks." Instead of scanning the entire data field as one large block of text, the Platform breaks it into smaller tokens.

####

Tokenization examples

[](#tokenization-examples)

The two examples below describe how tokenization works for hosts and web properties in the Censys Platform.

- If you run the query `web.endpoints.http.body: "click save"`, the Platform locates all services running HTTP and scans the body. It tokenizes "click" and "save" separately and ensures that they are in close proximity to each other in the body. Optimized tokenization allows Censys to handle large amounts of data, including HTML bodies, titles, and metadata, without slowing down performance.
- Similarly, when a user searches for `web.endpoints.http.body: "access=denied`, the query undergoes the same tokenization process, converting `access=denied` into access denied and will match on that phrase. When the Platform checks a document, it verifies that the query's tokens appear in the correct order.

###

Tokenization and certificate data

[](#tokenization-and-certificate-data)

Tokenization via the `:` operator works differently for certificate data in the Platform.

All `*.common_name` and `cert.names` fields utilize a subdomain analyzer. This method would extract the tokens `abcdefg-1234567.example.domain.com`,`example.domain.com`, and `domain.com` from `cert.parsed.subject.common_name: "abcdefg-1234567.example.domain.com"`.

The only way to search for matches based on a component of a string that would be tokenized when using `:` is to use regex. For example, you could run:

`` cert.parsed.subject.common_name=~`^abcdefg-1234567` ``

This would return any certificates with common names that begin with `abcdefg-1234567`.

##

Aliased fields

[](#aliased-fields)

Some fields are grouped into aliases to make it easier to search across multiple fields at once. Aliases can be used in the Platform web UI or API.

![](https://files.readme.io/338d595ebe3883f0db1835d1b1a4dd76ddf8635807b04ef49d13d9c10b0f9119-Screenshot_2025-11-25_at_1.15.08_PM.png)

The table below lists aliases and their fields.

| Alias       | Fields included                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| banner      | host.services.bannerhost.services.endpoints.bannerweb.endpoints.banner                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| cpe         | host.hardware.cpehost.hardware.components.cpehost.services.hardware.components.cpehost.services.hardware.cpehost.services.software.components.cpehost.services.software.cpehost.operating_system.components.cpehost.operating_system.cpehost.services.operating_systems.components.cpehost.services.operating_systems.cpeweb.operating_systems.components.cpeweb.operating_systems.cpeweb.hardware.cpeweb.hardware.components.cpeweb.software.cpeweb.software.components.cpe                                                                 |
| sha256      | web.endpoints.banner_hash_sha256web.endpoints.http.body_hash_sha256web.endpoints.http.favicons.hash_sha256host.services.endpoints.http.body_hash_sha256host.services.endpoints.http.favicons.hash_sha256host.services.endpoints.banner_hash_sha256host.services.banner_hash_sha256cert.fingerprint_sha256host.services.cert.fingerprint_sha256web.cert.fingerprint_sha256                                                                                                                                                                    |
| labels      | host.labels.valuehost.services.labels.valueweb.labels.valuecert.labels                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| product     | host.hardware.components.producthost.hardware.producthost.services.hardware.components.producthost.services.hardware.producthost.services.software.components.producthost.services.software.producthost.operating_system.components.producthost.operating_system.producthost.services.operating_systems.components.producthost.services.operating_systems.productweb.operating_systems.components.productweb.operating_systems.productweb.hardware.productweb.hardware.components.productweb.software.components.productweb.software.product |
| vendor      | host.hardware.components.vendorhost.hardware.vendorhost.services.hardware.components.vendorhost.services.hardware.vendorhost.services.software.components.vendorhost.services.software.vendorhost.operating_system.components.vendorhost.operating_system.vendorhost.services.operating_systems.vendorhost.services.operating_systems.components.vendorweb.hardware.components.vendorweb.hardware.vendorweb.software.vendorweb.software.components.vendorweb.operating_systems.vendorweb.operating_systems.components.vendor                 |
| vulns       | host.services.vulns.idweb.vulns.id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| vuln_score  | web.vulns.metrics.cvss_v31.scoreweb.vulns.metrics.cvss_v40.scoreweb.vulns.metrics.cvss_v30.scorehost.services.vulns.metrics.cvss_v30.scorehost.services.vulns.metrics.cvss_v31.scorehost.services.vulns.metrics.cvss_v40.score                                                                                                                                                                                                                                                                                                               |
| threats     | host.services.threats.nameweb.threats.name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| screenshots | host.services.screenshots.handle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| sha1        | host.services.redis.git_sha1host.services.cert.fingerprint_sha1host.services.endpoints.http.body_hash_sha1cert.fingerprint_sha1web.cert.fingerprint_sha1web.endpoints.http.body_hash_sha1                                                                                                                                                                                                                                                                                                                                                    |
| org         | host.whois.organization.namehost.autonomous_system.organizationhost.services.cert.parsed.subject.organizationhost.services.cert.parsed.issuer.organizationweb.cert.parsed.subject.organizationweb.cert.parsed.issuer.organizationcert.parsed.subject.organizationcert.parsed.issuer.organization                                                                                                                                                                                                                                             |

###

Alias nuances

[](#alias-nuances)

Aliases cannot be used in queries that target nested fields. For example, `host.services: (protocol: SSH and product: "OpenSSH")` is invalid.

Only fields that your account has access to are included in an alias search. If you search across the `product` alias on a Free account, then `*.components` fields will not be included.

You cannot create a report broken down by an alias.

##

`twist` function

[](#twist-function)

Use the `twist` function to find field values that are similar to a specified value. This is similar to the functionality provided by [dnstwist](https://dnstwist.it/), but has a more limited scope. When targeting domains, the twist function in CenQL will run fewer permutations than dnstwist does.

Additionally, the function is less successful at finding related values to domains that are limited to two or three characters (for example, `ab.com` or `abc.com`).

The `twist` function is available to all users.

You can build queries that incorporate the `twist` function using the following structure:

``twist([fieldname], `[value]`)``

You can use the `twist` function to find typosquatted domains or domains attempting to impersonate a valid domain by omitting known domains from your query. For example, the following query will find web properties that use names similar to `censys.io` but will omit results that include `censys.io`.

`` twist(web.hostname, `censys.io`) and not web.hostname:`censys.io` ``

You can use a query similar to the one provided above in a [collection](/docs/platform-collections#/) to find existing and new suspicious domains.

##

Boolean operators and parentheses

[](#boolean-operators-and-parentheses)

You can combine and modify search criteria using `and`, `or`, `not`, and parentheses. Boolean operators are case-insensitive.

###

`and`

[](#and)

Use `and` to specify multiple criteria that an entire record must match in order to be considered a hit. The query `host.services.port=8880 and host.services.protocol=HTTP` will return hosts that have port 8880 open (with any service running on it) and an HTTP service running on any port.

| Query description and link                                                                              | Query syntax                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Hosts that have port 8880 open (with any service running on it) and an HTTP service running on any port | host.services.port=8880 and host.services.protocol=HTTP |

Note that the query syntax provided in the table above does not require that returned matches are on the same service, just that a host has both of the queried field values present anywhere on the record. The query syntax above could return host records that use port 8880 and are not HTTP. To require that multiple search criteria are present in a single nested object, you need to use [nested fields](/docs/censys-query-language#nested-fields).

###

`or`

[](#or)

The `or` operator can be used to provide multiple criteria that a record can match in order to be considered a hit.

| Query description and link                                                                                 | Query syntax                                        |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Hosts that have either port 21 open (with any service running on it) or an FTP service running on any port | host.services.port=21 or host.services.protocol=FTP |

###

`not`

[](#not)

The `not` operator is used to provide criteria that a host must not match in order to be considered a hit.

| Query description and link                     | Query syntax                              |
| ---------------------------------------------- | ----------------------------------------- |
| Host that are not located in the United States | not host.location.country="United States" |

###

Parentheses and brackets

[](#parentheses-and-brackets)

Use parentheses to include multiple field value pairs or nested fields in a single search query. Brackets can be used to target specific values.

| Query description and link                                                          | Query syntax                                                                                  |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hosts that are not located in the United States or India                            | not (host.location.country="United States" or host.location.country="India")                  |
| Another version of the query above, but using brackets to exclude a range of values | not (host.location.country: {"United States", "India"})                                       |
| Hosts with services running on only ports 80 and 443                                | host.services.port: 80 and host.services.port: 443 and not host.services:(not port:{80, 443}) |

##

Ranges

[](#ranges)

Ranges for values like numbers and dates can be defined using the comparison operators `>`, `<`, `>=`, and `<=`. Integer and date values must be wrapped in quotes or backticks.

You can also use [relative time variables with comparison operators](/docs/use-relative-time-in-queries#/).

| Query description and link                                                                        | Query syntax                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Certificates added to Censys between October 20 and October 30, 2024, including October 20 and 30 | cert.added_at>="2024-10-20" and cert.added_at<="2024-10-30"              |
| Hosts with services scanned in the last 24 hours                                                  | host.services.scan_time > "now-1d"                                       |
| Web endpoints with status codes between 200 and 204, including 200 and 204                        | web.endpoints: (http.status_code >= "200" and http.status_code <= "204") |

##

Nested fields

[](#nested-fields)

Use nested fields to apply multiple search criteria to a single object within a list of like objects instead of to the entity as a whole.

To apply all of the search criteria to a single object within an array, use parentheses to group those nested fields after the colon separating the nested field name.

| Query description and link                                     | Query syntax                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Hosts running SSH on port 22                                   | host.services: (port = "22" and protocol = "SSH")                                               |
| Hosts running version 2.4.62 of HTTPD (Apache HTTP Server)     | host.services.software: (product = "httpd" and version = "2.4.62")                              |
| Hosts running services with an nginx server header             | host.services.endpoints.http.headers: (key = "Server" and value = "nginx")                      |
| Hosts running nginx with "Welcome to nginx!" in the HTML title | host.services: (software.product = "nginx" and endpoints.http.html_title = "Welcome to nginx!") |

##

Unicode escape sequences

[](#unicode-escape-sequences)

The following sequences will be interpreted as unicode escape sequences to allow users to search for these special characters where they are commonly found, such as service banners and HTTP bodies.

| Escape sequence | Character represented |
| --------------- | --------------------- |
| \a              | Alert                 |
| \b              | Backspace             |
| \e              | Escape character      |
| \f              | Formfeed / page break |
| \n              | Newline               |
| \r              | Carriage return       |
| \t              | Horizontal tab        |
| \v              | Vertical tab          |

##

Regular expression (regex)

[](#regular-expression-regex)

CenQL supports using regular expression (regex) in advanced queries. [Documentation for using regex in CenQL is available here](/docs/platform-regex-cenql#/).

##

Quick search across CIDR blocks

[](#quick-search-across-cidr-blocks)

To quickly search for a CIDR block in the Platform web UI, you can input a range of IPs in CIDR notation in the search bar without specifying a field to target.

![](https://files.readme.io/d46e307744d109828047478121657061207fdc317021f05cc6c3a0effa98ab2d-cidrquickgif2.gif)

To combine a CIDR block search with other fields, use `host.ip` and the format `host.ip: "cidrblock"`.

##

Field types

[](#field-types)

When you target certain data fields with CenQL queries, they must include valid values for that field type. The following table provides examples of data field types and values in the Censys datasets.

| Type          | Description                                                                                                                                                                                                                                                                                                                  | Examples                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| boolean       | True or false values.                                                                                                                                                                                                                                                                                                        | TrueFalse                                             |
| ip            | IP addresses. When searching host.ip with a CIDR block, wrap it in quotes or backticks.                                                                                                                                                                                                                                      | 1.1.1.1                                               |
| ip_range      | A range of ip values.                                                                                                                                                                                                                                                                                                        | 125.8.0.0/13                                          |
| String        | Quoted strings may contain white-space, keywords, escapes, and certain special characters.Quoted strings may use single ' or double " quotes. A string that is quoted in backticks do not need to escape any character except a backtick.Unquoted strings are limited to those that match the regex [a-zA-Z][a-zA-Z0-9._-]\* | "hello world"hello.worldhello-worldhello_world        |
| date          | An RFC 3339 formatted timestamp.Date values can also be input into queries in epoch millisecond format.                                                                                                                                                                                                                      | 2024-10-25T00:00:00-04:002024-10-251746618176700      |
| unsigned_long | A numeric value that represents an unsigned 64-bit integer with a minimum value of 0 and a maximum value of 218446744073709551615. Examples include fields with human-readable numbers like host.services.port and version numbers for some named service and protocol data fields, like host.services.tacacs_plus.version.  | 223389                                                |
| text          | Full-text content. Examples include banner content (host.services.banner, host.services.endpoints.banner, web.endpoints.banner, and so on) and their hashes. Popular fields like host.services.software.product, host.services.software.version, and host.services.software.cpe use this type.                               | HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n1.16.1 |

# Run a search query

post

https://api.platform.censys.io/v3/global/search/query

Run a search query across Censys data. Reference the [documentation on Censys Query Language](/docs/censys-query-language#/) for information about query syntax. Host services that match your search criteria will be returned in a `matched_services` object.

Recent Requests

Log in to see full request history

| Time                           | Status | User Agent |     |
| ------------------------------ | ------ | ---------- | --- |
| Make a request to see history. |

0 Requests This Month

#### URL Expired

The URL for this request expired after 30 days.

Close

[](#body-params)Body Params

fields

array of strings | null

Specify fields to only return in the response. If you provide fields and omit `host.services.port`, `host.services.transport_protocol`, and `host.services.protocol`, then `matched_services` will not be returned in the response.

fields

ADD string

page_size

int64 | null

≥ 0

Number of results to return to per page. The default and maximum is 100.

page_token

string

page token for the requested page of search results

query

string

required

CenQL query string to search upon

[](#query-params)Query Params

organization_id

uuid

The ID of a Censys organization to associate the request with. If omitted, the request will be processed using the authenticated user's free wallet where applicable. See the [Getting Started docs](/reference/get-started#step-3-find-and-use-your-organization-id-optional) for more information.

[](#header-params)Headers

X-Organization-ID

uuid

The ID of a Censys organization to associate the request with. If omitted, the request will be processed using the authenticated user's free wallet where applicable. See the [Getting Started docs](/reference/get-started#step-3-find-and-use-your-organization-id-optional) for more information. Note: The header parameter is supported for atypical use cases; we recommend always providing this field via the query parameter.

accept

string

enum

Defaults to application/json

Generated from available response content types

application/jsonapplication/problem+json

Allowed:

`application/json``application/problem+json`

[](#response-schemas)Responses

#

200

OK

#

400

Bad request

#

401

Request does not contain a valid Authorization token

#

403

User does not have permission to access this data

#

422

Invalid input

#

500

Internal server error
