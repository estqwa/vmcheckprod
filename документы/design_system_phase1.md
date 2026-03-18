# Design System Phase 1

## Prosto O Chem Eta Faza

Eta faza ne menyaet rabotayushchie ekrany i ne trevozhit navigatsiyu.
My delaem dve veschi:

1. fiksiruem odin istochnik pravdy dlya dizayna;
2. opisyvaem pravila, chtoby sleduyuschie pravki byli bezopasnymi i odinakovymi dlya web i mobile.

Prostymi slovami:
seichas my ne "pererisovyvaem prilozhenie", a dogovarivaemsya, kakim yazykom ono dolzhno govorit.

## Chto Vkhodit V Phase 1

- obschii source of truth dlya tokenov v [shared/src/design-tokens.ts](/C:/project/vmdeploy/shared/src/design-tokens.ts)
- adapter dlya web v [trivia-apinewfront/src/lib/designTokens.ts](/C:/project/vmdeploy/trivia-apinewfront/src/lib/designTokens.ts)
- adapter dlya mobile v [trivia-mobile/src/theme/tokens.ts](/C:/project/vmdeploy/trivia-mobile/src/theme/tokens.ts)
- pravila po typography, spacing, semantic states i component blueprints

## Glavnye Printsipy

### 1. Standartiziruem Sistemou, A Ne Ekrany

Web i mobile ne dolzhny byt pixel-perfect kopiey drug druga.
Oni dolzhny delit:

- odni i te zhe tokeny
- odni i te zhe semantic states
- odnu i tu zhe ierarhiyu teksta
- odin i tot zhe smysl komponentov

No shell mozet otlichat'sya:

- web: hover, focus, shirina kontentnykh konteinerov
- mobile: touch-first, safe areas, thumb reach, 44-48 target size

### 2. Nikakikh Sluchainykh Design-Reshenii V Novom Kode

V novykh komponentakh i refaktorakh ne dolzhno byt:

- sluchainykh hex-tsvetov bez prichiny
- novykh razmerov texta mimo roley
- proizvolnykh radius/spacing znachenii
- esche odnogo "vremenogo" state-banner'a ili tile-komponenta

### 3. Snachala Semantika, Potom Dekor

Vazhen ne "kakoi to zelenyi", a:

- `success.surface`
- `success.border`
- `success.text`

To zhe samoe dlya:

- `warning`
- `danger`
- `info`
- `offline`

## Novaya Struktura Tokenov

V [shared/src/design-tokens.ts](/C:/project/vmdeploy/shared/src/design-tokens.ts) teper est 4 sloya:

### `meta`

Dlya komandnogo ponimaniya:

- kakaya eto faza
- gde source of truth
- kakie printsipy aktivny

### `base`

Syrye primitivy:

- raw colors
- font family
- spacing scale
- radius scale

Eto ne dlya pryamogo upotrebleniya na ekranakh.

### `semantic`

Sloi, kotorye dolzhny ispol'zovat'sya v UI:

- `semantic.color`
- `semantic.state`

Imenno etot sloi nuzhen dlya standartizatsii web i mobile.

### `component`

Minimal'nye pravila dlya bazovykh patternov:

- touch target
- card
- field
- button
- nav

Eto esche ne gotovye komponenty.
Eto kontrakt dlya phase 2.

## Chto Ostaetsya Sovmestimym

Tekuschii UI ne dolzhen slomat'sya.
Poetomu my sokhranili compatibility layer:

- `designTokens.color`
- `designTokens.radius`
- `designTokens.spacing`
- `designTokens.iconSize`
- `designTokens.typography.title`
- `designTokens.typography.sectionTitle`
- `designTokens.typography.subtitle`

To est tekuschie ekrany mogut rabotat kak rabotali.

## Typography Standard Na Start

My fiksiruem obschie roli:

- `display`
- `headline`
- `title`
- `sectionTitle`
- `subtitle`
- `body`
- `bodySm`
- `label`
- `caption`
- `metric`

Pravilo:
novye komponenty i refaktory dolzhny vybirat rol', a ne pridumyvat novyi size.

## Spacing Standard Na Start

Tselevaya setka dlya novogo dizayna:

- `4`
- `8`
- `12`
- `16`
- `24`
- `32`
- `40`
- `48`
- `64`

Vazhno:
tekuschie live aliasy `xs/sm/md/lg/xl/xxl` my ne lomali v phase 1.
Perekhod na novuyu setku budet postupatel'nym.

## State Matrix, Kotoruyu Schitaem Obyazatel'noi

Kazhdyy bazovyi komponent dolzhen podderzhivat ili hotya by imet smyslovoi kontrakt dlya:

- `default`
- `hover` (tol'ko tam, gde eto imeet smysl na web)
- `focus`
- `pressed`
- `selected`
- `disabled`
- `loading`
- `error`
- `success`

## Chto Budet V Phase 2

Phase 2 uzhe pro kod komponentov, a ne pro pravila.
Tam nado sobrat obschie primitivy:

- `SurfaceCard`
- `StatTile`
- `StatusBadge`
- `StateBanner`
- `EmptyState`
- `FormField`
- `CountdownTile`

## Chto Ne Delaem V Phase 1

- ne menyaem navigatsiyu
- ne menyaem routing
- ne peredelivaem ekrany
- ne perenaznachaem massovo spacing i font size
- ne trogaem adminku

## Na Chto Opiraemsya

- [Design Tokens Format Module 2025.10](https://www.designtokens.org/TR/2025.10/format/)
- [Android Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Android Layout Basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics)
- [Apple HIG: Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)

## Odnim Predlozheniem

Phase 1 = my zafiksirovali "kak pravil'no stroitsya dizain", no ne nachali massovo peredelivat rabotayuschii produkt.
