import type { Language } from './i18n.js'

export type CakeEditorialImageKey =
  | 'pave-quick-view'
  | 'pave-side'
  | 'eiffel-chocolate'

type EditorialCard = {
  title: string
  body: string
}

type EditorialListSection = {
  eyebrow: string
  title: string
  intro?: string
  items: readonly string[]
}

type EditorialImageSection = EditorialListSection & {
  imageKeys: readonly CakeEditorialImageKey[]
}

type EditorialLifestyle = {
  eyebrow: string
  title: string
  body: string
  lifestyleImage?: string
}

type EditorialIngredients = {
  eyebrow: string
  title: string
  ingredients: string
  allergens: string
  contact: string
}

type EditorialOrdering = {
  eyebrow: string
  title: string
  intro: string
  steps: readonly EditorialCard[]
  paymentNote: string
}

type EditorialGift = {
  eyebrow: string
  title: string
  body: string
  imageKeys: readonly CakeEditorialImageKey[]
}

type EditorialFinalCta = {
  eyebrow: string
  title: string
  body: string
}

export type CakeEditorialContent = {
  quickFacts: readonly EditorialCard[]
  lifestyle: EditorialLifestyle
  moments: readonly EditorialCard[]
  insideCake: EditorialImageSection
  tasteProfile: EditorialListSection
  ingredients: EditorialIngredients
  ordering: EditorialOrdering
  giftPresentation: EditorialGift
  relatedProductSlugs: readonly string[]
  finalCta: EditorialFinalCta
}

