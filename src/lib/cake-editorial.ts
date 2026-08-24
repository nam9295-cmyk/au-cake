import type { Language } from './i18n.js'

export type CakeEditorialImageKey =
  | 'pave-quick-view'
  | 'pave-side'
  | 'vanilla-side'
  | 'vanilla-quick-view'
  | 'buttercream-side'
  | 'buttercream-quick-view'
  | 'cupcake-side'
  | 'cupcake-detail'
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
  ingredientsLabel: string
  allergenLabel: string
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
      ingredientsLabel: 'Ingredients',
      allergenLabel: 'Allergen note',
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
      ingredientsLabel: '재료',
      allergenLabel: '알레르기 안내',
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

const VANILLA_EDITORIAL: Record<Language, CakeEditorialContent> = {
  en: {
    quickFacts: [
      {
        title: 'Signature Gâteau layers',
        body: 'Chocolate cake layers for the base of every slice.',
      },
      {
        title: 'Vanilla fresh cream',
        body: 'Made with real vanilla bean.',
      },
      {
        title: 'Real vanilla bean',
        body: 'Natural vanilla bean specks remain visible.',
      },
      {
        title: 'Made to order',
        body: 'Prepared for your selected pick-up date.',
      },
    ],
    lifestyle: {
      eyebrow: 'A classic celebration',
      title: 'A CLASSIC CELEBRATION, FINISHED WITH REAL VANILLA',
      body: 'Signature chocolate cake layers meet vanilla fresh cream made with real vanilla bean for a celebration cake with a familiar, elegant finish.',
    },
    moments: [
      {
        title: 'Birthday centrepiece',
        body: 'A chocolate-and-vanilla celebration cake made for the centre of the table.',
      },
      {
        title: 'Anniversary moment',
        body: 'A classic combination for celebrating a thoughtful moment together.',
      },
      {
        title: 'Thoughtful gift',
        body: 'Made to order with real vanilla bean for a cake that feels considered and personal.',
      },
    ],
    insideCake: {
      eyebrow: 'Inside the cake',
      title: 'Chocolate cake, finished with real vanilla',
      intro: 'Three details that define every slice.',
      items: [
        'Signature chocolate cake — Our Signature Gâteau au Chocolat cake layers form the chocolate base.',
        'Vanilla fresh cream — Made with real vanilla bean.',
        'Real vanilla bean — Natural vanilla bean specks remain visible throughout the cream.',
      ],
      imageKeys: ['vanilla-quick-view', 'vanilla-side'],
    },
    tasteProfile: {
      eyebrow: 'Taste & texture',
      title: 'Chocolate cake, vanilla fresh cream',
      items: [
        'Signature chocolate cake layers',
        'Vanilla fresh cream with real vanilla bean',
        'Real vanilla bean visible throughout the cream',
      ],
    },
    ingredients: {
      eyebrow: 'Ingredients & good to know',
      title: 'Made with signature cake layers and real vanilla bean',
      ingredientsLabel: 'Key ingredients',
      allergenLabel: 'Allergen note',
      ingredients: 'Made with our Signature Gâteau au Chocolat cake layers—prepared with butter, eggs, milk, cocoa and wheat flour—and vanilla fresh cream with real vanilla bean.',
      allergens: 'Contains milk, egg and wheat (gluten).',
      contact: 'Please contact us before ordering for someone with a food allergy.',
    },
    ordering: {
      eyebrow: 'How ordering works',
      title: 'A request, personally confirmed',
      intro: 'Choose your cake and options here, then send your request through the existing order flow.',
      steps: [
        {
          title: 'Choose your cake',
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
      eyebrow: 'Made for your moment',
      title: 'A PERSONAL TOUCH FOR YOUR CELEBRATION',
      body: 'Choose the available colour detail when ordering, and we’ll prepare your Vanilla Fresh Cream Cake to suit the moment.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'pave-chocolate-cake',
      'buttercream-cake',
    ],
    finalCta: {
      eyebrow: 'Made to order in Sydney',
      title: 'MAKE VANILLA PART OF YOUR NEXT CELEBRATION',
      body: 'Choose your size and colour detail, then send the request when you’re ready.',
    },
  },
  ko: {
    quickFacts: [
      {
        title: '시그니처 갸또 쇼콜라 시트',
        body: '한 조각의 기본이 되는 시그니처 초콜릿 케이크입니다.',
      },
      {
        title: '바닐라 생크림',
        body: '실제 바닐라빈을 넣어 만듭니다.',
      },
      {
        title: '실제 바닐라빈',
        body: '크림 속에 자연스러운 바닐라빈 점이 보입니다.',
      },
      {
        title: '주문 후 제작',
        body: '선택한 픽업 날짜에 맞춰 준비합니다.',
      },
    ],
    lifestyle: {
      eyebrow: '클래식한 기념일 케이크',
      title: '실제 바닐라빈으로 완성한 클래식한 기념일 케이크',
      body: '시그니처 갸또 쇼콜라 시트에 실제 바닐라빈을 넣은 바닐라 생크림을 더해 익숙하면서도 특별한 기념일 케이크로 완성합니다.',
    },
    moments: [
      {
        title: '생일을 위한 메인 케이크',
        body: '초콜릿과 바닐라의 클래식한 조합으로 생일 테이블의 중심을 완성합니다.',
      },
      {
        title: '기념일을 위한 케이크',
        body: '함께하는 특별한 순간에 잘 어울리는 초콜릿과 바닐라의 조합입니다.',
      },
      {
        title: '마음을 전하는 선물',
        body: '실제 바닐라빈을 사용해 주문 후 제작하는 정성스러운 케이크입니다.',
      },
    ],
    insideCake: {
      eyebrow: '케이크 속 구성',
      title: '초콜릿 케이크와 실제 바닐라빈',
      intro: '한 조각을 완성하는 세 가지 요소입니다.',
      items: [
        '시그니처 초콜릿 케이크 — 베리굿의 시그니처 갸또 쇼콜라 시트를 사용합니다.',
        '바닐라 생크림 — 실제 바닐라빈을 넣어 만듭니다.',
        '실제 바닐라빈 — 크림 속 작은 점들은 실제 바닐라빈의 자연스러운 흔적입니다.',
      ],
      imageKeys: ['vanilla-quick-view', 'vanilla-side'],
    },
    tasteProfile: {
      eyebrow: '맛과 식감',
      title: '초콜릿 케이크와 바닐라 생크림',
      items: [
        '시그니처 갸또 쇼콜라 시트',
        '실제 바닐라빈을 넣은 바닐라 생크림',
        '크림에 보이는 실제 바닐라빈',
      ],
    },
    ingredients: {
      eyebrow: '재료와 주문 전 확인',
      title: '시그니처 시트와 실제 바닐라빈으로 만듭니다',
      ingredientsLabel: '주요 재료',
      allergenLabel: '알레르기 안내',
      ingredients: '버터, 계란, 우유, 코코아, 밀가루로 만든 시그니처 갸또 쇼콜라 시트와 실제 바닐라빈을 넣은 바닐라 생크림을 사용합니다.',
      allergens: '우유, 계란, 밀(글루텐)을 함유합니다.',
      contact: '식품 알레르기가 있는 분을 위한 주문은 먼저 문의해 주세요.',
    },
    ordering: {
      eyebrow: '주문 방법',
      title: 'Jenny가 직접 확인하는 주문',
      intro: '케이크와 옵션을 선택해 기존 주문 요청 흐름으로 보내 주세요.',
      steps: [
        {
          title: '케이크 선택',
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
      eyebrow: '당신의 순간을 위해',
      title: '기념일에 더하는 작은 맞춤 포인트',
      body: '주문 시 제공되는 컬러 옵션을 선택하면 바닐라 생크림 케이크를 그 순간에 맞게 준비합니다.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'pave-chocolate-cake',
      'buttercream-cake',
    ],
    finalCta: {
      eyebrow: '시드니 주문 제작',
      title: '다음 기념일을 바닐라 케이크와 함께',
      body: '사이즈와 컬러 옵션을 선택한 뒤 준비되면 주문 요청을 보내주세요.',
    },
  },
}

const BUTTERCREAM_EDITORIAL: Record<Language, CakeEditorialContent> = {
  en: {
    quickFacts: [
      {
        title: 'Italian meringue',
        body: 'The foundation of the buttercream finish.',
      },
      {
        title: 'Real butter',
        body: 'Blended into the finished meringue buttercream.',
      },
      {
        title: 'Cocoa powder',
        body: 'Added for a smooth chocolate finish.',
      },
      {
        title: 'Made to order',
        body: 'Prepared for your selected pick-up date.',
      },
    ],
    lifestyle: {
      eyebrow: 'MADE WITH REAL BUTTER & COCOA',
      title: 'A BUTTERCREAM CAKE MADE FOR CELEBRATION',
      body: 'Signature chocolate cake layers finished with Italian meringue chocolate buttercream and your selected cake colour.',
    },
    moments: [
      {
        title: 'Birthday centrepiece',
        body: 'Choose a cake colour for the centre of the table.',
      },
      {
        title: 'Anniversary moment',
        body: 'A chocolate buttercream cake prepared for the occasion.',
      },
      {
        title: 'Celebration gift',
        body: 'Made to order with a colour detail chosen for the moment.',
      },
    ],
    insideCake: {
      eyebrow: 'Inside the cake',
      title: 'ITALIAN MERINGUE CHOCOLATE BUTTERCREAM',
      intro: 'We whip an Italian meringue until smooth, then blend in real butter and cocoa powder to create a silky chocolate buttercream with a soft, melt-in-the-mouth finish.',
      items: [
        'Signature chocolate cake — Our Signature Gâteau au Chocolat cake layers form the chocolate base.',
        'Italian meringue buttercream — Egg whites and sugar are whipped into an Italian meringue before the butter is blended in.',
        'Chocolate buttercream — Cocoa powder is blended into the finished buttercream for its chocolate finish.',
      ],
      imageKeys: ['buttercream-quick-view', 'buttercream-side'],
    },
    tasteProfile: {
      eyebrow: 'Taste & texture',
      title: 'Silky buttercream, smooth chocolate finish',
      items: [
        'Silky Italian meringue buttercream',
        'Smooth chocolate finish',
        'Soft, melt-in-the-mouth texture',
      ],
    },
    ingredients: {
      eyebrow: 'Ingredients & good to know',
      title: 'Made with Italian meringue chocolate buttercream',
      ingredientsLabel: 'Key ingredients',
      allergenLabel: 'Allergen note',
      ingredients: 'Made with our Signature Gâteau au Chocolat cake layers and Italian meringue chocolate buttercream prepared with butter, egg whites, sugar, vanilla extract and cocoa powder.',
      allergens: 'Contains milk, egg and wheat (gluten).',
      contact: 'Please contact us before ordering for someone with a food allergy.',
    },
    ordering: {
      eyebrow: 'How ordering works',
      title: 'A request, personally confirmed',
      intro: 'Choose your cake and options here, then send your request through the existing order flow.',
      steps: [
        {
          title: 'Choose your cake',
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
      eyebrow: 'MADE FOR YOUR CELEBRATION',
      title: 'CHOOSE A COLOUR FOR THE MOMENT',
      body: 'Choose from the available cake colours when ordering and we’ll prepare the buttercream finish for your celebration.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'pave-chocolate-cake',
      'vanilla-fresh-cream-cake',
    ],
    finalCta: {
      eyebrow: 'Made to order in Sydney',
      title: 'MAKE BUTTERCREAM PART OF YOUR NEXT CELEBRATION',
      body: 'Choose your size and cake colour, then send the request when you’re ready.',
    },
  },
  ko: {
    quickFacts: [
      {
        title: '이탈리안 머랭',
        body: '버터크림의 기본이 되는 머랭입니다.',
      },
      {
        title: '버터 사용',
        body: '완성된 머랭 버터크림에 버터를 더합니다.',
      },
      {
        title: '코코아 파우더',
        body: '부드러운 초콜릿 마무리를 더합니다.',
      },
      {
        title: '주문 후 제작',
        body: '선택한 픽업 날짜에 맞춰 준비합니다.',
      },
    ],
    lifestyle: {
      eyebrow: '버터와 코코아로 완성한 이탈리안 머랭 버터크림',
      title: '기념일을 위해 완성하는 버터크림 케이크',
      body: '시그니처 갸또 쇼콜라 시트에 이탈리안 머랭 초콜릿 버터크림을 더하고 선택한 케이크 컬러로 완성합니다.',
    },
    moments: [
      {
        title: '생일을 위한 메인 케이크',
        body: '기념일 테이블의 중심에 어울리는 케이크 컬러를 선택하세요.',
      },
      {
        title: '기념일을 위한 케이크',
        body: '특별한 날에 어울리도록 준비하는 초콜릿 버터크림 케이크입니다.',
      },
      {
        title: '마음을 전하는 선물',
        body: '그 순간에 맞는 컬러 포인트를 골라 주문 후 제작합니다.',
      },
    ],
    insideCake: {
      eyebrow: '케이크 속 구성',
      title: '이탈리안 머랭 초콜릿 버터크림',
      intro: '이탈리안 머랭을 매끄럽게 올린 뒤 버터와 코코아 파우더를 더해, 입안에서 부드럽게 녹아드는 실키한 초콜릿 버터크림으로 완성합니다.',
      items: [
        '시그니처 초콜릿 케이크 — 베리굿의 시그니처 갸또 쇼콜라 시트를 사용합니다.',
        '이탈리안 머랭 버터크림 — 흰자와 설탕으로 이탈리안 머랭을 만든 뒤 버터를 더해 부드럽게 완성합니다.',
        '초콜릿 버터크림 — 완성된 버터크림에 코코아 파우더를 더해 초콜릿 버터크림으로 마무리합니다.',
      ],
      imageKeys: ['buttercream-quick-view', 'buttercream-side'],
    },
    tasteProfile: {
      eyebrow: '맛과 식감',
      title: '실키한 버터크림과 부드러운 초콜릿 마무리',
      items: [
        '실키한 이탈리안 머랭 버터크림',
        '부드러운 초콜릿 마무리',
        '입안에서 부드럽게 녹아드는 질감',
      ],
    },
    ingredients: {
      eyebrow: '재료와 주문 전 확인',
      title: '이탈리안 머랭 초콜릿 버터크림으로 만듭니다',
      ingredientsLabel: '주요 재료',
      allergenLabel: '알레르기 안내',
      ingredients: '시그니처 갸또 쇼콜라 시트와 버터, 흰자, 설탕, 바닐라 익스트랙, 코코아 파우더로 만든 이탈리안 머랭 초콜릿 버터크림을 사용합니다.',
      allergens: '우유, 계란, 밀(글루텐)을 함유합니다.',
      contact: '식품 알레르기가 있는 분을 위한 주문은 먼저 문의해 주세요.',
    },
    ordering: {
      eyebrow: '주문 방법',
      title: 'Jenny가 직접 확인하는 주문',
      intro: '케이크와 옵션을 선택해 기존 주문 요청 흐름으로 보내 주세요.',
      steps: [
        {
          title: '케이크 선택',
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
      eyebrow: '당신의 기념일을 위해',
      title: '기념일에 맞는 케이크 컬러를 선택하세요',
      body: '주문 시 제공되는 케이크 컬러 중 하나를 선택하면 기념일에 맞춰 버터크림 케이크를 준비합니다.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'pave-chocolate-cake',
      'vanilla-fresh-cream-cake',
    ],
    finalCta: {
      eyebrow: '시드니 주문 제작',
      title: '다음 기념일을 버터크림 케이크와 함께',
      body: '사이즈와 케이크 컬러를 선택한 뒤 준비되면 주문 요청을 보내주세요.',
    },
  },
}

const CUPCAKES_EDITORIAL: Record<Language, CakeEditorialContent> = {
  en: {
    quickFacts: [
      {
        title: 'Signature chocolate cake',
        body: 'The chocolate base shared by every cupcake in the box.',
      },
      {
        title: 'Three finishes',
        body: 'Choose Basic, Vanilla Fresh Cream or Chocolate Buttercream.',
      },
      {
        title: 'Half dozen or dozen',
        body: 'Select the box size that suits the occasion.',
      },
      {
        title: 'Individual packaging available',
        body: 'Choose it in the existing order options when needed.',
      },
    ],
    lifestyle: {
      eyebrow: 'MADE FOR SHARING',
      title: 'A BOX OF CHOCOLATE CUPCAKES, FINISHED YOUR WAY',
      body: 'Start with our signature chocolate cupcake and choose the finish that suits your celebration—Basic, Vanilla Fresh Cream or Chocolate Buttercream.',
    },
    moments: [
      {
        title: 'Birthday table',
        body: 'Easy to share around the table without slicing a whole cake.',
      },
      {
        title: 'Party box',
        body: 'Choose a finish and pack size to suit a small celebration or a larger gathering.',
      },
      {
        title: 'Thoughtful gift',
        body: 'A chocolate cupcake box that can also be individually packaged when needed.',
      },
    ],
    insideCake: {
      eyebrow: 'Choose your finish',
      title: 'CHOOSE YOUR FINISH',
      intro: 'Select one finish for the whole box.',
      items: [
        'Basic — Choose the current Basic finish for the whole box.',
        'Vanilla Fresh Cream — Vanilla fresh cream made with 100% fresh milk and real vanilla bean.',
        'Chocolate Buttercream — Italian meringue chocolate buttercream made with real butter and cocoa powder.',
      ],
      imageKeys: ['cupcake-side', 'cupcake-detail'],
    },
    tasteProfile: {
      eyebrow: 'Taste & texture',
      title: 'Chocolate cupcakes, three ways to finish',
      items: [
        'Signature chocolate cupcake',
        'Vanilla fresh cream with real vanilla bean',
        'Silky Italian meringue chocolate buttercream',
      ],
    },
    ingredients: {
      eyebrow: 'Ingredients & good to know',
      title: 'Signature chocolate cupcakes, finished to order',
      ingredientsLabel: 'Key ingredients',
      allergenLabel: 'Allergen note',
      ingredients: 'Our signature chocolate cupcakes are made with butter, eggs, milk, cocoa and wheat flour. Vanilla Fresh Cream is made with 100% fresh milk and real vanilla bean. Chocolate Buttercream is Italian meringue buttercream made with real butter and cocoa powder.',
      allergens: 'Contains milk, egg and wheat (gluten).',
      contact: 'Please contact us before ordering for someone with a food allergy.',
    },
    ordering: {
      eyebrow: 'How ordering works',
      title: 'A request, personally confirmed',
      intro: 'Choose your box, finish and any packaging option, then send your request through the existing order flow.',
      steps: [
        {
          title: 'Choose your box',
          body: 'Select Half Dozen or Dozen and your preferred finish.',
        },
        {
          title: 'Add packaging if needed',
          body: 'Choose Individual Packaging when required.',
        },
        {
          title: 'Send your request',
          body: 'Jenny checks availability and sends payment details before the order is confirmed.',
        },
      ],
      paymentNote: 'No payment is taken on this detail page.',
    },
    giftPresentation: {
      eyebrow: 'READY TO SHARE — OR WRAP INDIVIDUALLY',
      title: 'PACK THEM FOR THE WAY YOU’RE CELEBRATING',
      body: 'Choose Individual Packaging when you need cupcakes prepared separately for gifting, events or easy sharing.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'lemon-cake',
      'buttercream-cake',
    ],
    finalCta: {
      eyebrow: 'Made to order in Sydney',
      title: 'BUILD YOUR CUPCAKE BOX',
      body: 'Choose your pack, finish and packaging options, then add it to your order.',
    },
  },
  ko: {
    quickFacts: [
      {
        title: '시그니처 초콜릿 케이크',
        body: '박스의 모든 컵케이크에 사용하는 초콜릿 베이스입니다.',
      },
      {
        title: '3가지 마감',
        body: 'Basic, 바닐라 생크림 또는 초콜릿 버터크림을 선택합니다.',
      },
      {
        title: '6개 또는 12개 구성',
        body: '기념일에 맞는 박스 구성을 선택하세요.',
      },
      {
        title: '개별 포장 선택 가능',
        body: '필요한 경우 기존 주문 옵션에서 선택할 수 있습니다.',
      },
    ],
    lifestyle: {
      eyebrow: '함께 나누기 좋은 케이크',
      title: '취향에 맞게 고르는 초콜릿 컵케이크 박스',
      body: '시그니처 초콜릿 컵케이크에 Basic, Vanilla Fresh Cream, Chocolate Buttercream 중 원하는 마감을 선택해 기념일에 맞는 박스로 준비합니다.',
    },
    moments: [
      {
        title: '생일 테이블',
        body: '홀케이크를 자르지 않아도 하나씩 나누기 좋은 컵케이크입니다.',
      },
      {
        title: '파티 박스',
        body: '원하는 마감과 수량 구성을 선택해 작은 모임부터 여러 사람이 함께하는 자리까지 준비할 수 있습니다.',
      },
      {
        title: '마음을 전하는 선물',
        body: '필요한 경우 개별 포장 옵션도 선택할 수 있는 초콜릿 컵케이크 박스입니다.',
      },
    ],
    insideCake: {
      eyebrow: '원하는 마감',
      title: '원하는 마감을 선택하세요',
      intro: '박스 전체에 적용할 마감 하나를 선택합니다.',
      items: [
        '기본 — 박스 전체에 적용되는 현재 기본 마감입니다.',
        '바닐라 생크림 — 100% 신선한 우유와 실제 바닐라빈으로 만든 바닐라 생크림.',
        '초콜릿 버터크림 — 버터와 코코아 파우더로 만든 이탈리안 머랭 초콜릿 버터크림.',
      ],
      imageKeys: ['cupcake-side', 'cupcake-detail'],
    },
    tasteProfile: {
      eyebrow: '맛과 식감',
      title: '초콜릿 컵케이크, 세 가지 마감',
      items: [
        '시그니처 초콜릿 컵케이크',
        '실제 바닐라빈을 넣은 바닐라 생크림',
        '실키한 이탈리안 머랭 초콜릿 버터크림',
      ],
    },
    ingredients: {
      eyebrow: '재료와 주문 전 확인',
      title: '시그니처 초콜릿 컵케이크를 주문에 맞춰 마무리합니다',
      ingredientsLabel: '주요 재료',
      allergenLabel: '알레르기 안내',
      ingredients: '버터, 계란, 우유, 코코아, 밀가루를 사용해 시그니처 초콜릿 컵케이크를 만듭니다. 100% 신선한 우유와 실제 바닐라빈으로 만든 바닐라 생크림을 사용합니다. 초콜릿 버터크림은 버터와 코코아 파우더로 만든 이탈리안 머랭 버터크림입니다.',
      allergens: '우유, 계란, 밀(글루텐)을 함유합니다.',
      contact: '식품 알레르기가 있는 분을 위한 주문은 먼저 문의해 주세요.',
    },
    ordering: {
      eyebrow: '주문 방법',
      title: 'Jenny가 직접 확인하는 주문',
      intro: '박스 구성과 마감, 필요한 포장 옵션을 선택한 뒤 기존 주문 요청 흐름으로 보내 주세요.',
      steps: [
        {
          title: '박스 구성을 선택하세요',
          body: '6개 또는 12개 구성과 원하는 마감을 선택합니다.',
        },
        {
          title: '필요하면 개별 포장을 선택하세요',
          body: '하나씩 포장이 필요한 경우 Individual Packaging을 선택합니다.',
        },
        {
          title: '주문 요청을 보내세요',
          body: 'Jenny가 가능 여부를 확인한 뒤 결제 정보를 안내하며, 결제 후 주문이 확정됩니다.',
        },
      ],
      paymentNote: '이 상세페이지에서는 지금 결제되지 않습니다.',
    },
    giftPresentation: {
      eyebrow: '함께 나누거나, 하나씩 포장하거나',
      title: '필요한 방식에 맞춰 준비하는 컵케이크',
      body: '선물이나 행사, 하나씩 나눠야 하는 경우 주문 시 개별 포장 옵션을 선택할 수 있습니다.',
      imageKeys: [],
    },
    relatedProductSlugs: [
      'lemon-cake',
      'buttercream-cake',
    ],
    finalCta: {
      eyebrow: '시드니 주문 제작',
      title: '원하는 컵케이크 박스를 골라보세요',
      body: '수량 구성과 마감, 필요한 포장 옵션을 선택한 뒤 주문에 담아주세요.',
    },
  },
}

export function getCakeEditorialBySlug(
  slug: string,
  language: Language,
): CakeEditorialContent | null {
  if (slug === 'pave-chocolate-cake') return PAVE_EDITORIAL[language]
  if (slug === 'vanilla-fresh-cream-cake') return VANILLA_EDITORIAL[language]
  if (slug === 'buttercream-cake') return BUTTERCREAM_EDITORIAL[language]
  if (slug === 'chocolate-cupcakes') return CUPCAKES_EDITORIAL[language]
  return null
}
