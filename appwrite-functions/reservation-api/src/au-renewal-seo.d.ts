export function renewalSeoPages(
  siteUrl: string,
  content?: {
    site: { socialProfiles: string[]; organizationDescription?: string };
    home: {
      title: string;
      description: string;
      faq: Array<{ question: string; answer: string }>;
    };
    cakes?: unknown;
    cakePages: Record<string, unknown>;
  },
): Record<
  string,
  {
    title: string;
    description: string;
    canonical: string;
    robots: string;
    noindex: boolean;
    imageAlt: string;
    ogType?: "website" | "product";
    output: string;
    extensionlessAlias: boolean;
    image?: string;
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
    omitImage?: boolean;
    structuredData: Array<Record<string, unknown>>;
    fallbackHtml: string;
  }
>;

export function renderRenewalLlms(siteUrl:string,additionalEntries?:string[]):string
export function seoRobots(config: {noindex?: boolean; robots?: string}): string;
export const MOCHI_PUBLIC_INFORMATION: Record<'en' | 'ko', string[]>;
export const CLASS_ARCHIVE_COPY: Record<'en' | 'ko', {title:string;intro:string;courses:string;link:string;archive:string}>;
export function classArchiveSeo(siteUrl:string): {title:string;description:string;canonical:string;robots:string;structuredData:Array<Record<string,unknown>>;fallbackHtml:string};
