import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { LEGAL_DOCUMENTS, type LegalPath } from '../../lib/legal/documents';
import {
  LEGAL_LINKS,
  LEGAL_SELLER,
  LEGAL_UPDATED_LABEL,
  LEGAL_VERSION,
} from '../../lib/legal/seller';

/** Reading mode: no reveal animations; legal content must never depend on viewport effects. */
export const LegalPage: React.FC<{ path: LegalPath }> = ({ path }) => {
  const document = LEGAL_DOCUMENTS[path];
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [path]);

  return (
    <article className="duo-scope bg-paper px-5 pb-10 pt-28 text-carbon sm:px-7 sm:pb-16 sm:pt-32">
      <div className="mx-auto max-w-3xl break-words font-candy-body">
        <Link
          to="/"
          className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Ana sayfaya dön
        </Link>
        <header className="mb-10 mt-6">
          <h1 className="font-candy-display text-3xl leading-tight sm:text-5xl">
            {document.title}
          </h1>
          <p className="mt-4 text-sm text-carbon-muted">
            Son güncelleme: {LEGAL_UPDATED_LABEL} · Sürüm: {LEGAL_VERSION}
          </p>
          <p className="mt-6 max-w-prose leading-relaxed">{document.intro}</p>
        </header>
        <nav aria-label="Bu metinde" className="mb-10 bg-paper-deep p-5">
          <ul className="space-y-1">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a
                  className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
                  href={`#${section.id}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10">
          {document.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-28"
            >
              <h2
                id={`${section.id}-title`}
                className="mb-4 font-candy-display text-[1.75rem] leading-tight"
              >
                {section.title}
              </h2>
              <div className="max-w-prose space-y-4 leading-relaxed">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="list-disc space-y-3 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.links && (
                  <ul className="space-y-1">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <a
                          className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
                          href={link.href}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
        <section aria-labelledby="legal-contact" className="mt-12 bg-paper-deep p-5 sm:p-6">
          <h2 id="legal-contact" className="mb-4 font-candy-display text-[1.75rem] leading-tight">
            İletişim
          </h2>
          <address className="space-y-3 not-italic leading-relaxed">
            <p>{LEGAL_SELLER.name}</p>
            <p>{LEGAL_SELLER.address}</p>
            <a
              className="duo-focus inline-flex min-h-11 items-center break-all underline underline-offset-4"
              href={`mailto:${LEGAL_SELLER.email}`}
            >
              {LEGAL_SELLER.email}
            </a>
          </address>
        </section>
        <nav aria-label="Hukuki metinler" className="mt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL_LINKS.filter((link) => link.href !== path).map((link) => (
              <li key={link.href}>
                <Link
                  className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
                  to={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </article>
  );
};
