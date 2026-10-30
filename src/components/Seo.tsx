import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description: string;
  noIndex?: boolean;
  canonicalPath?: string;
}

export const Seo: React.FC<SeoProps> = ({
  title,
  description,
  noIndex = false,
  canonicalPath = '',
}) => {
  const fullTitle = title.includes('Planora') ? title : `${title} | Planora`;
  const canonicalUrl = `https://planora.app${canonicalPath}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonicalPath && <link rel="canonical" href={canonicalUrl} />}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

