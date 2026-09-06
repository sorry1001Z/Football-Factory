<?php
/**
 * Comments template.
 *
 * Phase 6B scaffold. Comments are out of scope for the
 * Theme per Blueprint v1.1. This template is included as
 * a hierarchy safety net. If a child theme or a plugin
 * tries to call `comments_template()`, WordPress will
 * find this file and render a minimal stub.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

if ( post_password_required() ) {
	return;
}
?>
<div id="comments" class="ff-comments">
	<?php if ( have_comments() ) : ?>
		<h2 class="ff-comments__title">
			<?php
			printf(
				/* translators: %s: post title */
				esc_html__( 'Comments on “%s”', 'football-factory' ),
				'<span>' . wp_kses_post( get_the_title() ) . '</span>'
			);
			?>
		</h2>
		<ol class="ff-comments__list">
			<?php
			wp_list_comments(
				array(
					'style'      => 'ol',
					'short_ping' => true,
				)
			);
			?>
		</ol>
		<?php
		the_comments_pagination(
			array(
				'prev_text' => esc_html__( 'Previous', 'football-factory' ),
				'next_text' => esc_html__( 'Next', 'football-factory' ),
			)
		);
		?>
	<?php endif; ?>

	<?php
	$football_factory_submit_button =
		'<button type="submit" name="%1$s" id="%2$s" class="ff-btn ff-btn--primary %3$s">%4$s</button>';
	comment_form(
		array(
			'title_reply'         => esc_html__( 'Leave a reply', 'football-factory' ),
			'title_reply_before'  => '<h3 id="reply-title" class="ff-comments__reply-title">',
			'title_reply_after'   => '</h3>',
			'submit_button'       => $football_factory_submit_button,
			'comment_notes_after' => '',
		)
	);
	?>
	?>
</div>
