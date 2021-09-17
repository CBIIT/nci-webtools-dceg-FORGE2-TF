import React from 'react';
import './nci-footer.scss';

export const defaultSections = {};

export function NCIFooter({
  className = 'bg-primary-dark text-light py-4',
  style = { position: 'relative' },

  title = (
    <div className="mb-4">
      <div className="h4 mb-0">National Cancer Institute</div>
      <div className="h6">at the National Institutes of Health</div>
    </div>
  ),

  columns = [
    {
      title: 'Contact Information',
      links: [{ title: 'Contact Us', href: 'https://www.cancer.gov/contact' }],
    },
    {
      title: 'More Information',
      links: [
        {
          title: 'About This Website',
          href: 'https://www.cancer.gov/about-website',
        },
        { title: 'Multimedia', href: 'https://www.cancer.gov/multimedia' },
        { title: 'Publications', href: 'https://www.cancer.gov/publications' },
        {
          title: 'Site Map',
          href: 'https://www.cancer.gov/about-website/sitemap',
        },
        {
          title: 'Digital Standards for NCI Websites',
          href: 'https://www.cancer.gov/digital-standards',
        },
      ],
    },
    {
      title: 'Policies',
      links: [
        {
          href: 'https://www.cancer.gov/policies/accessibility',
          title: 'Accessibility',
        },
        {
          href: 'https://www.cancer.gov/policies/comments',
          title: 'Content Policy',
        },
        {
          href: 'https://www.cancer.gov/policies/disclaimer',
          title: 'Disclaimer',
        },
        { href: 'https://www.cancer.gov/policies/foia', title: 'FOIA' },
        {
          href: 'https://www.cancer.gov/policies/privacy-security',
          title: 'Privacy & Security',
        },
        {
          href: 'https://www.cancer.gov/policies/copyright-reuse',
          title: 'Reuse & Copyright',
        },
        {
          href: 'https://www.cancer.gov/syndication',
          title: 'Syndication Services',
        },
        {
          href: 'https://www.cancer.gov/policies/linking',
          title: 'Website Linking',
        },
      ],
    },
  ],

  footerLinks = [
    {
      href: 'http://www.hhs.gov/',
      title: 'U.S. Department of Health and Human Services',
    },
    { href: 'http://www.nih.gov/', title: 'National Institutes of Health' },
    { href: 'https://www.cancer.gov/', title: 'National Cancer Institute' },
    { href: 'http://usa.gov/', title: 'USA.gov' },
  ],

  footerText = <span>NIH ... Turning Discovery Into Health ®</span>,
}) {
  return (
    <footer className={className} style={style}>
      <div className="px-4">
        {title}

        <div className="row mb-4">
          {columns.map((column, columnIndex) => (
            <div key={`footer-column-${columnIndex}`} className="col-md">
              <div className="h5 font-weight-normal">
                {column.title.toUpperCase()}
              </div>
              <ul className="footer-links">
                {column.links.map((link, linkIndex) => (
                  <li key={`footer-column-${columnIndex}-link-${linkIndex}`}>
                    <a href={link.href} target="_blank">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <ul className="footer-links inline">
          {footerLinks.map((link, linkIndex) => (
            <li key={`footer-link-${linkIndex}`}>
              <a href={link.href} target="_blank">
                {link.title}
              </a>
            </li>
          ))}
        </ul>
        {footerText}
      </div>
    </footer>
  );
}
