# Source: https://pxxl.app/blog/complete-guide-domain-management-on-pxxl

[Back to Blog](https://pxxl.app/blog)

Domains are one of those infrastructure pieces that feel simple from the outside and reveal surprising depth the moment you need to do something beyond registering a .com and pointing it at a web server. TLD-specific policies, DNS propagation delays, WHOIS requirements, transfer locks, renewal grace periods, and the relationship between registrar, registry, and DNS provider all combine into a system that rewards understanding. This guide covers how all of it works on Pxxl.

## Searching for and registering a domain

Domain availability search on Pxxl queries the registrar in real time. When you type a domain name, the platform checks whether the exact name is available across the extensions you are searching and returns current pricing for registration, renewal, and transfer. Pricing varies by TLD and is determined by the registry. Premium domains, which are names that registries have assigned higher prices to, are flagged clearly so you know before checkout that the price is different from the standard rate for that extension.

Once you select a domain and proceed to checkout, you will be asked for registrant contact information. This information is required by ICANN and the specific TLD registry. It must be accurate. Providing false registrant information is a violation of ICANN policy and can result in the domain being suspended or cancelled by the registry, regardless of whether you paid for it. Fill in your real name, email address, phone number, and postal address. If you are registering on behalf of a company, use the company's information.

WHOIS privacy, where available for the TLD, replaces your personal contact information in the public WHOIS record with anonymized proxy data while still allowing legitimate third parties to contact you through the proxy service. It is worth selecting if you are concerned about your personal contact information being publicly queryable. Not all TLDs support WHOIS privacy. Country-code TLDs like .ng often have their own policies that may require registrant information to be publicly visible.

## DNS management: understanding what you have control over

When a domain is registered through Pxxl, the platform creates a DNS zone for it and becomes the authoritative nameserver. This means all DNS records for the domain are managed through Pxxl's DNS infrastructure. You can create, edit, and delete records from the domain management panel in your dashboard without logging into a separate DNS provider.

The DNS record types you can manage include A records, which map a hostname to an IPv4 address; AAAA records for IPv6; CNAME records, which create aliases pointing one hostname to another; MX records for email routing; TXT records used for domain verification with external services, email authentication (SPF, DKIM, DMARC), and other purposes; NS records for delegating subdomains to other nameservers; and SRV records for service discovery. Each record has a TTL (time to live) value that controls how long resolvers cache the record before re-querying.

When you attach a domain to a deployed project on Pxxl, the platform automatically creates or updates the A record pointing to the load balancer that serves your deployment. You do not need to manually look up the IP address and add a record. The platform handles this as part of the domain attachment flow.

## Connecting an external domain to a Pxxl project

If you already own a domain at another registrar (GoDaddy, Namecheap, Google Domains, Cloudflare, or anywhere else), you can still use it with a Pxxl project. The process involves adding the domain in the Domains section of your project, then going to your current DNS provider and adding a CNAME record pointing to the value Pxxl provides. Alternatively, you can transfer the nameservers of the domain to Pxxl's nameservers, which gives you full DNS management through the Pxxl dashboard.

CNAME verification is the simpler path if you do not want to move your DNS away from the current provider. The verification record proves to Pxxl that you control the domain. Once verified, SSL certificate issuance begins automatically. The certificate is issued through a certificate authority integration and renewed before expiry. You do not need to manage certificate renewals manually.

Full nameserver transfer gives you DNS management through Pxxl's panel for all records, not just those related to the project. This is the better option if you want a single place to manage all DNS for the domain, including email records, subdomain configurations, and verification records for other services.

## SSL certificates and HTTPS

All domains attached to Pxxl projects receive SSL certificates automatically. There is no configuration required to enable HTTPS. Once a domain is verified, certificate issuance begins and the domain is served over HTTPS within a few minutes. HTTP requests are redirected to HTTPS automatically.

Certificates are renewed before expiry. The platform monitors certificate expiry dates and triggers renewal before the certificate becomes invalid. If you have attached a domain and SSL is not working, the most common causes are DNS propagation delays (the CNAME or nameserver change has not fully propagated yet), a DNS misconfiguration (the CNAME points to the wrong value or there is a conflicting A record), or a CAA record at your DNS provider that restricts which certificate authorities are allowed to issue for the domain. The dashboard shows the current certificate status and any errors encountered during issuance.

## Domain addons: WHOIS privacy and other options

Domain addons are optional services that can be added at registration time or, in most cases, added later from the domain settings panel. WHOIS privacy is the most commonly requested addon. DNS management services, email forwarding, and domain forwarding are other examples. Availability depends on the specific TLD and registrar support for the extension.

Some addons, like WHOIS privacy, are billed alongside the domain renewal. Others may be one-time purchases. The pricing for addons is displayed clearly before checkout. Addon selections are stored with the domain record and renew automatically if auto-renewal is enabled for the domain.

## Renewals, expiry, and what happens after

Domain registration periods vary by TLD, but annual registration is the most common. When a domain's registration period ends, several things can happen depending on whether auto-renewal is configured and whether the renewal payment succeeds. If auto-renewal is on and payment succeeds, the domain renews for another period and nothing changes. If auto-renewal is off or payment fails, the domain enters a grace period during which it can be renewed at the standard rate. After the grace period ends, the domain moves to the redemption period, during which recovery is possible but at a significantly higher cost set by the registry. After the redemption period ends, the domain is deleted and released for public re-registration.

Pxxl sends renewal reminder notifications to your registered email address before expiry. However, delivery of email notifications is not guaranteed, and the responsibility for ensuring your domain is renewed lies with you. Configure auto-renewal and keep your payment method current if the domain is important to your business or product.

## Domain transfers

Transferring a domain to Pxxl from another registrar requires the domain to be unlocked at the current registrar and requires an authorization code (also called an EPP code or transfer key). Both of these are obtained from your current registrar. Once you have them, initiate the transfer in the Pxxl dashboard, enter the authorization code, and the transfer process begins. ICANN policy requires that the transfer be confirmed by the registrant email address on record. Transfers typically complete within a few days but can take up to a week depending on the current registrar's processing time.

Domains are subject to a 60-day transfer lock following registration or contact information changes, enforced by ICANN policy. If you have recently registered the domain or updated its WHOIS contact information, you may need to wait for the lock period to expire before initiating a transfer. Outgoing transfers, moving a domain away from Pxxl to another registrar, follow the same process in reverse: unlock the domain in the Pxxl dashboard, request the authorization code, and provide it to the gaining registrar.

## Using Pxxl's domain infrastructure through the reseller API

For developers building products that include domain management for end users, Pxxl provides a reseller API that exposes domain search, TLD pricing, availability checking, and registration workflows. API keys can be scoped to a specific project so that a reseller integration has access only to what it needs. The TLD pricing endpoint returns registration, renewal, transfer, and restore prices for every supported extension. The domain search endpoint checks availability in real time. The checkout and registration flow handles the full registrar integration so the reseller application does not need to deal with registrar-level APIs directly.