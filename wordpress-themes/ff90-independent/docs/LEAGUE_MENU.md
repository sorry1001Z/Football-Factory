# Football navigation menus

Use native WordPress menus assigned to Primary navigation. Two separate top-level
items are used; no third navigation level or new plugin is needed.

## ข่าวฟุตบอลลีก

Rename the existing ข่าวฟุตบอล **menu label** to ข่าวฟุตบอลลีก. This does not
rename the news category or change existing article/category URLs. Keep these
five category links one level below it:

- พรีเมียร์ลีก (`premier-league`)
- ลาลีกา (`la-liga`)
- บุนเดสลีกา (`bundesliga`)
- กัลโช่ เซเรีย อา (`serie-a`)
- ลีกเอิง (`ligue-1`)

## บอลถ้วย

Add a separate top-level บอลถ้วย category link (`football-cups`) with these
13 children:

- ยูฟ่าแชมเปียนส์ลีก (`uefa-champions-league`)
- ยูฟ่ายูโรปาลีก (`uefa-europa-league`)
- ยูฟ่าซูเปอร์คัพ (`uefa-super-cup`)
- เอฟเอ คัพ (`fa-cup`)
- คาราบาวคัพ (`carabao-cup`)
- โกปา เดล เรย์ (`copa-del-rey`)
- ซูเปร์โกปา เด เอสปัญญา (`supercopa-de-espana`)
- โกปา อิตาเลีย (`coppa-italia`)
- ซูเปร์โกปา อิตาเลียนา (`supercoppa-italiana`)
- เดเอฟเบ โพคาล (`dfb-pokal`)
- เดเอฟแอล ซูเปอร์คัพ (`dfl-supercup`)
- กุปเดอฟร็องส์ (`coupe-de-france`)
- ทรอเฟ เดช็องปียง (`trophee-des-champions`)

DFL-Supercup is labeled เดเอฟแอล ซูเปอร์คัพ (DFL, not DFM).

## Configure a site

1. Create the native categories under Posts → Categories as needed. League
   categories can remain under ข่าวฟุตบอล; cup categories belong under บอลถ้วย.
2. Appearance → Menus (or Customize → Menus): rename the existing parent menu
   label to ข่าวฟุตบอลลีก, then add a separate root บอลถ้วย.
3. Indent the five league items under ข่าวฟุตบอลลีก and the 13 cup items under
   บอลถ้วย. Save the menu assigned to Primary navigation.

Desktop hover or keyboard focus exposes each submenu. Long desktop lists
scroll, including when the last item receives keyboard focus. Mobile shows
indented child links inside the expanded main menu, using normal page scroll.
Parent category links remain clickable. No-JavaScript fallback is preserved.

This configuration was made only in the disposable QA WordPress; production
menus/categories are unchanged. Installing the theme ZIP does not silently
create categories or menu records. Empty category pages remain honest until
approved articles are published.

For the explicitly marked local QA site, after tests/seed.php, reproduce with:

```sh
wp eval-file tests/menu-fixtures.php /absolute/path/to/tests/menu-items.json
node tests/submenu.cjs
```

The fixture helper refuses to run without WP_CLI and FF90_QA_SANDBOX. It is
excluded from the installable theme ZIP.
