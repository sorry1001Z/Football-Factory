<?php
/** Banner: contain rather than crop; Image Factory owns artwork. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$style = isset( $args['style'] ) && in_array( $args['style'], array( 'grid', 'hero', 'feed' ), true ) ? $args['style'] : 'grid';
$categories = get_the_category();
?>
<article <?php post_class( 'news-card card-' . $style . ' banner-' . ff90_banner_kind( get_the_ID() ) ); ?>>
<a class="card-image" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true"><?php if ( has_post_thumbnail() ) {
    the_post_thumbnail( 'large', array( 'class' => 'banner-image', 'alt' => '', 'loading' => 'hero' === $style ? 'eager' : 'lazy' ) );
} else { ?><span class="image-placeholder" aria-hidden="true">FF<span>90</span><small>THE FOOTBALL EDIT</small></span><?php } ?></a>
<div class="card-copy"><?php if ( $categories ) : ?><a class="category-label" href="<?php echo esc_url( get_category_link( $categories[0] ) ); ?>"><?php echo esc_html( $categories[0]->name ); ?></a><?php endif; ?>
<h2 class="card-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
<div class="post-meta"><time datetime="<?php echo esc_attr( get_the_date( DATE_W3C ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time></div>
<?php if ( 'feed' === $style ) : ?><div class="card-excerpt"><?php the_excerpt(); ?></div><?php endif; ?></div></article>
