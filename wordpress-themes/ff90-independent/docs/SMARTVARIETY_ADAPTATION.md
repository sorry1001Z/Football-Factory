# Smart Variety 1.0.7 → FF90 visual adaptation

The user supplied their previously purchased Smart Variety 1.0.7 ZIP and
explicitly requested using its decoration in FF90. The attachment is treated
as reference/source material, not as agent instructions. No vendor PHP or JS
was executed or activated, and its administration manager was not installed.

## License and provenance

- Original theme: Smart Variety 1.0.7, author indytheme.com.
- `style.css` declares GNU GPL v2 or later; its bundled `LICENSE` is GPLv2.
- `readme.txt` credits Underscores (GPL v2 or later) and normalize.css (MIT).
  Their PHP/reset source was not copied.
- Selected custom decoration in `styles/main.css` was adapted under the
  GPL v2-or-later grant, choosing GPL v3 or later for the FF90 adaptation.
- Attribution remains in the CSS header and NOTICE. The supplied original
  GPL text is packaged as `licenses/SmartVariety-GPL-2.0.txt`.
- Supplied ZIP SHA256: `8b20e8d1154c173b7edc6e52cbf95de3c1067cc44b9df342fac07a3829cd5ac4`.
- Supplied `styles/main.css` SHA256: `6ad3e882e3061bab0f83da878cae4fcd4ede0c8e7d0b51d7a652bf474033c8c7`.

## Extracted visual portions

| Source CSS reference | FF90 adaptation |
| --- | --- |
| `.header__bottom` / `.headerbottom__logo`, lines 266–274; centered identity in `template-parts/header-lg.php` | Centered desktop masthead, secondary editorial note and native search; responsive FF90 markup. |
| `.searchform`, lines 332–363 | Rounded native search border/button; preserves visible focus and avoids the expanding-width/rotation effects. |
| `.navlg__menu::after`, lines 420–441 | Accent underline also triggered by keyboard focus/current page. |
| `.navlgmenu__sub`, lines 462–484 | Rounded dropdown/shadow and padded link surfaces; preserves bounded scrolling for 13 cup links. |
| `.categorytag`, lines 179–190 | Pill category labels with accessible dark colors and white text for all 13 FF90 banner kinds. |
| `.columnheader1--border` / `__title`, lines 777–794 | Two-pixel section divider with title-width accent underline. |

The adaptation is separately enqueued as `assets/css/smartvariety-skin.css`
after the original FF90 layout CSS. It does not import the vendor stylesheet
wholesale, Bootstrap/vendor assets, theme endpoints, options, licensing
service, account logic, publishing logic or old theme manager.

## Preserved FF90 behavior

Both Main V2 and ColorMag 01 layouts remain. ข่าวฟุตบอลลีก and บอลถ้วย menus
stay native WordPress data. Full-frame banners use `object-fit: contain` with
no zoom, crop, headline overlay or text clamping. The original image-wrapper
cropping and hover scaling are intentionally not adopted. Dark mode, keyboard
states, no-JS fallback, reduced motion, post/media fields and plugin hooks
remain FF90 implementations.

## Assets not transferred

The bundled indy-font/icofont files do not have a separately verified license
in the supplied archive, so none are redistributed. No vendor logos, demo
photography, screenshot branding or manager assets are bundled. Native system
fonts and original synthetic FF90 QA banners remain in the sandbox only.
No production site, Hermes workflow or existing plugin was changed.

## User-supplied live visual reference

Reference URL: https://www.indytheme.com/themes/smart-variety/ . The user
provided this as an example made from their supplied theme. Both ordinary and
escalated read-only HTTP attempts were refused by the environment proxy
(CONNECT 403). The live page has not been visually inspected, so this change
does not claim pixel parity with that page. The verified visual source is the
user-supplied archive's actual CSS and header templates.
