# League submenu under ข่าวฟุตบอล

The primary menu supports native WordPress child items (two levels). No new
plugin or hardcoded destination is needed. Configure each site's menu in
Appearance → Menus (or Customize → Menus):

1. Under Posts → Categories, create พรีเมียร์ลีก (`premier-league`), ลาลีกา
   (`la-liga`), บุนเดสลีกา (`bundesliga`), กัลโช่ เซเรีย อา (`serie-a`), and
   ลีกเอิง (`ligue-1`). Optionally set ข่าวฟุตบอล as their parent category.
2. Add all five category links to the menu assigned to Primary navigation.
3. Drag the five items one level beneath ข่าวฟุตบอล and save the menu.

Desktop: hover or keyboard-focus ข่าวฟุตบอล to expose the submenu, then Tab
to league links. Mobile: open เมนู; child links are visible indented beneath
the parent. The parent remains a clickable category link. No JavaScript is
needed for the desktop/keyboard fallback. Categories show an honest empty
state until approved articles are published; no sample football news is added.

This menu was configured only in the disposable QA WordPress. WordPress menu
records are site data: installing the theme ZIP does not create or change a
production site's menu or categories. Configure the real site through its
native admin after staging acceptance.
