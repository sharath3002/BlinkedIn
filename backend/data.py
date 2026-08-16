"""Static reference data for BlinkedIn — companies, roles, locations, prompts.
Split out of server.py to keep the main module focused on routes.
"""
import re

DEFAULT_AGENT_PROMPT = """You are a job-posting extraction agent for BlinkedIn.
Given raw HTML (or DOM text) from a career page, your task is to:
1. Identify current, active job openings.
2. Extract up to 10 distinct openings.
3. For each opening, return a JSON object with keys:
   - role (string)
   - location (string — city + country if visible, else "Remote")
   - experience (string, e.g. "3-5 yrs")
   - description (2 sentences)
   - apply_url (absolute URL if present, else omit)
   - posted_date (ISO 8601 "YYYY-MM-DD" if a date, "today"/"yesterday"/"N days ago" phrase is visible on
     the page; if truly no signal exists, use null — do NOT invent a date)
4. Order the array with the MOST RECENTLY POSTED role first (most recent posted_date descending).
   If posted_date is unknown for some entries, place entries with a known recent date before unknown ones.
5. Skip anything that isn't a real job opening (e.g., "Life at company", "Benefits", nav links).

Return ONLY a valid JSON array — no prose, no markdown. Empty array [] if no jobs found."""


def logo_url(domain: str) -> str:
    return f"https://logo.clearbit.com/{domain}"


# Custom domain overrides where the automatic guess would fail
_DOMAIN_OVERRIDES = {
    "Google (Alphabet)": "google.com",
    "X (Twitter)": "x.com",
    "Block (Square)": "block.xyz",
    "Broadcom (incl. VMware)": "broadcom.com",
    "Splunk (Cisco)": "splunk.com",
    "Red Hat (IBM)": "redhat.com",
    "Booking.com": "booking.com",
    "Alibaba Group": "alibaba.com",
    "Baidu": "baidu.com",
    "ByteDance (TikTok)": "bytedance.com",
    "Tencent": "tencent.com",
    "JD.com": "jd.com",
    "DiDi Global": "didiglobal.com",
    "SoftBank Group": "softbank.jp",
    "Rakuten Group": "rakuten.com",
    "Delivery Hero": "deliveryhero.com",
    "Just Eat Takeaway.com": "justeattakeaway.com",
    "Dassault Systèmes": "3ds.com",
    "Amadeus IT Group": "amadeus.com",
    "GitHub (Microsoft)": "github.com",
    "L&T; Technology Services": "ltts.com",
    "Google India (Bengaluru)": "google.com",
    "Microsoft India (Bengaluru)": "microsoft.com",
    "Amazon India (Bengaluru)": "amazon.com",
    "SAP Labs India (Bengaluru)": "sap.com",
    "Cisco India (Bengaluru)": "cisco.com",
    "Intel India (Bengaluru)": "intel.com",
    "Oracle India (Bengaluru)": "oracle.com",
    "Adobe India (Bengaluru)": "adobe.com",
    "Goldman Sachs (Bengaluru)": "goldmansachs.com",
    "JPMorgan Chase (Bengaluru)": "jpmorganchase.com",
    "Walmart Global Tech India (Bengaluru)": "walmart.com",
    "Target India (Bengaluru)": "target.com",
    "Dell India (Bengaluru)": "dell.com",
    "Qualcomm India (Bengaluru)": "qualcomm.com",
    "Samsung R&D; Institute (Bengaluru)": "samsung.com",
    "Philips Innovation Campus (Bengaluru)": "philips.com",
    "Siemens Technology India (Bengaluru)": "siemens.com",
    "Texas Instruments India (Bengaluru)": "ti.com",
    "Boeing India (Bengaluru)": "boeing.com",
    "Airbus India (Bengaluru)": "airbus.com",
    "Zomato / Eternal": "zomato.com",
    "Ola (ANI Technologies)": "olacabs.com",
    "ANI Technologies": "olacabs.com",
    "Ola Electric": "olaelectric.com",
    "Cult.fit (CureFit)": "cult.fit",
    "BYJU'S": "byjus.com",
    "Zoho Corporation": "zoho.com",
    "Loom (Atlassian)": "loom.com",
    "monday.com": "monday.com",
    "Sea Limited (Shopee)": "sea.com",
    "GoTo Group (Gojek)": "goto-group.com",
    "GitLab": "gitlab.com",
    "Tata Consultancy Services (TCS)": "tcs.com",
    "Cognizant (India)": "cognizant.com",
    "Capgemini India": "capgemini.com",
    "Accenture India": "accenture.com",
    "IBM India": "ibm.com",
    "Open Financial Technologies": "open.money",
    "Netskope (Bengaluru R&D;)": "netskope.com",
    "Harness (Bengaluru)": "harness.io",
    "Postman (Bengaluru HQ)": "postman.com",
    "The Coca-Cola Company": "coca-cola.com",
    "PepsiCo": "pepsico.com",
    "Toyota Motor Corporation": "toyota.com",
    "Volkswagen Group": "volkswagen.com",
    "Ford Motor Company": "ford.com",
    "General Motors": "gm.com",
    "American Express": "americanexpress.com",
    "Fidelity Investments": "fidelity.com",
    "Bank of America": "bankofamerica.com",
    "Morgan Stanley": "morganstanley.com",
    "Wells Fargo": "wellsfargo.com",
    "Deutsche Bank": "db.com",
    "McKinsey & Company": "mckinsey.com",
    "Boston Consulting Group (BCG)": "bcg.com",
    "Bain & Company": "bain.com",
    "Procter & Gamble": "pg.com",
    "Google DeepMind": "deepmind.google",
    "Stability AI": "stability.ai",
    "Character.AI": "character.ai",
    "Scale AI": "scale.com",
    "Perplexity AI": "perplexity.ai",
    "Mistral AI": "mistral.ai",
    "XAI": "x.ai",
    "OpenAI": "openai.com",
    "Anthropic": "anthropic.com",
    "Hugging Face": "huggingface.co",
    "SoFi": "sofi.com",
    "Anduril Industries": "anduril.com",
    "Remote.com": "remote.com",
    "Yellow.ai": "yellow.ai",
    "Zapier": "zapier.com",
    "GoTo Group": "goto-group.com",
    "LTIMindtree": "ltimindtree.com",
    "HCLTech": "hcltech.com",
    "Delivery Hero SE": "deliveryhero.com",
    "Alphabet": "abc.xyz",
    "N26": "n26.com",
    "Sea Limited": "sea.com",
    "ANZ": "anz.com",
    "IBM (India)": "ibm.com",
}

