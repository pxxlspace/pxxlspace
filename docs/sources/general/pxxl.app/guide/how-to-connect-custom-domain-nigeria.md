# Source: https://pxxl.app/guide/how-to-connect-custom-domain-nigeria

How-to Guide5 min read2026-05-23

# How to Connect a Custom Domain to Your Web App in Nigeria

A custom domain makes your web application look professional and credible to Nigerian clients and users. This guide shows you how to connect any domain — including Nigerian .com.ng domains — to your app hosted on Pxxl.

## Getting a Domain in Nigeria

Nigerian developers can purchase domains from local registrars like Whogohost, Web4Africa, or Qservers for as low as ₦3,000/year for a .com.ng domain or ₦15,000/year for a .com domain. International registrars like Namecheap accept some Nigerian payment methods. Once you have a domain, you'll manage its DNS records through your registrar's control panel.

## Configuring DNS for Pxxl

In your Pxxl project settings, navigate to 'Domains' and enter your domain name. Pxxl generates the DNS records you need to add: typically an A record pointing to Pxxl's IP address, and a CNAME record for the www subdomain. Log in to your domain registrar's DNS management panel and add these exact records. DNS changes can take between 15 minutes and 48 hours to propagate globally.

## Automatic SSL Certificate

Once Pxxl verifies that your DNS records point to its servers, it automatically issues a free Let's Encrypt SSL certificate for your domain. This happens without any action from you — Pxxl handles certificate issuance and renewal automatically. Your users will see the padlock icon in their browser and your app will load over HTTPS. If you want to redirect all HTTP traffic to HTTPS, enable the 'Force HTTPS' option in your Pxxl domain settings.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

domainnigeriadnsssl

## Related guides

[How-to Guide\\ \\ **How to Get a Free SSL Certificate for Your Website in Nigeria**\\ \\ Get a free SSL certificate for your Nigerian website. This guide explains how Pxxl automatically provisions HTTPS for all custom domains and \*.pxxl.app subdomains.](https://pxxl.app/guide/how-to-get-free-ssl-nigeria) [How-to Guide\\ \\ **How to Host Your First Website as a Nigerian Developer — Step-by-Step Guide**\\ \\ A complete step-by-step guide for Nigerian developers hosting their first website. Learn to deploy from GitHub to a live URL with free SSL and a custom domain.](https://pxxl.app/guide/how-to-host-first-website-nigeria) [How-to Guide\\ \\ **How to Host Your Portfolio Website for Free as a Nigerian Developer**\\ \\ Host your developer portfolio for free as a Nigerian developer. This guide covers deploying a portfolio site with a custom domain, HTTPS, and always-on uptime.](https://pxxl.app/guide/how-to-host-portfolio-website-nigeria)