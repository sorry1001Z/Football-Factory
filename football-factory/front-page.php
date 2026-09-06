<?php
/**
 * Front page template.
 *
 * Phase 6B scaffold. The full production homepage is
 * implemented in a later phase. This template simply
 * delegates to `index.php` for now so the site has a
 * working front page that activates the Theme shell
 * and asset pipeline.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

// Phase 6B: defer to index.php. The full homepage
// implementation (hero, live bar, news list, match list,
// preview list, AI insight, league list, transfer list)
// arrives when view-models are wired in a later phase.
require get_template_directory() . '/index.php';