# All ~280 companies from user's PDF + earlier seed list
_ALL_COMPANY_NAMES = [
    # Big Tech
    "Google (Alphabet)", "Microsoft", "Amazon", "Apple", "Meta", "Netflix", "NVIDIA", "Tesla",
    "IBM", "Oracle", "Salesforce", "Adobe", "Intel", "Qualcomm", "Cisco", "SAP",
    "Dell Technologies", "HP Inc.", "Uber", "Airbnb", "LinkedIn", "X (Twitter)", "Spotify",
    "PayPal", "eBay", "Snap Inc.", "Pinterest", "Dropbox", "Zoom", "Shopify", "Block (Square)",
    "Twilio", "Atlassian", "ServiceNow", "Workday", "Broadcom (incl. VMware)",
    "Texas Instruments", "AMD", "Micron Technology", "Western Digital",
    # Data / AI
    "Palantir Technologies", "Snowflake", "Datadog", "MongoDB", "Elastic",
    "GitHub (Microsoft)", "GitLab", "HashiCorp", "Docker", "Red Hat (IBM)",
    "Autodesk", "Booking.com", "Expedia Group", "SpaceX", "OpenAI", "Anthropic",
    "Google DeepMind", "Stability AI", "Cohere", "Hugging Face", "Databricks",
    # Security & Infra
    "Palo Alto Networks", "CrowdStrike", "Fortinet", "Zscaler", "Okta", "Splunk (Cisco)",
    "NetApp", "Hewlett Packard Enterprise (HPE)", "Arista Networks", "F5", "Akamai",
    "Cloudflare", "Fastly", "DigitalOcean", "Confluent", "UiPath", "Automation Anywhere",
    "Nutanix", "Pure Storage", "Arm", "ASML",
    # APAC big
    "Samsung Electronics", "Sony", "LG Electronics", "Huawei", "Tencent", "Alibaba Group",
    "Baidu", "ByteDance (TikTok)", "Xiaomi", "JD.com", "Meituan", "DiDi Global",
    "SoftBank Group", "Rakuten Group",
    # Europe
    "Klarna", "Revolut", "Wise", "N26", "Adyen", "Zalando", "Delivery Hero", "HelloFresh",
    "Siemens", "Bosch", "Deutsche Telekom", "Nokia", "Ericsson", "Philips", "ASOS",
    "Deliveroo", "Just Eat Takeaway.com", "Skyscanner", "Farfetch", "Criteo",
    "Dassault Systèmes", "Capgemini", "Atos", "Amadeus IT Group",
    # Startups / product
    "Stripe", "Canva", "Figma", "Notion", "Airtable", "Discord", "Reddit", "Roblox",
    "Epic Games", "Instacart", "DoorDash", "Grubhub", "Robinhood", "Coinbase", "Binance",
    "Chime", "Plaid", "Brex", "Ramp", "Rippling", "Gusto", "Toast", "Affirm", "SoFi",
    "Carta", "Scale AI", "Perplexity AI", "Character.AI", "Runway", "Mistral AI", "XAI",
    "Anduril Industries", "Deel", "Remote.com", "Miro", "Asana", "monday.com", "Zapier",
    "Calendly", "Loom (Atlassian)", "Superhuman", "Linear", "Vercel", "Netlify", "Supabase",
    "Postman", "Retool", "Lyft", "Bolt", "Grab", "GoTo Group (Gojek)", "Sea Limited (Shopee)",
    "Grammarly", "Duolingo", "Coursera", "Udemy", "Peloton", "WeWork",
    # Indian IT
    "Infosys", "Wipro", "Tata Consultancy Services (TCS)", "HCLTech", "Tech Mahindra",
    "LTIMindtree", "Mphasis", "Cognizant (India)", "Capgemini India", "Accenture India",
    "IBM India", "Persistent Systems", "Hexaware Technologies", "Zensar Technologies",
    "Birlasoft", "Coforge", "L&T; Technology Services",
    # Bengaluru GCCs
    "Google India (Bengaluru)", "Microsoft India (Bengaluru)", "Amazon India (Bengaluru)",
    "SAP Labs India (Bengaluru)", "Cisco India (Bengaluru)", "Intel India (Bengaluru)",
    "Oracle India (Bengaluru)", "Adobe India (Bengaluru)", "Goldman Sachs (Bengaluru)",
    "JPMorgan Chase (Bengaluru)", "Walmart Global Tech India (Bengaluru)",
    "Target India (Bengaluru)", "Dell India (Bengaluru)", "Qualcomm India (Bengaluru)",
    "Samsung R&D; Institute (Bengaluru)", "Philips Innovation Campus (Bengaluru)",
    "Siemens Technology India (Bengaluru)", "Texas Instruments India (Bengaluru)",
    "Boeing India (Bengaluru)", "Airbus India (Bengaluru)",
    # Indian startups
    "Flipkart", "Swiggy", "Ola (ANI Technologies)", "Zomato / Eternal", "PhonePe",
    "Razorpay", "Freshworks", "Zoho Corporation", "BYJU'S", "Unacademy", "Meesho",
    "CRED", "Groww", "Zerodha", "InMobi", "Urban Company", "BigBasket", "Lenskart",
    "Nykaa", "Delhivery", "Rapido", "Ather Energy", "Ola Electric", "Licious",
    "Cult.fit (CureFit)", "Chargebee", "Whatfix", "Darwinbox", "Simplilearn", "upGrad",
    "MyGate", "Yellow.ai", "Slice", "Open Financial Technologies", "Vedantu", "Practo",
    "Innovaccer", "Uniphore", "Netskope (Bengaluru R&D;)", "Harness (Bengaluru)",
    "Gupshup", "MoEngage", "CleverTap", "Postman (Bengaluru HQ)", "Hasura", "Bizongo",
    "Blinkit", "Zepto", "CARS24", "Spinny", "PolicyBazaar", "Paytm", "MobiKwik",
    "Pine Labs", "BharatPe", "Housing.com", "NoBroker", "Acko General Insurance",
    "Digit Insurance", "Fractal Analytics", "Mu Sigma", "Quantiphi", "Tiger Analytics",
    "Thoughtworks India", "Publicis Sapient", "EPAM Systems India",
    # Finance
    "Morgan Stanley", "Goldman Sachs", "JPMorgan Chase", "Bank of America", "Citi",
    "Wells Fargo", "HSBC", "Barclays", "Deutsche Bank", "UBS", "Visa", "Mastercard",
    "American Express", "BlackRock", "Fidelity Investments",
    # Consulting
    "McKinsey & Company", "Boston Consulting Group (BCG)", "Bain & Company", "Deloitte",
    "PwC", "EY", "KPMG",
    # Retail / consumer
    "Walmart", "Target", "Procter & Gamble", "Unilever", "Nike", "The Coca-Cola Company",
    "PepsiCo",
    # Auto
    "Toyota Motor Corporation", "Volkswagen Group", "Ford Motor Company", "General Motors",
]