const PAVE_EDITORIAL: Record<Language, CakeEditorialContent> = {
  en: {
    quickFacts: [
      {
        title: 'Four layers',
        body: 'Chocolate cake layered with smooth pavé ganache.',
      },
      {
        title: 'Dark chocolate',
        body: 'A deep couverture chocolate profile with a clean finish.',
      },
      {
        title: 'Made to order',
        body: 'Prepared for your selected pick-up date.',
      },
      {
        title: 'Melrose Park pick-up',
        body: 'Collect from our Sydney kitchen.',
      },
    ],
    lifestyle: {
      eyebrow: 'A cake to gather around',
      title: 'Chocolate made for the moment',
      body: 'Pavé Chocolate Cake brings four moist chocolate layers and silky ganache to celebrations that deserve an unhurried centrepiece.',
    },
    moments: [
      {
        title: 'Birthday centrepiece',
        body: 'A rich chocolate cake made to hold the room.',
      },
      {
        title: 'Anniversary moment',
        body: 'An elegant finish for a table shared together.',
      },
      {
        title: 'Thoughtful chocolate gift',
        body: 'A generous way to mark a meaningful day.',
      },
    ],
    insideCake: {
      eyebrow: 'Inside the cake',
      title: 'Layer upon layer of pavé ganache',
      intro: 'A close look at the structure behind every slice.',
      items: [
        'Four chocolate cake layers',
        'Smooth pavé ganache between each layer',
        'Pavé ganache around the entire cake',
      ],
      imageKeys: ['pave-quick-view', 'pave-side'],
    },
    tasteProfile: {
      eyebrow: 'Taste & texture',
      title: 'Deep chocolate, balanced finish',
      items: [
        'Rich chocolate intensity',
        'Medium sweetness',
        'Moist cake · silky ganache · dense finish',
      ],
    },
    ingredients: {
      eyebrow: 'Ingredients & good to know',
      title: 'Made with carefully selected ingredients',
      ingredients: 'Made with 57.9% dark couverture chocolate, fresh cream, cocoa powder, butter, eggs, milk and wheat flour.',
      allergens: 'Contains milk, egg and wheat (gluten).',
      contact: 'Please contact us before ordering for someone with a food allergy.',
    },
    ordering: {
      eyebrow: 'How ordering works',
      title: 'A request, personally confirmed',
      intro: 'Choose your cake and options here, then send your request through the existing order flow.',
      steps: [
        {
          title: 'Choose and add',
          body: 'Select your cake and options, then choose Add to order.',
        },
        {
          title: 'Jenny checks availability',
          body: 'Send your request and Jenny will confirm availability for your selected date.',
        },
        {
          title: 'Payment confirms the order',
          body: 'Payment details are sent after availability is confirmed. Your order is confirmed once payment is complete.',
        },
      ],
      paymentNote: 'No payment is taken on this detail page.',
    },
    giftPresentation: {
      eyebrow: 'Chocolate detail',
      title: 'A thoughtful presentation',
      body: 'The Eiffel Tower chocolate and considered presentation add a distinctive finishing detail for gifting and celebrations.',
      imageKeys: ['eiffel-chocolate', 'pave-side'],
    },
    relatedProductSlugs: [
      'brownie-cheesecake',
      'signature-gateau-au-chocolat',
    ],
    finalCta: {
      eyebrow: 'Made to order in Sydney',
      title: 'Make Pavé part of your next moment',
      body: 'Choose your size and quantity above, then add the current selection to your order request.',
    },
  },
  ko: {
    quickFacts: [
      {
        title: '초콜릿 케이크 4단',
        body: '부드러운 파베 가나슈를 층층이 채웠습니다.',
      },
      {
        title: '다크 초콜릿',
        body: '진한 커버춰 초콜릿 풍미와 깔끔한 마무리.',
      },
      {
        title: '주문 제작',
        body: '선택한 픽업 날짜에 맞춰 준비합니다.',
      },
      {
        title: 'Melrose Park 픽업',
        body: '시드니 키친에서 직접 픽업합니다.',
      },
    ],
    lifestyle: {
      eyebrow: '함께 나누는 케이크',
      title: '기억할 순간을 위한 초콜릿',
      body: '파베 초콜릿 케이크는 촉촉한 초콜릿 케이크 4단과 부드러운 가나슈로 특별한 날의 중심을 완성합니다.',
    },
    moments: [
      {
        title: '생일을 위한 메인 케이크',
        body: '한자리에 모인 모두가 함께 즐기는 진한 초콜릿.',
      },
      {
        title: '기념일을 위한 초콜릿 케이크',
        body: '함께한 시간을 우아하게 기념하는 마무리.',
      },
      {
        title: '마음을 전하는 초콜릿 선물',
        body: '소중한 날을 기억하게 하는 정성스러운 선택.',
      },
    ],
    insideCake: {
      eyebrow: '케이크 속 구성',
      title: '층층이 이어지는 파베 가나슈',
      intro: '한 조각 안에 담긴 구조를 자세히 살펴보세요.',
      items: [
        '초콜릿 케이크 4단',
        '각 층 사이의 부드러운 파베 가나슈',
        '케이크 전체를 감싼 파베 가나슈',
      ],
      imageKeys: ['pave-quick-view', 'pave-side'],
    },
    tasteProfile: {
      eyebrow: '맛과 식감',
      title: '진한 초콜릿, 균형 잡힌 마무리',
      items: [
        '진한 초콜릿 풍미',
        '중간 정도의 단맛',
        '촉촉한 케이크 · 부드러운 가나슈 · 묵직한 마무리',
      ],
    },
    ingredients: {
      eyebrow: '재료와 주문 전 확인',
      title: '엄선한 재료로 만듭니다',
      ingredients: '57.9% 다크 커버춰 초콜릿, 생크림, 코코아 파우더, 버터, 계란, 우유, 밀가루를 사용합니다.',
      allergens: '우유, 계란, 밀(글루텐)을 함유합니다.',
      contact: '식품 알레르기가 있는 분을 위한 주문은 먼저 문의해 주세요.',
    },
    ordering: {
      eyebrow: '주문 방법',
      title: 'Jenny가 직접 확인하는 주문',
      intro: '케이크와 옵션을 선택해 기존 주문 요청 흐름으로 보내 주세요.',
      steps: [
        {
          title: '선택하고 담기',
          body: '케이크와 옵션을 선택한 뒤 주문에 담기를 눌러 주세요.',
        },
        {
          title: 'Jenny가 가능 여부 확인',
          body: '요청을 보내면 선택한 날짜의 주문 가능 여부를 확인합니다.',
        },
        {
          title: '결제 후 주문 확정',
          body: '가능 여부 확인 후 결제 정보를 보내 드리며, 결제가 완료되면 주문이 확정됩니다.',
        },
      ],
      paymentNote: '이 상세페이지에서는 지금 결제되지 않습니다.',
    },
    giftPresentation: {
      eyebrow: '초콜릿 디테일',
      title: '마음을 담은 프레젠테이션',
      body: '에펠탑 초콜릿과 정돈된 프레젠테이션이 선물과 기념일에 어울리는 특별한 디테일을 더합니다.',
      imageKeys: ['eiffel-chocolate', 'pave-side'],
    },
    relatedProductSlugs: [
      'brownie-cheesecake',
      'signature-gateau-au-chocolat',
    ],
    finalCta: {
      eyebrow: '시드니 주문 제작',
      title: '다음 순간을 파베와 함께하세요',
      body: '위에서 사이즈와 수량을 선택한 뒤 현재 선택값 그대로 주문 요청에 담을 수 있습니다.',
    },
  },
}

export function getCakeEditorialBySlug(
  slug: string,
  language: Language,
): CakeEditorialContent | null {
  if (slug !== 'pave-chocolate-cake') return null
  return PAVE_EDITORIAL[language]
}
