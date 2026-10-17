<?php
/** WordPress-managed comment form and nonce handling. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
if ( post_password_required() ) { return; }
?>
<section id="comments" class="comments-area"><h2><?php esc_html_e( 'ความคิดเห็น', 'ff90-independent' ); ?></h2><?php if ( have_comments() ) : ?><ol class="comment-list"><?php wp_list_comments( array( 'style' => 'ol', 'short_ping' => true ) ); ?></ol><?php the_comments_navigation(); endif; comment_form(); ?></section>