def _guess_domain(name: str) -> str:
    if name in _DOMAIN_OVERRIDES:
        return _DOMAIN_OVERRIDES[name]
    # Strip parenthetical parts + normalize
    base = re.sub(r"\(.*?\)", "", name).strip()
    base = base.replace(" / ", " ").replace("&", "and").replace("'", "")
    slug = re.sub(r"[^a-zA-Z0-9]", "", base).lower()
    if not slug:
        slug = "example"
    return f"{slug}.com"


def _career_url(domain: str) -> str:
    return f"https://{domain}/careers"


# Deduplicated companies list — each has name, domain, url
seen = set()
COMPANIES = []
for _name in _ALL_COMPANY_NAMES:
    _d = _guess_domain(_name)
    _key = (_name.lower(), _d)
    if _key in seen:
        continue
    seen.add(_key)
    COMPANIES.append({"name": _name, "domain": _d, "url": _career_url(_d)})

ROLES = [
    "Senior Software Engineer", "Product Manager", "Data Scientist", "DevOps Engineer",
    "Frontend Engineer", "Backend Engineer", "ML Engineer", "Cloud Architect",
    "Full Stack Developer", "Security Engineer", "UX Designer", "iOS Developer",
    "Android Developer", "Data Engineer", "Platform Engineer", "Site Reliability Engineer",
    "Solutions Architect", "Engineering Manager", "QA Engineer", "Business Analyst",
]

