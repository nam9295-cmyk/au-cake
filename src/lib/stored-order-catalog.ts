// Fixed AU/KR reader catalogue captured from 896574f; not a new-order price source.
import { MARKET, type Market } from './market.js'
type StoredCatalog = Pick<typeof import('./market.js').marketConfig,
  'products' | 'cakeSizeOptions' | 'chocolateTypeOptions' | 'poundAddonOptions' | 'cacaoOptions'>
const catalogs: Record<Market, StoredCatalog> = {
  "KR": {
    "products": {
      "pave-cake": {
        "id": "pave-cake",
        "name": "생초콜릿 파베 케이크",
        "description": "초코 시트 사이에 파베초콜릿 가나슈를 4단으로 샌드한 원형 케이크입니다. 크림층 없이 초콜릿의 밀도와 부드러운 가나슈 질감이 또렷하게 느껴집니다.",
        "price": 38000,
        "priceNote": "농도, 사이즈 선택 가능",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": true,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "15cm": 65000,
          "17cm": 78000,
          "19cm": 92000,
          "22cm": 115000
        }
      },
      "pound-cake": {
        "id": "pound-cake",
        "name": "초코 파운드 케이크",
        "description": "식빵틀에 구워 묵직하게 완성한 갸또 쇼콜라 위에 다크초콜릿을 듬뿍 부었습니다. 촉촉한 초코 반죽과 진한 초콜릿 코팅이 바로 느껴지는 오리지널 초코케이크입니다.",
        "price": 29500,
        "priceNote": "마감 옵션 선택 가능",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": true,
        "sizePrices": {}
      },
      "cupcake-dozen": {
        "id": "cupcake-dozen",
        "name": "초코 컵케이크 1다스",
        "description": "초콜릿 베이스 컵케이크를 12개 한 세트로 준비하는 파티용 컵케이크입니다.",
        "price": 55000,
        "priceNote": "1다스 기준, 마감 옵션 선택 가능",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": true,
        "sizePrices": {}
      },
      "choco-basque-cheesecake": {
        "id": "choco-basque-cheesecake",
        "name": "초코 바스크 치즈케이크",
        "description": "진한 초콜릿과 크림치즈를 높은 온도에서 구워낸 15cm 바스크 치즈케이크입니다.",
        "price": 36000,
        "priceNote": "6 inch / 15cm 고정 사이즈",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "pave-choco-basque-cheesecake": {
        "id": "pave-choco-basque-cheesecake",
        "name": "파베초코 바스크 치즈케이크",
        "description": "초코 바스크 치즈케이크 위에 파베 초콜릿을 더한 15cm 치즈케이크입니다.",
        "price": 38000,
        "priceNote": "6 inch / 15cm 고정 사이즈",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "eiffel-tower-basque-cheesecake": {
        "id": "eiffel-tower-basque-cheesecake",
        "name": "에펠탑 초콜릿 바스크 치즈케이크",
        "description": "파베 초콜릿으로 케이크 전체를 덮고 에펠탑 초콜릿 하나를 올린 15cm 치즈케이크입니다.",
        "price": 40000,
        "priceNote": "6 inch / 15cm 고정 사이즈",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-4": {
        "id": "fresh-lemon-cupcakes-4",
        "name": "프레시 레몬 컵케이크 · 4개",
        "description": "신선한 레몬즙과 레몬 제스트를 사용하고 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리한 시드니 전용 상품입니다.",
        "price": 24000,
        "priceNote": "4개 구성 · 레몬 글레이즈와 꽃 장식 포함",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-6": {
        "id": "fresh-lemon-cupcakes-6",
        "name": "프레시 레몬 컵케이크 · 6개",
        "description": "신선한 레몬즙과 레몬 제스트를 사용하고 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리한 시드니 전용 상품입니다.",
        "price": 36000,
        "priceNote": "6개 구성 · Most Popular",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-8": {
        "id": "fresh-lemon-cupcakes-8",
        "name": "프레시 레몬 컵케이크 · 8개",
        "description": "신선한 레몬즙과 레몬 제스트를 사용하고 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리한 시드니 전용 상품입니다.",
        "price": 45000,
        "priceNote": "8개 구성 · 레몬 글레이즈와 꽃 장식 포함",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-12": {
        "id": "fresh-lemon-cupcakes-12",
        "name": "프레시 레몬 컵케이크 · 12개",
        "description": "신선한 레몬즙과 레몬 제스트를 사용하고 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리한 시드니 전용 상품입니다.",
        "price": 65000,
        "priceNote": "12개 구성 · Most Popular",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-16": {
        "id": "fresh-lemon-cupcakes-16",
        "name": "프레시 레몬 컵케이크 · 16개",
        "description": "신선한 레몬즙과 레몬 제스트를 사용하고 레몬 시럽, 생 레몬 글레이즈와 꽃 장식으로 마무리한 시드니 전용 상품입니다.",
        "price": 85000,
        "priceNote": "16개 구성 · 레몬 글레이즈와 꽃 장식 포함",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      }
    },
    "cakeSizeOptions": [
      {
        "value": "15cm",
        "label": "6 inch / 15cm",
        "description": "작게 즐기기 좋은 기본 사이즈",
        "price": 45000
      },
      {
        "value": "17cm",
        "label": "6.7 inch / 17cm",
        "description": "조금 더 여유 있는 사이즈",
        "price": 55000
      },
      {
        "value": "19cm",
        "label": "7.5 inch / 19cm",
        "description": "나눠 먹기 좋은 사이즈",
        "price": 65000
      },
      {
        "value": "22cm",
        "label": "8.7 inch / 22cm",
        "description": "여러 명이 나누기 좋은 큰 사이즈",
        "price": 80000
      }
    ],
    "chocolateTypeOptions": [
      {
        "value": "dark",
        "label": "Dark chocolate",
        "description": "Deep and balanced chocolate profile",
        "extraPrice": 0
      },
      {
        "value": "milk",
        "label": "Milk chocolate",
        "description": "Softer and creamier chocolate profile",
        "extraPrice": 0
      }
    ],
    "poundAddonOptions": [
      {
        "value": "none",
        "label": "기본 마감",
        "description": "기본 마감 옵션",
        "extraPrice": 0
      },
      {
        "value": "extra-chocolate",
        "label": "Extra chocolate",
        "description": "Add extra chocolate finish",
        "extraPrice": 5000
      },
      {
        "value": "vanilla-cream",
        "label": "Vanilla cream",
        "description": "Add vanilla cream finish",
        "extraPrice": 5000
      }
    ],
    "cacaoOptions": [
      {
        "value": "기본",
        "label": "기본 옵션",
        "title": "부드러운 기본 밸런스",
        "description": "아이와 함께 드시거나 처음 주문하시는 분께 추천합니다.",
        "extraPrice": 0
      },
      {
        "value": "70",
        "label": "70%",
        "title": "덜 달고 진한 풍미",
        "description": "커피와 함께 먹기 좋은 어른의 초콜릿 맛입니다.",
        "extraPrice": 5000
      },
      {
        "value": "80.5",
        "label": "80.5%",
        "title": "깊고 쌉싸름한 여운",
        "description": "조금 더 깊은 카카오의 맛을 느끼고 싶은 분께 추천합니다.",
        "extraPrice": 8000
      },
      {
        "value": "100",
        "label": "100% Cacao",
        "title": "완전한 카카오 본연의 맛",
        "description": "단맛 없이 카카오 본연의 쌉싸름한 향을 즐기는 분께 추천합니다.",
        "extraPrice": 10000
      }
    ]
  },
  "AU": {
    "products": {
      "pave-cake": {
        "id": "pave-cake",
        "name": "Pave Chocolate Cake",
        "description": "A rich four-layer chocolate cake built for a dense, chocolate-forward bite. Instead of a light sponge-and-cream style, each layer is filled with smooth pave chocolate ganache, creating a substantial cake with deep chocolate flavour from the first slice to the last.",
        "price": 79,
        "priceNote": "Choose a size · dark chocolate only",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": true,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "6in": 79,
          "8in": 109,
          "10in": 159
        }
      },
      "vanilla-fresh-cream-cake": {
        "id": "vanilla-fresh-cream-cake",
        "name": "Vanilla Fresh Cream Cake",
        "description": "Our Signature Gâteau au Chocolat layers are filled with vanilla fresh cream made with real vanilla bean. Natural vanilla bean specks are visible throughout the cream.",
        "price": 69,
        "priceNote": "Choose a size · Vanilla fresh cream with real vanilla bean",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "15cm": 69,
          "19cm": 89,
          "22cm": 119
        }
      },
      "buttercream-cake": {
        "id": "buttercream-cake",
        "name": "Buttercream Cake",
        "description": "Our Signature Gâteau au Chocolat layers are filled and finished with chocolate buttercream made with Italian meringue, real butter and cocoa powder.",
        "price": 75,
        "priceNote": "Choose a size and cake colour · Chocolate Buttercream included",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "6in": 75,
          "8in": 99,
          "10in": 145
        }
      },
      "fresh-strawberry-vanilla-cream-cake": {
        "id": "fresh-strawberry-vanilla-cream-cake",
        "name": "Fresh Strawberry Vanilla Cream Cake",
        "description": "Soft genoise layers filled with vanilla fresh cream and fresh strawberries, finished with more strawberries on top. Real vanilla bean brings a fragrant finish to the fresh cream.",
        "price": 65,
        "priceNote": "Choose a size",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "6in": 65,
          "8in": 89,
          "10in": 129
        }
      },
      "fresh-strawberry-chocolate-cream-cake": {
        "id": "fresh-strawberry-chocolate-cream-cake",
        "name": "Fresh Strawberry Chocolate Cream Cake",
        "description": "Soft genoise layers filled with chocolate fresh cream and fresh strawberries, finished with more strawberries on top. A classic chocolate-and-strawberry combination in a fresh-cream cake.",
        "price": 69,
        "priceNote": "Choose a size",
        "usesCacaoOptions": false,
        "usesSizeOptions": true,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {
          "6in": 69,
          "8in": 95,
          "10in": 135
        }
      },
      "pound-cake": {
        "id": "pound-cake",
        "name": "Signature Gâteau au Chocolat",
        "description": "A rich rectangular gateau chocolat finished with dark chocolate. Simple, compact and easy to share or gift.",
        "price": 45,
        "priceNote": "Choose one finish option",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": true,
        "sizePrices": {}
      },
      "cupcake-dozen": {
        "id": "cupcake-dozen",
        "name": "Chocolate Cupcakes",
        "description": "Chocolate cupcakes with one finish across the whole box.",
        "price": 55,
        "priceNote": "Choose a dozen and one finish for the whole box",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "cupcake-half-dozen": {
        "id": "cupcake-half-dozen",
        "name": "Chocolate Cupcakes",
        "description": "Chocolate cupcakes with one finish across the whole box.",
        "price": 31,
        "priceNote": "Choose a half dozen and one finish for the whole box",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "choco-basque-cheesecake": {
        "id": "choco-basque-cheesecake",
        "name": "Chocolatier's Basque Cheesecake",
        "description": "A 6\" | serves 8 chocolate Basque cheesecake with a deeply baked top and a smooth, rich centre.",
        "price": 55,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "pave-choco-basque-cheesecake": {
        "id": "pave-choco-basque-cheesecake",
        "name": "Pave chocolate on top",
        "description": "Our 6\" | serves 8 Chocolatier's Basque cheesecake finished with pave chocolate on top.",
        "price": 65,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "eiffel-tower-basque-cheesecake": {
        "id": "eiffel-tower-basque-cheesecake",
        "name": "Cake finishing with Eiffel Tower",
        "description": "Our 6\" | serves 8 Chocolatier’s Basque cheesecake covered with pave chocolate and finished with one Eiffel Tower chocolate.",
        "price": 70,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "brownie-cheesecake": {
        "id": "brownie-cheesecake",
        "name": "Brownie Cheesecake",
        "description": "A rich dark chocolate brownie base topped with a baked Basque-style cheesecake layer. Two contrasting textures come together in one chocolate-and-cheesecake dessert.",
        "price": 85,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "pave-brownie-cheesecake": {
        "id": "pave-brownie-cheesecake",
        "name": "Brownie Cheesecake · Pave chocolate on top",
        "description": "Dark chocolate brownie and Basque-style cheesecake finished with smooth pave chocolate on top.",
        "price": 95,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "eiffel-tower-brownie-cheesecake": {
        "id": "eiffel-tower-brownie-cheesecake",
        "name": "Brownie Cheesecake · Eiffel Tower finish",
        "description": "Dark chocolate brownie and Basque-style cheesecake fully finished with pave chocolate and one Eiffel Tower chocolate.",
        "price": 70,
        "priceNote": "6\" | serves 8",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-4": {
        "id": "fresh-lemon-cupcakes-4",
        "name": "Lemon Cake · 4 pieces",
        "description": "Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.",
        "price": 24,
        "priceNote": "4-piece box · lemon glaze and floral finish included",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-6": {
        "id": "fresh-lemon-cupcakes-6",
        "name": "Lemon Cake · 6 pieces",
        "description": "Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.",
        "price": 36,
        "priceNote": "6-piece box · lemon glaze and floral finish included",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-8": {
        "id": "fresh-lemon-cupcakes-8",
        "name": "Lemon Cake · 8 pieces",
        "description": "Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.",
        "price": 45,
        "priceNote": "8-piece box · lemon glaze and floral finish included",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-12": {
        "id": "fresh-lemon-cupcakes-12",
        "name": "Lemon Cake · 12 pieces",
        "description": "Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.",
        "price": 65,
        "priceNote": "12-piece box · Most Popular",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "fresh-lemon-cupcakes-16": {
        "id": "fresh-lemon-cupcakes-16",
        "name": "Lemon Cake · 16 pieces",
        "description": "Made with freshly squeezed lemon juice and fresh lemon zest, from the cake batter to the lemon syrup and glaze. A bright, citrus-forward little cake finished with real lemon flavour in every step.",
        "price": 85,
        "priceNote": "16-piece box · lemon glaze and floral finish included",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      },
      "smore-stick": {
        "id": "smore-stick",
        "name": "S'more Stick",
        "description": "Toasted marshmallows on a stick coated in rich couverture chocolate for gatherings and party sharing.",
        "price": 4.5,
        "priceNote": "AUD 4.50 / stick · Bulk discounts from 6+ sticks",
        "usesCacaoOptions": false,
        "usesSizeOptions": false,
        "usesChocolateTypeOptions": false,
        "usesPoundAddonOptions": false,
        "sizePrices": {}
      }
    },
    "cakeSizeOptions": [
      {
        "value": "15cm",
        "label": "6\" | serves 8",
        "description": "A compact cake for a small gathering or gift",
        "price": 75
      },
      {
        "value": "19cm",
        "label": "7.5\" | serves 14",
        "description": "A larger celebration size",
        "price": 95
      },
      {
        "value": "22cm",
        "label": "9\" | serves 22",
        "description": "A generous party size",
        "price": 115
      }
    ],
    "chocolateTypeOptions": [
      {
        "value": "dark",
        "label": "Dark chocolate",
        "description": "Deep and balanced chocolate profile",
        "extraPrice": 0
      }
    ],
    "poundAddonOptions": [
      {
        "value": "none",
        "label": "Basic finish",
        "description": "Classic finish",
        "extraPrice": 0
      },
      {
        "value": "extra-chocolate",
        "label": "Extra chocolate",
        "description": "Add extra chocolate finish",
        "extraPrice": 7
      },
      {
        "value": "vanilla-cream",
        "label": "Vanilla cream",
        "description": "Add vanilla cream finish",
        "extraPrice": 10
      }
    ],
    "cacaoOptions": [
      {
        "value": "기본",
        "label": "Classic",
        "title": "Smooth classic balance",
        "description": "Recommended for first orders or a gentler chocolate profile.",
        "extraPrice": 0
      },
      {
        "value": "70",
        "label": "70%",
        "title": "Less sweet, deeper cacao",
        "description": "A darker profile that pairs well with coffee.",
        "extraPrice": 6
      },
      {
        "value": "80.5",
        "label": "80.5%",
        "title": "Deep cacao finish",
        "description": "For a bolder and more lingering chocolate flavour.",
        "extraPrice": 9
      },
      {
        "value": "100",
        "label": "100% Cacao",
        "title": "Pure cacao intensity",
        "description": "A bitter, unsweetened cacao-forward option.",
        "extraPrice": 12
      }
    ]
  }
}
export const storedMarketConfig = catalogs[MARKET]
