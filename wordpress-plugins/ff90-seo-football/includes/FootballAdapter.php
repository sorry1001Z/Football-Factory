<?php
namespace FF90\SEO\Football;
final class FootballAdapter implements \FF90\SEO\DomainAdapter {
    private $registry; private $routes;
    public function __construct( array $registry, callable $routes ) { $this->registry = $registry; $this->routes = $routes; }
    public function catalog(): array {
        $out = array();
        foreach ( $this->registry['teams'] ?? array() as $row ) { $out[ $row['canonical_id'] ] = array_merge( $row, array( 'id' => $row['canonical_id'], 'name' => $row['display_name'], 'type' => 'TEAM' ) ); }
        foreach ( $this->registry['competitions'] ?? array() as $row ) { if ( ! empty( $row['enabled'] ) ) { $out[ $row['canonical_id'] ] = array_merge( $row, array( 'id' => $row['canonical_id'], 'type' => 'COMPETITION' ) ); } }
        return $out;
    }
    public function resolveEntity( string $text ): array {
        $labels = array(); $out = array(); $catalog = $this->catalog();
        foreach ( $catalog as $id => $row ) {
            foreach ( array_unique( array_filter( array_merge( array( $id, $row['name'], $row['short_name'] ?? '' ), $row['aliases'] ?? array() ) ) ) as $alias ) { $labels[ \FF90\SEO\Intent::normalize( $alias ) ][ $id ] = true; }
        }
        foreach ( $labels as $label => $matches ) {
            if ( 1 !== count( $matches ) || ! \FF90\SEO\Intent::matches( $text, $label ) ) { continue; }
            $id = array_key_first( $matches ); $r = $catalog[ $id ];
            $out[ $id ] = array( 'id' => $id, 'type' => $r['type'], 'name' => $r['name'], 'slug' => substr( $id, strpos( $id, ':' ) + 1 ), 'provenance' => 'static_identity_registry' );
        }
        ksort( $out ); return array_values( $out );
    }
    public function getEntityRelations( array $entity ): array {
        $catalog = $this->catalog(); $row = $catalog[ $entity['id'] ?? '' ] ?? null; if ( ! $row ) { return array(); } $out = array();
        if ( 'TEAM' === $row['type'] ) { foreach ( $row['competition_canonical_ids'] ?? array() as $id ) { if ( isset( $catalog[ $id ] ) ) { $out[] = array( 'fromId' => $row['id'], 'toId' => $id, 'type' => 'TEAM_COMPETITION', 'provenance' => 'static_registry_not_current_season' ); } } }
        if ( 'COMPETITION' === $row['type'] ) { foreach ( $catalog as $team ) { if ( 'TEAM' === $team['type'] && in_array( $row['id'], $team['competition_canonical_ids'] ?? array(), true ) ) { $out[] = array( 'fromId' => $row['id'], 'toId' => $team['id'], 'type' => 'COMPETITION_TEAM', 'provenance' => 'static_registry_not_current_season' ); } } }
        return $out;
    }
    public function getLandingPageType( array $entity, string $intent ): string {
        if ( 'TEAM' === ( $entity['type'] ?? '' ) ) { return 'TEAM_HUB'; }
        if ( 'COMPETITION' === ( $entity['type'] ?? '' ) ) { return in_array( $intent, array( 'STANDINGS', 'FIXTURES', 'RESULTS' ), true ) ? $intent : 'COMPETITION_HUB'; }
        return 'NEWS_LIST';
    }
    public function getIntentRules(): array { return $this->registry['intent_rules'] ?? array(); }
    public function getSchemaExtensions( array $entity ): array {
        $row = $this->catalog()[ $entity['id'] ?? '' ] ?? null;
        if ( ! $row || ! empty( $row['review_required'] ) ) { return array(); }
        return array( array( '@type' => 'TEAM' === $row['type'] ? 'SportsOrganization' : 'Organization', '@id' => $row['id'], 'name' => $row['name'] ) );
    }
    public function getInternalLinkTargets( array $entity ): array {
        $row = $this->catalog()[ $entity['id'] ?? '' ] ?? null; if ( ! $row ) { return array(); }
        $url = call_user_func( $this->routes, $entity ); if ( ! is_string( $url ) || '' === $url ) { return array(); }
        $out = array();
        foreach ( array_unique( array_filter( array_merge( array( $row['name'], $row['short_name'] ?? '' ), $row['aliases'] ?? array() ) ) ) as $label ) { $out[] = array( 'url' => $url, 'label' => $label, 'entityId' => $row['id'], 'entityType' => $row['type'], 'confidence' => $label === $row['name'] ? 0.95 : 0.7, 'priority' => 90 ); }
        return $out;
    }
}
