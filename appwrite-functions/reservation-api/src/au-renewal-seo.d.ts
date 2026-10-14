export function renewalSeoPages(
  siteUrl: string,
  content?: {
    site: { socialProfiles: string[] };
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
