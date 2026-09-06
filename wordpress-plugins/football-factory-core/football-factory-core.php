<?php
/**
 * Plugin Name: Football Factory Core
 * Plugin URI: https://github.com/sorry1001Z/Football-Factory
 * Description: Core football data, REST API, SEO schema, and integration scaffolding for the Football Factory WordPress theme.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Author: Football Factory Team
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: football-factory-core
 *
 * @package Football_Factory_Core
 */

declare( strict_types = 1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'FOOTBALL_FACTORY_CORE_VERSION', '0.1.0' );
define( 'FOOTBALL_FACTORY_CORE_OPTION', 'football_factory_core_options' );
define( 'FOOTBALL_FACTORY_CORE_CAP_MANAGE', 'manage_football_data' );
define( 'FOOTBALL_FACTORY_CORE_CAP_READ', 'read_football_data' );

/**
 * Does the core plugin report as available?
 *
 * @return bool
 */
function ff_core_available(): bool {
	return true;
}

/**
 * Build a small view model consumed by the theme.
 *
 * @param string $context Template context.
 * @param array  $args    Optional context arguments.
 * @return array<string,mixed>
 */
function ff_get_view_model( string $context = 'default', array $args = array() ): array {
	return array(
		'context' => sanitize_key( $context ),
		'args'    => $args,
		'core'    => array(
			'available' => true,
			'version'   => FOOTBALL_FACTORY_CORE_VERSION,
		),
		'data'    => array(),
	);
}

/**
 * Return a basic breadcrumb chain.
 *
 * @return list<array{label:string,url:string}>
 */
function ff_breadcrumb_chain(): array {
	return array(
		array(
			'label' => __( 'Home', 'football-factory-core' ),
			'url'   => home_url( '/' ),
		),
	);
}

/**
 * Return SEO metadata for the current request.
 *
 * @return array<string,mixed>
 */
function ff_seo_meta(): array {
	$title       = wp_get_document_title();
	$site_name   = get_bloginfo( 'name' );
	$description = get_bloginfo( 'description' );

	if ( is_singular() ) {
		$post_id     = get_queried_object_id();
		$description = has_excerpt( $post_id ) ? get_the_excerpt( $post_id ) : wp_strip_all_tags( get_post_field( 'post_content', $post_id ) );
		$description = wp_trim_words( $description, 28, '' );
	}

	return array(
		'title'       => $title,
		'description' => $description,
		'schema'      => array(
			'@context'    => 'https://schema.org',
			'@type'       => is_singular( 'post' ) ? 'NewsArticle' : 'WebSite',
			'name'        => $title,
			'description' => $description,
			'url'         => home_url( add_query_arg( array(), $GLOBALS['wp']->request ?? '' ) ),
			'publisher'   => array(
				'@type' => 'Organization',
				'name'  => $site_name,
			),
		),
	);
}

/**
 * Log an internal Football Factory event.
 *
 * @param string $event Event name.
 * @param array  $data  Event payload.
 * @return void
 */
function ff_log_event( string $event, array $data = array() ): void {
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[football-factory-core] ' . sanitize_key( $event ) . ' ' . wp_json_encode( $data ) );
	}
}

/**
 * Bootstrap the core plugin.
 */