LOCATIONS = [
    "Bangalore, IN", "Hyderabad, IN", "Mumbai, IN", "Pune, IN", "Chennai, IN",
    "Gurgaon, IN", "Noida, IN", "Remote", "New York, US", "San Francisco, US",
    "London, UK", "Berlin, DE", "Singapore", "Toronto, CA", "Dublin, IE",
]

# Subscription plans
PLANS = {
    "monthly_199":       {"amount": 19900,  "currency": "inr", "interval_months": 1,  "name": "1 Month",             "kind": "job"},
    "half_399":          {"amount": 39900,  "currency": "inr", "interval_months": 6,  "name": "6 Months",            "kind": "job"},
    "yearly_699":        {"amount": 69900,  "currency": "inr", "interval_months": 12, "name": "1 Year",              "kind": "job"},
    "ai_monthly_1499":   {"amount": 149900, "currency": "inr", "interval_months": 1,  "name": "AI Agent · 1 Month",  "kind": "ai"},
    "ai_yearly_12999":   {"amount": 1299900,"currency": "inr", "interval_months": 12, "name": "AI Agent · 1 Year",   "kind": "ai"},
}

FREE_EMAILS = {"admin@blinkedinjobs.co", "testuser@blinkedinjobs.co", "referrer@blinkedinjobs.co"}