final class Football_Factory_Core {
	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register_capabilities' ), 1 );
		add_action( 'init', array( __CLASS__, 'register_content_types' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
		add_action( 'wp_head', array( __CLASS__, 'print_schema' ), 20 );
		add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
	}

	/**
	 * Add capabilities to administrators.
	 *
	 * @return void
	 */
	public static function activate(): void {
		self::register_capabilities();
		self::register_content_types();
		flush_rewrite_rules();
	}

	/**
	 * Flush rewrite rules on deactivation.
	 *
	 * @return void
	 */
	public static function deactivate(): void {
		flush_rewrite_rules();
	}

	/**
	 * Register custom capabilities used by admin and REST.
	 *
	 * @return void
	 */
	public static function register_capabilities(): void {
		$role = get_role( 'administrator' );

		if ( ! $role ) {
			return;
		}

		$role->add_cap( FOOTBALL_FACTORY_CORE_CAP_MANAGE );
		$role->add_cap( FOOTBALL_FACTORY_CORE_CAP_READ );
	}

	/**
	 * Register football content types and taxonomies.
	 *
	 * @return void
	 */
	public static function register_content_types(): void {
		self::register_post_type(
			'ff_match',
			__( 'Matches', 'football-factory-core' ),
			__( 'Match', 'football-factory-core' ),
			'matches'
		);
		self::register_post_type(
			'ff_team',
			__( 'Teams', 'football-factory-core' ),
			__( 'Team', 'football-factory-core' ),
			'teams'
		);
		self::register_post_type(
			'ff_player',
			__( 'Players', 'football-factory-core' ),
			__( 'Player', 'football-factory-core' ),
			'players'
		);
		self::register_post_type(
			'ff_league',
			__( 'Leagues', 'football-factory-core' ),
			__( 'League', 'football-factory-core' ),
			'leagues'
		);
		self::register_post_type(
			'ff_transfer',
			__( 'Transfers', 'football-factory-core' ),
			__( 'Transfer', 'football-factory-core' ),
			'transfers'
		);

		register_taxonomy(
			'ff_season',
			array( 'ff_match', 'ff_team', 'ff_player', 'ff_league', 'ff_transfer' ),
			array(
				'labels'            => array(
					'name'          => __( 'Seasons', 'football-factory-core' ),
					'singular_name' => __( 'Season', 'football-factory-core' ),
				),
				'public'            => true,
				'hierarchical'      => false,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'rewrite'           => array( 'slug' => 'football-season' ),
			)
		);

		register_taxonomy(
			'ff_competition',
			array( 'ff_match', 'ff_team', 'ff_player', 'ff_league' ),
			array(
				'labels'            => array(
					'name'          => __( 'Competitions', 'football-factory-core' ),
					'singular_name' => __( 'Competition', 'football-factory-core' ),
				),
				'public'            => true,
				'hierarchical'      => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'rewrite'           => array( 'slug' => 'competition' ),
			)
		);
	}

	/**
	 * Register one post type.
	 *
	 * @param string $type     Post type key.
	 * @param string $plural   Plural label.
	 * @param string $singular Singular label.
	 * @param string $slug     URL slug.
	 * @return void
	 */
	private static function register_post_type( string $type, string $plural, string $singular, string $slug ): void {
		register_post_type(
			$type,
			array(
				'labels'       => array(
					'name'          => $plural,
					'singular_name' => $singular,
					'add_new_item'  => sprintf(
						/* translators: %s: content type label. */
						__( 'Add New %s', 'football-factory-core' ),
						$singular
					),
					'edit_item'     => sprintf(
						/* translators: %s: content type label. */
						__( 'Edit %s', 'football-factory-core' ),
						$singular
					),
				),
				'public'       => true,
				'has_archive'  => true,
				'menu_icon'    => 'dashicons-shield',
				'show_in_rest' => true,
				'rewrite'      => array( 'slug' => $slug ),
				'supports'     => array( 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ),
			)
		);
	}

	/**
	 * Register REST endpoints.
	 *
	 * @return void
	 */
	public static function register_rest_routes(): void {
		register_rest_route(
			'football-factory/v1',
			'/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'rest_status' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'football-factory/v1',
			'/matches',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'rest_matches' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'football-factory/v1',
			'/n8n/event',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'rest_n8n_event' ),
				'permission_callback' => array( __CLASS__, 'can_receive_n8n_event' ),
			)
		);
	}

	/**
	 * REST status response.
	 *
	 * @return WP_REST_Response
	 */
	public static function rest_status(): WP_REST_Response {
		return rest_ensure_response(
			array(
				'available' => true,
				'version'   => FOOTBALL_FACTORY_CORE_VERSION,
				'plugin'    => 'football-factory-core',
			)
		);
	}

	/**
	 * REST matches response.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_matches( WP_REST_Request $request ): WP_REST_Response {
		$limit = min( 20, max( 1, (int) $request->get_param( 'per_page' ) ) );
		$query = new WP_Query(
			array(
				'post_type'      => 'ff_match',
				'post_status'    => 'publish',
				'posts_per_page' => $limit,
			)
		);

		$items = array_map(
			static function ( WP_Post $post ): array {
				return array(
					'id'      => $post->ID,
					'title'   => get_the_title( $post ),
					'url'     => get_permalink( $post ),
					'excerpt' => get_the_excerpt( $post ),
				);
			},
			$query->posts
		);

		return rest_ensure_response( $items );
	}

	/**
	 * Check whether an n8n event can be accepted.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return bool
	 */
	public static function can_receive_n8n_event( WP_REST_Request $request ): bool {
		$options = self::options();
		$token   = (string) ( $options['n8n_webhook_token'] ?? '' );

		if ( '' === $token ) {
			return false;
		}

		$provided = (string) $request->get_header( 'x-football-factory-token' );
		return hash_equals( $token, $provided );
	}

	/**
	 * Receive a lightweight n8n event.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_n8n_event( WP_REST_Request $request ): WP_REST_Response {
		ff_log_event( 'n8n_event', array( 'payload' => $request->get_json_params() ) );

		return rest_ensure_response(
			array(
				'accepted' => true,
			)
		);
	}

	/**
	 * Print JSON-LD schema metadata.
	 *
	 * @return void
	 */
	public static function print_schema(): void {
		if ( is_admin() || wp_doing_ajax() ) {
			return;
		}

		$meta = ff_seo_meta();
		if ( empty( $meta['schema'] ) || ! is_array( $meta['schema'] ) ) {
			return;
		}

		echo '<script type="application/ld+json">' . wp_json_encode( $meta['schema'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
	}

	/**
	 * Register settings page.
	 *
	 * @return void
	 */
	public static function register_admin_page(): void {
		add_options_page(
			__( 'Football Factory Core', 'football-factory-core' ),
			__( 'Football Factory Core', 'football-factory-core' ),
			FOOTBALL_FACTORY_CORE_CAP_MANAGE,
			'football-factory-core',
			array( __CLASS__, 'render_admin_page' )
		);
	}

	/**
	 * Register settings.
	 *
	 * @return void
	 */
	public static function register_settings(): void {
		register_setting(
			'football_factory_core',
			FOOTBALL_FACTORY_CORE_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize_options' ),
				'default'           => array(
					'football_api_base_url' => '',
					'football_api_key'      => '',
					'n8n_webhook_token'     => '',
				),
			)
		);
	}

	/**
	 * Sanitize settings.
	 *
	 * @param mixed $input Raw input.
	 * @return array<string,string>
	 */
	public static function sanitize_options( $input ): array {
		$input = is_array( $input ) ? $input : array();

		return array(
			'football_api_base_url' => esc_url_raw( (string) ( $input['football_api_base_url'] ?? '' ) ),
			'football_api_key'      => sanitize_text_field( (string) ( $input['football_api_key'] ?? '' ) ),
			'n8n_webhook_token'     => sanitize_text_field( (string) ( $input['n8n_webhook_token'] ?? '' ) ),
		);
	}

	/**
	 * Get saved options.
	 *
	 * @return array<string,string>
	 */
	private static function options(): array {
		$options = get_option( FOOTBALL_FACTORY_CORE_OPTION, array() );
		$options = is_array( $options ) ? $options : array();

		return array_merge(
			array(
				'football_api_base_url' => '',
				'football_api_key'      => '',
				'n8n_webhook_token'     => '',
			),
			$options
		);
	}

	/**
	 * Render the settings page.
	 *
	 * @return void
	 */
	public static function render_admin_page(): void {
		if ( ! current_user_can( FOOTBALL_FACTORY_CORE_CAP_MANAGE ) ) {
			return;
		}

		$options = self::options();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Football Factory Core', 'football-factory-core' ); ?></h1>
			<p><?php esc_html_e( 'Configure football API and automation connection settings. Leave fields blank until production services are ready.', 'football-factory-core' ); ?></p>

			<form method="post" action="options.php">
				<?php settings_fields( 'football_factory_core' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="football_api_base_url"><?php esc_html_e( 'Football API Base URL', 'football-factory-core' ); ?></label></th>
						<td>
							<input id="football_api_base_url" class="regular-text" type="url" name="<?php echo esc_attr( FOOTBALL_FACTORY_CORE_OPTION ); ?>[football_api_base_url]" value="<?php echo esc_attr( $options['football_api_base_url'] ); ?>">
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="football_api_key"><?php esc_html_e( 'Football API Key', 'football-factory-core' ); ?></label></th>
						<td>
							<input id="football_api_key" class="regular-text" type="password" autocomplete="off" name="<?php echo esc_attr( FOOTBALL_FACTORY_CORE_OPTION ); ?>[football_api_key]" value="<?php echo esc_attr( $options['football_api_key'] ); ?>">
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="n8n_webhook_token"><?php esc_html_e( 'n8n Webhook Token', 'football-factory-core' ); ?></label></th>
						<td>
							<input id="n8n_webhook_token" class="regular-text" type="password" autocomplete="off" name="<?php echo esc_attr( FOOTBALL_FACTORY_CORE_OPTION ); ?>[n8n_webhook_token]" value="<?php echo esc_attr( $options['n8n_webhook_token'] ); ?>">
							<p class="description"><?php esc_html_e( 'POST events to /wp-json/football-factory/v1/n8n/event with this token in the X-Football-Factory-Token header.', 'football-factory-core' ); ?></p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}

Football_Factory_Core::init();

register_activation_hook( __FILE__, array( 'Football_Factory_Core', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Football_Factory_Core', 'deactivate' ) );
